// The English dictionary — the source of truth for every key in the app.
//
// Keys are flat snake_case, prefixed by the surface that owns them
// (`portfolio_*`, `build_*`), so a string can be traced from the screen back
// to its definition with one grep. They are assembled from per-surface
// namespaces rather than one 1,500-line object: a wizard step's strings live
// beside the wizard's other strings, and a merge of two branches that each
// added a screen does not collide.
//
// `{var}` placeholders are interpolated at render time by `useT()`.
//
// Where a language would order the words differently, prefer one complete
// sentence over concatenating fragments: `positions_none_for_agent`, never
// `positions_none` + `for` + `agent`.

import { enCommon } from "./common";
import { enNav } from "./nav";
import { enAgent } from "./agent";
import { enAgentDetail } from "./agentDetail";
import { enAccount } from "./account";
import { enActivity } from "./activity";
import { enBuild } from "./build";
import { enCycles } from "./cycles";
import { enEquity } from "./equity";
import { enGoLive } from "./golive";
import { enHome } from "./home";
import { enLanding } from "./landing";
import { enLimits } from "./limits";
import { enMarketplace } from "./marketplace";
import { enMarkets } from "./markets";
import { enNarrate } from "./narrate";
import { enNotifs, enThread } from "./notifications";
import { enPages } from "./pages";
import { enSettings } from "./settings";
import { enStrategy } from "./strategy";
import { enWorkspace } from "./workspace";
import { enWallet } from "./wallet";
import { enPortfolio } from "./portfolio";
import { enPositions } from "./positions";
import { enPublish } from "./publish";
import { enProfile } from "./profile";

export const en = {
  ...enCommon,
  ...enNav,
  ...enAccount,
  ...enActivity,
  ...enAgent,
  ...enAgentDetail,
  ...enBuild,
  ...enCycles,
  ...enEquity,
  ...enGoLive,
  ...enHome,
  ...enLanding,
  ...enLimits,
  ...enMarketplace,
  ...enMarkets,
  ...enNarrate,
  ...enNotifs,
  ...enThread,
  ...enPages,
  ...enSettings,
  ...enStrategy,
  ...enWorkspace,
  ...enWallet,
  ...enPortfolio,
  ...enPositions,
  ...enPublish,
  ...enProfile,
} as const;

export type TranslationKey = keyof typeof en;
