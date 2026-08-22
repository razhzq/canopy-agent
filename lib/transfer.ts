"use client";

// Moving funds OUT of the user's own wallet.
//
// This is the only code in the app that spends a user's money on their behalf,
// and every decision in it is made in the direction of "refuse rather than
// guess". A wrong address, a wrong decimal, or a drained fee balance is not
// recoverable — there is no support desk that can reverse a Solana transfer.
//
// It never touches an AGENT wallet. Agent wallets carry Canopy's signer and
// are spent by the desk under policy; this signs with the user's own key, from
// the wallet the account menu identifies as theirs. Keeping those two paths in
// separate files is deliberate.
//
// Kit (v5), not @solana/web3.js — the version Privy already ships and the one
// @solana-program/memo is pinned to, so this adds no second Solana runtime to
// the bundle.

import {
  address,
  appendTransactionMessageInstructions,
  createSolanaRpc,
  createTransactionMessage,
  getTransactionEncoder,
  type Instruction,
  compileTransaction,
  createNoopSigner,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  getTransferInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";

import { rpcUrl, USDC_MINT } from "@/lib/chainBalance";

/** USDC is a 6-decimal mint. Hardcoding it is safe; it is a fixed property. */
const USDC_DECIMALS = 6;
const LAMPORTS_PER_SOL = 1_000_000_000n;

/**
 * SOL held back from a "send max".
 *
 * Rent exemption for a bare account is ~0.00089 SOL and a signature costs
 * 5,000 lamports. Sweeping a wallet to exactly zero leaves it unable to pay for
 * the transaction that would refill it, and — more painfully — unable to pay
 * the fee on a USDC transfer, so a wallet holding $400 of USDC becomes stuck.
 * This is deliberately generous: the cost of holding a cent back is nothing,
 * and the cost of not holding it back is a wallet the user cannot use.
 */
export const SOL_RESERVE = 0.002;

export type Asset = "SOL" | "USDC";

/**
 * Is this a well-formed Solana address?
 *
 * Kit's `address()` throws on anything that is not a valid base58 32-byte
 * public key, which covers the realistic paste errors: a truncated address, an
 * Ethereum 0x address, a transaction signature (64 bytes), stray whitespace.
 *
 * What it CANNOT tell you is whether anyone holds the key. An address that is
 * syntactically perfect and belongs to nobody accepts funds and keeps them
 * forever. That is why the UI confirms the destination separately rather than
 * treating a green tick here as safety.
 */
export function isValidAddress(value: string): boolean {
  try {
    address(value.trim());
    return true;
  } catch {
    return false;
  }
}

/**
 * Decimal string → integer base units, without ever touching a float.
 *
 * The whole string is matched in one go, deliberately. Validating the halves of
 * a `split(".")` accepted "1.2.3" and quietly sent 1.2 — the destructure threw
 * the rest away, and both surviving parts were digits, so nothing complained.
 * An amount that silently differs from what was typed is the worst failure this
 * file can have.
 */
export function toBaseUnits(amount: string, decimals: number): bigint {
  const trimmed = amount.trim();
  const m = /^(\d*)(?:\.(\d*))?$/.exec(trimmed);
  if (!m || trimmed === "" || trimmed === ".") throw new Error("not a number");
  const whole = m[1];
  const fraction = m[2] ?? "";
  if (fraction.length > decimals) {
    // Silently truncating here would send less than was typed. Say so instead.
    throw new Error(`at most ${decimals} decimal places`);
  }
  const padded = (fraction + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(padded || "0");
}

/**
 * A float balance, rendered as an amount string the form will accept.
 *
 * The "Max" button used to write `String(sendable)` straight into the field.
 * Balances arrive as floats and the SOL reserve is subtracted from one, so
 * `0.043 - 0.002` is `0.040999999999999995` — eighteen decimal places, which
 * `toBaseUnits` then refuses. Pressing Max produced an error rather than an
 * amount.
 *
 * `toFixed` at the asset's own precision recovers the intended value (a lamport
 * is the ninth decimal, so nothing below it is real), and the trailing zeros
 * come off for display. The strip is anchored to a decimal point on purpose:
 * a naive /0+$/ turns "100" into "1".
 */
export function formatAmountInput(value: number, decimals: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  return value
    .toFixed(decimals)
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "");
}

export interface TransferPlan {
  asset: Asset;
  from: string;
  to: string;
  /** Integer base units — lamports for SOL, 1e-6 USDC for USDC. */
  amount: bigint;
  /** True when the destination has no USDC account and one must be created. */
  createsRecipientAccount: boolean;
}

/**
 * What building the transaction would do, worked out before anything is signed.
 *
 * Split from `send` so the confirm step can state the consequence — in
 * particular that a first-time USDC recipient costs the sender ~0.002 SOL in
 * rent for the token account being opened in their name. Discovering that at
 * signing time is how a transfer fails for a reason nobody was shown.
 */
export async function planTransfer(args: {
  asset: Asset;
  from: string;
  to: string;
  amount: string;
}): Promise<TransferPlan> {
  const to = address(args.to.trim());
  const from = address(args.from);
  const amount = toBaseUnits(args.amount, args.asset === "SOL" ? 9 : USDC_DECIMALS);
  if (amount <= 0n) throw new Error("enter an amount above zero");

  let createsRecipientAccount = false;
  if (args.asset === "USDC") {
    const rpc = createSolanaRpc(rpcUrl());
    const [ata] = await findAssociatedTokenPda({
      owner: to,
      mint: address(USDC_MINT),
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    const info = await rpc.getAccountInfo(ata, { encoding: "base64" }).send();
    createsRecipientAccount = info.value === null;
  }

  return { asset: args.asset, from: String(from), to: String(to), amount, createsRecipientAccount };
}

/**
 * Builds the transfer and hands it to `sign`, which is Privy's signer.
 *
 * Signing is injected rather than imported so this module stays free of React
 * and of Privy — the arithmetic above is the part worth testing, and it should
 * not require a browser and a logged-in user to exercise.
 *
 * Returns the signature. Confirmation is left to the caller: a transfer that
 * landed is landed, and blocking the UI on finalisation would misreport a
 * successful send as a failure whenever the RPC is slow.
 */
export async function sendTransfer(
  plan: TransferPlan,
  sign: (wire: Uint8Array) => Promise<string>,
): Promise<string> {
  const rpc = createSolanaRpc(rpcUrl());
  const from = address(plan.from);
  const to = address(plan.to);

  // A noop signer: it declares the fee payer as the authority on each
  // instruction without holding a key. Privy fills the signature in — this
  // module never sees one.
  const signer = createNoopSigner(from);
  const instructions: Instruction[] = [];

  if (plan.asset === "SOL") {
    instructions.push(
      getTransferSolInstruction({ source: signer, destination: to, amount: plan.amount }),
    );
  } else {
    const mint = address(USDC_MINT);
    const [fromAta] = await findAssociatedTokenPda({
      owner: from,
      mint,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    const [toAta] = await findAssociatedTokenPda({
      owner: to,
      mint,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });

    // Idempotent: safe if the account appeared between `planTransfer` and now,
    // which is a real race when two people send to the same fresh wallet.
    if (plan.createsRecipientAccount) {
      instructions.push(
        getCreateAssociatedTokenIdempotentInstruction({
          payer: signer,
          owner: to,
          mint,
          ata: toAta,
        }),
      );
    }

    instructions.push(
      getTransferInstruction({
        source: fromAta,
        destination: toAta,
        authority: signer,
        amount: plan.amount,
      }),
    );
  }

  const { value: blockhash } = await rpc.getLatestBlockhash().send();

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(signer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );

  // Wire bytes, unsigned. Privy's signer fills the signature in and broadcasts;
  // no key material is ever in this module's reach.
  return sign(getTransactionEncoder().encode(compileTransaction(message)) as Uint8Array);
}

export { formatUnits };

/** Integer base units → a decimal string, for display. Never a float. */
function formatUnits(units: bigint, decimals: number): string {
  const s = units.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, -decimals);
  const frac = s.slice(-decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

export { LAMPORTS_PER_SOL, USDC_DECIMALS };
