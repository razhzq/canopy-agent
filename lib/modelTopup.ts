"use client";

// Putting money on an agent's model balance.
//
// Sibling to lib/transfer.ts and written under the same rule: refuse rather
// than guess. The difference is who builds the transaction. A withdrawal is
// assembled here, from two instructions this app understands completely. A
// model top-up is an Anchor call into a program we do not own, whose account
// list is resolved from an IDL, and Anchor's client is built on
// @solana/web3.js — a second Solana runtime this bundle deliberately does not
// carry. So canopy-be builds it and this module signs it.
//
// WHICH MEANS THIS MODULE'S REAL JOB IS TO DISTRUST IT.
//
// Signing bytes somebody else assembled is exactly the situation where "it
// came from our own API" is not an argument — the whole point of holding the
// key in the browser is that the browser gets to refuse. Everything below
// `verifyPreparedTopUp` checks is something an attacker who could rewrite the
// response would want: a different fee payer, an extra instruction, a program
// that is not Pod's.
//
// Kit (v5), not @solana/web3.js — the version Privy already ships. Same
// reasoning as lib/transfer.ts, and the reason there is no Anchor here.

import {
  address,
  getBase64Encoder,
  getTransactionDecoder,
  getCompiledTransactionMessageDecoder,
  type Transaction,
} from "@solana/kit";

import type { TopUpTx } from "@/lib/api";

/**
 * Pod's deposit program, pinned in the client.
 *
 * The ONE constant this file keeps its own copy of, and the copy is the point:
 * every other fact about the transaction comes from the backend, so a program
 * id that also came from the backend would be checked against itself. This is
 * the string an attacker would swap, so this is the string that lives here.
 */
export const POD_PROGRAM_ID = "BBAdcqUkg68JXNiPQ1HR1wujfZuayyK3eQTQSYAh6FSW";

/**
 * Programs a legitimate top-up may touch, besides Pod's own.
 *
 * The token program moves the USDC; the ATA program exists because a payer who
 * has never held USDC needs an account created first; compute-budget because a
 * priority fee is ordinary. Anything else — the system program's transfer, a
 * close-account, a delegate — has no business in a deposit and stops it.
 */
const ALLOWED_PROGRAMS = new Set([
  POD_PROGRAM_ID,
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  "ComputeBudget111111111111111111111111111111",
  "11111111111111111111111111111111",
]);

/**
 * Read the prepared transaction back and check it says what we asked for.
 *
 * Throws a sentence a person can act on, because a failure here is shown to
 * them: it means the thing they were about to sign is not the thing they asked
 * for, and the only correct next step is to not sign it.
 */
export function verifyPreparedTopUp(prepared: TopUpTx, expectedPayer: string): void {
  if (Date.parse(prepared.expiresAt) <= Date.now()) {
    throw new Error("That top-up expired before it was signed. Nothing was charged.");
  }

  const message = decodeMessage(prepared.transactionBase64);

  // The fee payer is the first static account, by definition of the format.
  const payer = message.staticAccounts[0];
  if (!payer || String(payer) !== String(address(expectedPayer))) {
    throw new Error(
      "That transaction pays from a different wallet than the one you chose. Nothing has been signed.",
    );
  }

  const programs = new Set(
    message.instructions.map((ix) => String(message.staticAccounts[ix.programAddressIndex])),
  );

  if (!programs.has(POD_PROGRAM_ID)) {
    throw new Error(
      "That transaction does not deposit to Pod. Nothing has been signed — please contact support.",
    );
  }

  for (const program of programs) {
    if (!ALLOWED_PROGRAMS.has(program)) {
      throw new Error(
        `That transaction touches an unexpected program (${program}). Nothing has been signed — please contact support.`,
      );
    }
  }
}

/**
 * Signs the prepared transaction and returns the signature.
 *
 * `sign` is injected, exactly as in lib/transfer.ts, so this module stays free
 * of React and of Privy. It receives the same wire bytes the backend built —
 * verified above, never re-assembled here, because re-assembling is how a
 * client and a server end up disagreeing about what was signed.
 */
export async function submitTopUp(
  prepared: TopUpTx,
  expectedPayer: string,
  sign: (wire: Uint8Array) => Promise<string>,
): Promise<string> {
  verifyPreparedTopUp(prepared, expectedPayer);
  return sign(wireBytes(prepared.transactionBase64));
}

/* ----------------------------------------------------------------- bytes -- */

function wireBytes(base64: string): Uint8Array {
  return new Uint8Array(getBase64Encoder().encode(base64));
}

function decodeMessage(base64: string) {
  const tx: Transaction = getTransactionDecoder().decode(wireBytes(base64));
  return getCompiledTransactionMessageDecoder().decode(tx.messageBytes);
}
