# Gas sponsorship (Solana)

Canopy pays the network fee and rent on agent swaps, user withdrawals and
deposits, and Pod model top-ups. Built 2026-09-06 across canopy-be and
canopy-agent. **Provider: Privy native sponsorship** (default). Alchemy Gas
Manager remains as an alternative provider but needs an enterprise allowlist
for Solana mainnet, which is why it is not the default.

## Why only Solana

Base trading is KalqiX, an off-chain order book signed with Schnorr and EIP-191
messages. No EVM transaction is broadcast anywhere, so there is no gas to
sponsor. Every on-chain fee Canopy's users pay is Solana.

## How the Privy path works

Nothing about how a transaction is built changes. The wallet is the fee payer
in the message exactly as before. The signing call carries `sponsor: true`, and
Privy's signer swaps its own fee payer in and refreshes the blockhash before
signing and broadcasting. Privy bills the fee to the app.

| Surface | Where it is built | How it is sent |
|---|---|---|
| Agent swap | canopy-be `agentStack/wallet/executor.ts` (Jupiter `/swap`) | `wallets().solana().signAndSendTransaction(walletId, { transaction, caip2, sponsor: true })` → returns the signature; executor confirms it |
| Pod top-up | canopy-be `services/pod/deposit.ts` (payer = chosen wallet) | Browser: `useSignAndSendTransaction` with `options.sponsor: true` |
| Withdraw / deposit | canopy-agent `lib/transfer.ts` (payer = user wallet) | Browser: same, `options.sponsor: plan.sponsored` |

The browser also passes `optimisticBroadcast: true` and confirms over HTTP
itself (`waitForLanding` in `lib/transfer.ts`), because Privy's own
confirmation waits on a websocket with a ten-second timeout that reports a
failure for a transfer that landed.

## Configuration (canopy-be)

```
GAS_SPONSOR_ENABLED=true
GAS_SPONSOR_PROVIDER=privy
```

And in the Privy dashboard, under Gas Sponsorship: **App pays**, enable
**Solana mainnet**, and allow **transactions from the client**. Privy requires
**TEE execution** for native sponsorship; check the app's wallet execution
setting. Set spending caps there.

`GET /api/gas/sponsor` returns `{ enabled, provider }`; the app reads it once
per session and shows "Network fee covered by Canopy" on the confirm steps.

### Alchemy alternative

```
GAS_SPONSOR_PROVIDER=alchemy
ALCHEMY_SOLANA_RPC_URL=https://solana-mainnet.g.alchemy.com/v2/<KEY>
ALCHEMY_GAS_POLICY_ID=<policy uuid>
```

Builds with a placeholder fee payer and calls `alchemy_requestFeePayer`
(`services/gasSponsor.ts`); the executor uses Jupiter `/swap-instructions` for
this. The browser side of the Alchemy path (`POST /api/gas/sponsor`) still
exists on the backend but the app no longer calls it. On 2026-09-06 Alchemy
refused mainnet with "Gas sponsorship on SOLANA_MAINNET is not enabled for your
team", which requires contacting Alchemy.

## Fallback

Self-pay, always. With sponsorship off the wallet pays its own fee, as before.
Under Privy, a refused sponsorship surfaces as a Privy error on the signing
call rather than a silent fallback; the dialog shows the message.

## Security notes

- Privy's guidance: on Solana, sponsored transactions that include
  `CloseAccount` let a user pocket the rent refund while the app paid to open
  the account. The app's withdraw/deposit builds never close accounts; the
  agent executor's Jupiter routes can (cleanup instruction). Keep the Privy
  spending caps tight and watch the sponsorship spend.
- The agent-wallet Privy policy (`canopy-agent-jupiter-only`) is evaluated on
  `signAndSendTransaction` as well as `signTransaction`, so sponsored agent
  swaps stay inside the same program allow-list.

## Related fix: stale wallet-level policies

Two of one user's wallets carried the agent policy at wallet level, which
denies the owner's own transfers. Only Privy can clear that on a user-owned
wallet. `wallets:scan-policies` lists affected wallets; `wallets:retire`
(CANOPY_095) sets a wallet aside so the app picks or creates another main
wallet.

## What still needs a live check

1. A sponsored withdrawal from a wallet holding only USDC: fee payer on
   Solscan should be Privy's, not the user's.
2. A sponsored agent swap: `[executor] submitted` with the signature returned
   by Privy, and confirmation.
3. A Pod top-up with `sponsor: true` from a wallet with no SOL.
