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
  name: string;
  market: string;
  ret: string;
  up: boolean;
  capital: string;
  trades: string;
  flag?: "hot" | "new" | "paper";
  flagLabel?: string;
  seed: number;
};

export const AGENTS: Agent[] = [
  { name: "AAPLx Dip Catcher", market: "AAPLx/USDC · 94d", ret: "+24.1%", up: true, capital: "$182k", trades: "928", flag: "hot", flagLabel: "Hot", seed: 2 },
  { name: "COINx Volatility", market: "COINx/USDC · 8d", ret: "+31.5%", up: true, capital: "$44k", trades: "1,884", flag: "new", flagLabel: "New", seed: 5 },
  { name: "SOL Momentum", market: "SOL/USDC · 12d", ret: "+18.0%", up: true, capital: "$97k", trades: "1,612", seed: 8 },
  { name: "JitoSOL Trend", market: "JitoSOL/USDC · 73d", ret: "+12.6%", up: true, capital: "$130k", trades: "870", seed: 11 },
  { name: "TSLAx Momentum", market: "TSLAx/USDC · 21d", ret: "+11.8%", up: true, capital: "$64k", trades: "1,440", flag: "new", flagLabel: "New", seed: 14 },
  { name: "GOOGLx Mean Revert", market: "GOOGLx/USDC · 51d", ret: "+9.4%", up: true, capital: "$58k", trades: "658", seed: 17 },
  { name: "SPYx DCA", market: "SPYx/USDC · 140d", ret: "+6.2%", up: true, capital: "$210k", trades: "214", seed: 20 },
  { name: "PAXG Rotator", market: "PAXG/USDC · 66d", ret: "+2.9%", up: true, capital: "$39k", trades: "96", seed: 23 },
  { name: "TRUMP Grid", market: "TRUMP/USDC · 38d", ret: "−3.4%", up: false, capital: "$21k", trades: "361", flag: "paper", flagLabel: "Paper", seed: 26 },
];
