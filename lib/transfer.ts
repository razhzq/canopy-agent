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
  getSyncNativeInstruction,
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

/**
 * What can be moved, and what each one IS on chain.
 *
 * "SOL" is native lamports — a System transfer, no token account anywhere.
 * "USDC" and "wSOL" are SPL mints and take the identical token path; the only
 * things that differ are the mint address and its decimals, which is why they
 * live in a table rather than in an `if`.
 *
 * WHY wSOL EXISTS AS A SEPARATE ASSET FROM SOL. A copy-LP agent is funded in
 * SOL and provides liquidity with it (CANOPY_127), but it cannot WRAP: that
 * needs the System program, which is deliberately absent from the agent
 * wallet's allow-list, so native lamports sitting in an agent wallet are gas
 * and can never become liquidity. The wrapping happens HERE, on the owner's
 * side, where their own key signs and no policy constrains it. From the
 * owner's point of view they send one asset; underneath, the cash arrives
 * wrapped and the gas arrives native.
 */
export type Asset = "SOL" | "USDC" | "wSOL";

/**
 * Wrapped SOL. An ordinary SPL mint whose balance is lamports held inside a
 * token account — which is exactly why the token path below needs no special
 * case for it, and why its decimals are 9 rather than USDC's 6.
 */
export const WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112";

/** The mint and decimals behind each token asset. Native SOL has no mint. */
const SPL: Record<"USDC" | "wSOL", { mint: string; decimals: number }> = {
  USDC: { mint: USDC_MINT, decimals: USDC_DECIMALS },
  wSOL: { mint: WRAPPED_SOL_MINT, decimals: 9 },
};

/**
 * How many decimal places an amount of this asset is typed in.
 *
 * EXPORTED BECAUSE EVERY CALLER USED TO HARDCODE A 6. A dialog that parses
 * "0.5" as 500,000 base units is correct for USDC and a thousand times wrong
 * for wSOL, and nothing about the resulting transaction looks unusual.
 */
export function decimalsOf(asset: Asset): number {
  return asset === "USDC" ? USDC_DECIMALS : 9;
}

/** The token mint behind an asset, or null for native SOL. */
export function mintOf(asset: Asset): string | null {
  return asset === "SOL" ? null : SPL[asset].mint;
}

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
export class AmountError extends Error {
  /**
   * What was wrong, as a code rather than a sentence.
   *
   * These messages reach the withdraw form and are rendered under the field,
   * so they have to be translatable — and this module is a pure transfer
   * builder with no business holding a dictionary. The UI maps the code to a
   * string; `message` stays as the English fallback for a console or a log.
   */
  readonly code: "not_a_number" | "too_many_decimals" | "not_above_zero";
  readonly decimals?: number;

  constructor(
    code: AmountError["code"],
    message: string,
    decimals?: number,
  ) {
    super(message);
    this.name = "AmountError";
    this.code = code;
    this.decimals = decimals;
  }
}

export function toBaseUnits(amount: string, decimals: number): bigint {
  const trimmed = amount.trim();
  const m = /^(\d*)(?:\.(\d*))?$/.exec(trimmed);
  if (!m || trimmed === "" || trimmed === ".") {
    throw new AmountError("not_a_number", "not a number");
  }
  const whole = m[1];
  const fraction = m[2] ?? "";
  if (fraction.length > decimals) {
    // Silently truncating here would send less than was typed. Say so instead.
    throw new AmountError(
      "too_many_decimals",
      `at most ${decimals} decimal places`,
      decimals,
    );
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
  /** True when the destination has no token account for this mint yet. */
  createsRecipientAccount: boolean;
  /**
   * EXTRA LAMPORTS SENT NATIVE ALONGSIDE A wSOL DEPOSIT, for the agent's gas.
   *
   * A copy-LP agent needs SOL in two forms and cannot convert between them:
   * WRAPPED to provide liquidity with, and NATIVE to pay network fees and
   * position rent. It cannot wrap or unwrap on its own — that needs the System
   * program, which its allow-list does not carry — so whatever it is given is
   * what it has.
   *
   * Rather than ask the owner to make that distinction, one deposit carries
   * both legs in ONE transaction: this many lamports arrive native, `amount`
   * arrives wrapped, and the owner is debited the sum. Zero when the agent's
   * gas is already covered, which is the ordinary case after the first
   * deposit.
   */
  gasLamports: bigint;
  /**
   * Whether Canopy pays the fee (and the rent above). Decided at planning so
   * the confirm step can say so. The dialog passes it to Privy as
   * `sponsor: true` on the signing call; Privy swaps its own fee payer in.
   */
  sponsored: boolean;
}

/**
 * What building the transaction would do, worked out before anything is signed.
 *
 * Split from `send` so the confirm step can state the consequence — in
 * particular that a first-time USDC recipient costs the sender ~0.002 SOL in
 * rent for the token account being opened in their name. Discovering that at
 * signing time is how a transfer fails for a reason nobody was shown.
 */
export async function planTransfer(
  args: {
    asset: Asset;
    from: string;
    to: string;
    amount: string;
  },
  opts: {
    sponsored?: boolean;
    /**
     * Lamports to send native beside a wSOL deposit, for the recipient's gas.
     * Worked out by the caller, which is the only place that knows what the
     * agent already holds. See `TransferPlan.gasLamports`.
     */
    gasLamports?: bigint;
  } = {},
): Promise<TransferPlan> {
  const to = address(args.to.trim());
  const from = address(args.from);
  const amount = toBaseUnits(args.amount, decimalsOf(args.asset));
  if (amount <= 0n) {
    throw new AmountError("not_above_zero", "enter an amount above zero");
  }

  let createsRecipientAccount = false;
  const mint = mintOf(args.asset);
  if (mint) {
    const rpc = createSolanaRpc(rpcUrl());
    const [ata] = await findAssociatedTokenPda({
      owner: to,
      mint: address(mint),
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    const info = await rpc.getAccountInfo(ata, { encoding: "base64" }).send();
    createsRecipientAccount = info.value === null;
  }

  return {
    asset: args.asset,
    from: String(from),
    to: String(to),
    amount,
    createsRecipientAccount,
    // Only a wrapped-SOL deposit carries a gas leg. Asking for one on any
    // other asset would silently add a System transfer to a token send.
    gasLamports: args.asset === "wSOL" && opts.gasLamports && opts.gasLamports > 0n ? opts.gasLamports : 0n,
    sponsored: opts.sponsored === true,
  };
}

/** Where a broadcast stands: not yet seen, landed, rejected, or not seen in time. */
export type Landing = "pending" | "confirmed" | "failed" | "unknown";

/**
 * Whether a broadcast transaction landed, asked over HTTP.
 *
 * Privy's send hook confirms over a websocket subscription with a ten-second
 * timeout, and on the public cluster socket that wait fails or times out
 * while the transfer itself sits confirmed — the modal then reports a failure
 * for money that has moved. So the send is optimistic (see the dialogs) and
 * this polls `getSignatureStatuses` through the app's own RPC instead.
 * "unknown" after the deadline is a slow chain, not a failure: the Solscan
 * link beside it is the honest next step.
 */
export async function waitForLanding(
  signature: string,
  opts: { timeoutMs?: number; everyMs?: number } = {},
): Promise<Landing> {
  const rpc = createSolanaRpc(rpcUrl());
  const deadline = Date.now() + (opts.timeoutMs ?? 45_000);
  const every = opts.everyMs ?? 1_500;
  while (Date.now() < deadline) {
    try {
      const { value } = await rpc
        .getSignatureStatuses([signature as Parameters<typeof rpc.getSignatureStatuses>[0][number]])
        .send();
      const status = value[0];
      if (status) {
        if (status.err) return "failed";
        if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") {
          return "confirmed";
        }
      }
    } catch {
      /* a missed poll is nothing; the next one asks again */
    }
    await new Promise((r) => setTimeout(r, every));
  }
  return "unknown";
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

  // A noop signer: it declares the wallet as the authority on each
  // instruction without holding a key. Privy fills the signature in — this
  // module never sees one.
  const signer = createNoopSigner(from);
  const instructions: Instruction[] = [];

  if (plan.asset === "SOL") {
    instructions.push(
      getTransferSolInstruction({ source: signer, destination: to, amount: plan.amount }),
    );
  } else {
    const mint = address(SPL[plan.asset].mint);
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

    if (plan.asset === "wSOL") {
      /*
       * WRAPPING, WHICH IS WHY THIS BRANCH EXISTS.
       *
       * wSOL is not a token the owner holds a balance of — it is lamports
       * parked in a token account. So a "wSOL transfer" is not a transfer at
       * all: it is a System transfer of lamports INTO the recipient's wSOL
       * account, followed by SyncNative to make the token program count them.
       *
       * The owner signs this, which is the whole point. The same three
       * instructions inside an agent wallet would be refused — the System
       * program is absent from its allow-list — so the wrapping has to happen
       * on this side of the boundary.
       *
       * THE RECIPIENT'S ACCOUNT, NOT THE SENDER'S. Sending from a wSOL balance
       * the owner already holds would be an ordinary token transfer, but
       * nobody keeps a standing wSOL balance; they hold SOL. Going straight
       * from the owner's lamports to the agent's wrapped account is one
       * transaction instead of three and leaves no dust account behind.
       */
      instructions.push(
        getTransferSolInstruction({ source: signer, destination: toAta, amount: plan.amount }),
        getSyncNativeInstruction({ account: toAta }),
      );
    } else {
      instructions.push(
        getTransferInstruction({
          source: fromAta,
          destination: toAta,
          authority: signer,
          amount: plan.amount,
        }),
      );
    }

    // THE GAS LEG, LAST. Native lamports the agent can spend on fees, which
    // the wrapped balance above can never become. Ordered after the wrap so a
    // transaction that runs out of compute fails with the cash unmoved rather
    // than with gas delivered and cash lost.
    if (plan.gasLamports > 0n) {
      instructions.push(
        getTransferSolInstruction({ source: signer, destination: to, amount: plan.gasLamports }),
      );
    }
  }

  const { value: blockhash } = await rpc.getLatestBlockhash().send();

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(signer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );

  // Wire bytes, unsigned, with the wallet as fee payer — even when Canopy is
  // paying. Privy's sponsorship swaps its own payer in and refreshes the
  // blockhash inside the signer, so the message built here is the same either
  // way; the dialog says `sponsor: true` when it hands these over.
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
