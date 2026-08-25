// Simplified Chinese dictionary.
//
// Each namespace is typed `Record<keyof typeof enX, string>`, so a key added
// to English without a Chinese counterpart — or a Chinese key with no English
// original — fails `npm run typecheck` in the namespace that owns it rather
// than as one unreadable error on the aggregate below.
//
// Tone: this is a trading product, so the register is plain and direct. Keep
// the product's own nouns in English where that is what a Chinese-speaking
// trader actually says — ticker symbols, "Canopy", "USDC", "Solana" — and
// translate everything that is a description rather than a name.

import type { TranslationKey } from "../en";
import { zhCommon } from "./common";
import { zhNav } from "./nav";
import { zhAgent } from "./agent";
import { zhAgentDetail } from "./agentDetail";
import { zhAccount } from "./account";
import { zhActivity } from "./activity";
import { zhBuild } from "./build";
import { zhCycles } from "./cycles";
import { zhEquity } from "./equity";
import { zhGoLive } from "./golive";
import { zhHome } from "./home";
import { zhLanding } from "./landing";
import { zhLimits } from "./limits";
import { zhMarketplace } from "./marketplace";
import { zhMarkets } from "./markets";
import { zhNarrate } from "./narrate";
import { zhNotifs, zhThread } from "./notifications";
import { zhPages } from "./pages";
import { zhSettings } from "./settings";
import { zhStrategy } from "./strategy";
import { zhWorkspace } from "./workspace";
import { zhWallet } from "./wallet";
import { zhPortfolio } from "./portfolio";
import { zhPositions } from "./positions";
import { zhPublish } from "./publish";
import { zhProfile } from "./profile";

export const zh: Record<TranslationKey, string> = {
  ...zhCommon,
  ...zhNav,
  ...zhAccount,
  ...zhActivity,
  ...zhAgent,
  ...zhAgentDetail,
  ...zhBuild,
  ...zhCycles,
  ...zhEquity,
  ...zhGoLive,
  ...zhHome,
  ...zhLanding,
  ...zhLimits,
  ...zhMarketplace,
  ...zhMarkets,
  ...zhNarrate,
  ...zhNotifs,
  ...zhThread,
  ...zhPages,
  ...zhSettings,
  ...zhStrategy,
  ...zhWorkspace,
  ...zhWallet,
  ...zhPortfolio,
  ...zhPositions,
  ...zhPublish,
  ...zhProfile,
};
