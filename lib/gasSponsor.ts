"use client";
// Asking Canopy to pay the network fee.
//
// The browser builds withdrawals and deposits itself (lib/transfer.ts). To
// have Canopy pay the fee, the transaction is built with a PLACEHOLDER fee
// payer — a key that appears nowhere else in it — and posted to canopy-be,
// which holds the Alchemy Gas Manager key. What comes back is the same
// transaction with Canopy's payer swapped in and already signed by it; the
// user's wallet adds its own signature and Privy broadcasts as usual.
//
// TWO ANSWERS, NEVER A FAILURE. `sponsor` returns the sponsored bytes or null.
// Null means "pay your own fee this time" — sponsorship off, the treasury
// unreachable, the policy refusing — and the caller rebuilds with the wallet
// as payer. A withdrawal must never be blocked by a paymaster.
//
// WHAT IS CHECKED BEFORE SIGNING. The bytes came from our own API, and that
// is not an argument: the wallet key lives in the browser precisely so the
// browser gets to refuse. So before the sponsored copy is handed to Privy it
// is decoded and compared with what was sent: same instructions, same
// programs, same data; only the first account may differ, and it must NOT be
// the user's own wallet.

import {
  getBase64Encoder,
  getBase64Decoder,
  getTransactionDecoder,
  getCompiledTransactionMessageDecoder,
  type Transaction,
} from "@solana/kit";
import { sponsorTransaction } from "@/lib/api";

export type Sponsor = (wire: Uint8Array, signer: string) => Promise<Uint8Array | null>;

/** A sponsor bound to a session token. */
export function sponsorWith(token: string): Sponsor {
  return async (wire, signer) => {
    try {
      const res = await sponsorTransaction(token, {
        serializedTransaction: getBase64Decoder().decode(wire),
        signer,
      });
      if (!res.sponsored) return null;
      const sponsored = new Uint8Array(getBase64Encoder().encode(res.serializedTransaction));
      assertSameTransaction(wire, sponsored, signer);
      return sponsored;
    } catch (err) {
      // Logged, not thrown: the caller pays its own fee. A verification
      // failure is the one case worth a louder line, because it means the
      // response was not what we built.
      console.warn("[gas] sponsorship unavailable; paying from the wallet", err);
      return null;
    }
  };
}

/** The fee payer of a serialized transaction: its first static account. */
export function feePayerOf(wire: Uint8Array): string {
  const tx: Transaction = getTransactionDecoder().decode(wire);
  const message = getCompiledTransactionMessageDecoder().decode(tx.messageBytes);
  return String(message.staticAccounts[0]);
}

/**
 * The sponsored copy is OUR transaction with a different first account.
 *
 * Compared by what each instruction's indexes point at rather than by the
 * indexes themselves, because moving the payer legitimately renumbers the
 * accounts. The placeholder may be rewritten to the sponsor's payer inside
 * an instruction (rent for a created account); nothing else may change.
 */
function assertSameTransaction(before: Uint8Array, after: Uint8Array, signer: string): void {
  const a = decode(before);
  const b = decode(after);
  const placeholder = String(a.staticAccounts[0]);
  const payer = String(b.staticAccounts[0]);
  if (payer === signer) throw new Error("sponsored transaction pays from the signing wallet");
  if (a.instructions.length !== b.instructions.length) {
    throw new Error("sponsored transaction changed the instruction count");
  }
  const key = (m: typeof a, i: number) => String(m.staticAccounts[i] ?? `lut:${i}`);
  for (let i = 0; i < a.instructions.length; i++) {
    const x = a.instructions[i];
    const y = b.instructions[i];
    if (key(a, x.programAddressIndex) !== key(b, y.programAddressIndex)) {
      throw new Error("sponsored transaction changed a program");
    }
    const dx = x.data ?? new Uint8Array();
    const dy = y.data ?? new Uint8Array();
    if (dx.length !== dy.length || dx.some((v, k) => v !== dy[k])) {
      throw new Error("sponsored transaction changed instruction data");
    }
    const ax = x.accountIndices ?? [];
    const ay = y.accountIndices ?? [];
    if (ax.length !== ay.length) throw new Error("sponsored transaction changed accounts");
    for (let k = 0; k < ax.length; k++) {
      const ka = key(a, ax[k]);
      const kb = key(b, ay[k]);
      if (ka !== kb && ka !== placeholder) {
        throw new Error("sponsored transaction changed an account");
      }
    }
  }
}

function decode(wire: Uint8Array) {
  const tx: Transaction = getTransactionDecoder().decode(wire);
  return getCompiledTransactionMessageDecoder().decode(tx.messageBytes);
}
