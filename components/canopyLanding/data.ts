// Shared wireframe-derived content for the Canopy landing.
//
// Numbers are illustrative — they come from the design wireframes, not from the
// live venues, and the footer says so.
//
// The SYMBOLS are not illustrative. Every ticker and every agent below names an
// asset the product can actually trade: the fourteen tokenized mints in the
// issuer registry, or a token in the Solana universe. An invented symbol on a
// landing page is a promise nobody can keep — the previous list advertised
// treasuries, an asset class with nothing behind it.

export type Ticker = { sym: string; px: string; chg: string; up: boolean };

export const TICKERS: Ticker[] = [
  // Tokenized real-world assets — all fourteen come from the issuer registry.
  { sym: "AAPLx", px: "227.40", chg: "+1.2%", up: true },
  { sym: "TSLAx", px: "312.85", chg: "−0.8%", up: false },
  { sym: "NVDAx", px: "121.30", chg: "+3.4%", up: true },
  { sym: "SPYx", px: "548.10", chg: "+6.2%", up: true },
  { sym: "PAXG", px: "2412.0", chg: "+2.9%", up: true },
  { sym: "MSFTx", px: "418.60", chg: "+0.9%", up: true },
  { sym: "GOOGLx", px: "178.4", chg: "+9.4%", up: true },
  { sym: "COINx", px: "241.6", chg: "+31.5%", up: true },
  // Solana spot. The deepest pools in the universe, so the belt shows the two
  // halves of what an agent can trade rather than only one.
  { sym: "SOL", px: "182.30", chg: "+4.1%", up: true },
  { sym: "JitoSOL", px: "214.75", chg: "+4.3%", up: true },
  { sym: "TRUMP", px: "13.82", chg: "−2.6%", up: false },
  { sym: "PUMP", px: "0.0041", chg: "+7.8%", up: true },
];

export type Agent = {
  /**
   * What the sample agent is called, in both languages.
   *
   * These are display names of illustrative agents rather than product
   * vocabulary, so they sit beside the row they belong to rather than in the
   * shared dictionary — the same call the deploy wireframe's copy bundle makes.
   * The ticker inside each name is a symbol and does not change.
   */
  name: string;
  nameZh: string;
  /** The trading pair. A pair of symbols; the same in every language. */
  pair: string;
  /** How long it has been running. Rendered with a translated unit. */
  days: number;
  ret: string;
  up: boolean;
  capital: string;
  trades: string;
  flag?: "hot" | "new" | "paper";
  seed: number;
};

export const AGENTS: Agent[] = [
  { name: "AAPLx Dip Catcher", nameZh: "AAPLx 抄底手", pair: "AAPLx/USDC", days: 94, ret: "+24.1%", up: true, capital: "$182k", trades: "928", flag: "hot", seed: 2 },
  { name: "COINx Volatility", nameZh: "COINx 波动率", pair: "COINx/USDC", days: 8, ret: "+31.5%", up: true, capital: "$44k", trades: "1,884", flag: "new", seed: 5 },
  { name: "SOL Momentum", nameZh: "SOL 动量", pair: "SOL/USDC", days: 12, ret: "+18.0%", up: true, capital: "$97k", trades: "1,612", seed: 8 },
  { name: "JitoSOL Trend", nameZh: "JitoSOL 趋势", pair: "JitoSOL/USDC", days: 73, ret: "+12.6%", up: true, capital: "$130k", trades: "870", seed: 11 },
  { name: "TSLAx Momentum", nameZh: "TSLAx 动量", pair: "TSLAx/USDC", days: 21, ret: "+11.8%", up: true, capital: "$64k", trades: "1,440", flag: "new", seed: 14 },
  { name: "GOOGLx Mean Revert", nameZh: "GOOGLx 均值回归", pair: "GOOGLx/USDC", days: 51, ret: "+9.4%", up: true, capital: "$58k", trades: "658", seed: 17 },
  { name: "SPYx DCA", nameZh: "SPYx 定投", pair: "SPYx/USDC", days: 140, ret: "+6.2%", up: true, capital: "$210k", trades: "214", seed: 20 },
  { name: "PAXG Rotator", nameZh: "PAXG 轮动", pair: "PAXG/USDC", days: 66, ret: "+2.9%", up: true, capital: "$39k", trades: "96", seed: 23 },
  { name: "TRUMP Grid", nameZh: "TRUMP 网格", pair: "TRUMP/USDC", days: 38, ret: "−3.4%", up: false, capital: "$21k", trades: "361", flag: "paper", seed: 26 },
];
