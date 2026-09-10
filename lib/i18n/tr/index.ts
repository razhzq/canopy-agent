// Turkish dictionary.
//
// TYPED PARTIAL ON PURPOSE, and only here. Each namespace file below is typed
// `Record<keyof typeof enX, string>` exactly as the Chinese ones are, so a key
// added to English without a Turkish counterpart fails the typecheck in the
// namespace that owns it. What is deliberately NOT asserted is that every
// namespace exists yet: `t` resolves a missing key against English
// (`dict[key] ?? en[key] ?? key`), so a namespace that has not landed shows
// English rather than a raw key, and the ones that have landed are complete.
//
// Tone: plain and direct, the same register as the English. Product nouns stay
// in English where that is what a Turkish-speaking trader actually says —
// "Canopy", "USDC", "Solana", ticker symbols, "Bollinger", "RSI" — and
// everything that is a description rather than a name is translated.
//
// "Ajan" for agent, "döngü" for cycle, "kağıt" for paper, "özkaynak" for
// equity, "K/Z" for P&L, "zarar durdur" for stop loss, "kâr al" for take
// profit. Kept consistent across every file: a figure named two ways on two
// screens is the drift this directory exists to stop.

import type { TranslationKey } from "../en";
import { trAccount } from "./account";
import { trActivity } from "./activity";
import { trAgent } from "./agent";
import { trCommon } from "./common";
import { trCycles } from "./cycles";
import { trEquity } from "./equity";
import { trHome } from "./home";
import { trMarketplace } from "./marketplace";
import { trNav } from "./nav";
import { trPages } from "./pages";
import { trPositions } from "./positions";
import { trProfile } from "./profile";
import { trSettings } from "./settings";
import { trWorkspace } from "./workspace";

export const tr: Partial<Record<TranslationKey, string>> = {
  ...trAccount,
  ...trActivity,
  ...trAgent,
  ...trCommon,
  ...trCycles,
  ...trEquity,
  ...trHome,
  ...trMarketplace,
  ...trNav,
  ...trPages,
  ...trPositions,
  ...trProfile,
  ...trSettings,
  ...trWorkspace,
};
