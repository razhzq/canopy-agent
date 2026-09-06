# Gas sponsorship (Alchemy Gas Manager, Solana)

Canopy pays the network fee and rent on agent swaps, user withdrawals and
deposits, and Pod model top-ups. Built 2026-09-06 across canopy-be and
canopy-agent.

## Why only Solana

Base trading is KalqiX, an off-chain order book signed with Schnorr and EIP-191
messages. No EVM transaction is broadcast anywhere, so there is no gas to
sponsor. Every on-chain fee Canopy's users pay is Solana.

## How it works

Alchemy's `alchemy_requestFeePayer` takes a serialized v0 transaction whose
fee payer is a **placeholder** key that appears nowhere else in the message,
swaps its own payer in, signs as that payer, and returns the bytes. The real
signer (agent wallet or user wallet) then adds its signature and the
transaction is broadcast normally.

| Surface | Where it is built | Sponsored how |
|---|---|---|
| Agent swap | canopy-be `agentStack/wallet/executor.ts` | Jupiter `/swap-instructions` → compiled with placeholder payer → sponsored → Privy signs → signatures merged → sent |
| Pod top-up | canopy-be `services/pod/deposit.ts` | Anchor instruction compiled with placeholder → sponsored → returned to browser with `feePayer` + `sponsored` |
| Withdraw / deposit | canopy-agent `lib/transfer.ts` | Built with placeholder → `POST /api/gas/sponsor` → sponsored bytes → Privy signs and sends |

Fallback is always self-pay. Off, unreachable, or refused → the same
instructions are rebuilt with the wallet as payer, with a warn log. A
paymaster outage never blocks a trade or a withdrawal.

## Configuration (canopy-be)

```
GAS_SPONSOR_ENABLED=true
ALCHEMY_SOLANA_RPC_URL=https://solana-mainnet.g.alchemy.com/v2/<KEY>
ALCHEMY_GAS_POLICY_ID=<policy uuid from the Gas Manager dashboard>
```

All three are required. Spending caps (per transaction, per day) live on the
policy in Alchemy's dashboard; the code trusts them.

## Security of the public route

`POST /api/gas/sponsor` is the only place the treasury is exposed to a
browser-built transaction. `vetUserTransaction` refuses unless:

- the caller's wallet is a required signer,
- the fee payer is a placeholder (not the caller, not referenced by any
  instruction, so nothing can debit it),
- every program is statically resolvable and on the short list (System,
  Token, ATA, Compute Budget, Pod deposit program),
- there are at most two signers.

A per-user rate limit of 20 per minute sits in front. Tests:
`npm run test:gas-sponsor` in `packages/canopy-be`.

The browser (`lib/gasSponsor.ts`) also checks the sponsored bytes against what
it sent before signing: same instructions, same programs, same data; only the
first account may differ and it must not be the user's wallet.

## What still needs a live check

Nothing here was run against a real Gas Manager policy. Before enabling in
production, on devnet with a devnet policy:

1. **Privy preserves or drops the sponsor signature.** The executor merges
   signatures from both copies so either behaviour works, but confirm a
   sponsored swap lands on chain.
2. **The Privy Solana policy accepts a foreign fee payer.** The agent-wallet
   policy allows Jupiter, Compute Budget, ATA and Token instructions. It does
   not condition on the fee payer today, but confirm a sponsored transaction
   is not refused by the enclave.
3. **Browser signing with a partially signed transaction.** Privy's
   `signAndSendTransaction` receives bytes that already carry the sponsor's
   signature. Confirm it adds the user's and broadcasts.
4. **Alchemy accepts Jupiter's compute-budget and cleanup instructions** on
   the policy, and that rent for a recipient's new USDC account is covered.

If 1 or 3 fail, the fix is to sign first and sponsor second only if Alchemy
supports a pre-signed payload, which the docs do not state.
