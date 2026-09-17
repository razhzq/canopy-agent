// The fund side of Atlas: 50 firms from the Crypto Fund Research list, Q3 2026.
//
// Generated from CryptoFundList-2026-Q3.xlsx and trimmed to firm-level facts.
// The workbook also carries named contacts, emails and LinkedIn profiles; none
// of that is copied here, because a benchmark page has no use for people.
//
// Units, so nobody has to guess at a call site:
// - aumUsdM is millions of USD. For generalist firms it is blockchain assets or
//   cumulative blockchain deal value only (the list's own note 1).
// - change12m / change24m are PERCENT (19.3 means +19.3%), change in reported
//   AUM. That includes inflows, so it is not a trading return.
// - founded is the first blockchain investment for generalists (note 2).
// null means the list does not report the figure. It never means zero.

export type FundType = "hedge" | "venture" | "pe";

export interface Fund {
  name: string;
  type: FundType;
  focus: string | null;
  city: string | null;
  country: string | null;
  aumUsdM: number | null;
  change12m: number | null;
  change24m: number | null;
  staff: number | null;
  founded: number | null;
  cryptoOnly: boolean | null;
  secRegistered: boolean;
}

export const FUND_EDITION = "Q3 2026";

export const FUNDS: Fund[] = [
  {name: "100 & 100 Venture Capital", type: "venture", focus: "Early Stage", city: "Seoul", country: "South Korea", aumUsdM: null, change12m: null, change24m: null, staff: 9, founded: 2017, cryptoOnly: true, secRegistered: false},
  {name: "11-11 Ventures", type: "venture", focus: null, city: "Atlanta", country: "United States", aumUsdM: null, change12m: null, change24m: null, staff: 7, founded: null, cryptoOnly: false, secRegistered: false},
  {name: "1confirmation", type: "hedge", focus: "FX", city: "Palo Alto", country: "United States", aumUsdM: 556.0, change12m: 6.8, change24m: -82.8, staff: 4, founded: 2017, cryptoOnly: true, secRegistered: true},
  {name: "21M Capital", type: "venture", focus: "Early Stage", city: "Tel Aviv", country: "Israel", aumUsdM: null, change12m: null, change24m: null, staff: null, founded: 2018, cryptoOnly: true, secRegistered: false},
  {name: "21Shares AG", type: "hedge", focus: null, city: "Zug", country: "Switzerland", aumUsdM: 110, change12m: 46.0, change24m: 34.9, staff: 21, founded: null, cryptoOnly: true, secRegistered: true},
  {name: "3iQ", type: "hedge", focus: "FX", city: "Toronto", country: "Canada", aumUsdM: 10, change12m: null, change24m: null, staff: 69, founded: 2012, cryptoOnly: true, secRegistered: false},
  {name: "500 Startups", type: "venture", focus: "Early Stage", city: "San Francisco", country: "United States", aumUsdM: 55, change12m: null, change24m: null, staff: 22, founded: 2014, cryptoOnly: false, secRegistered: false},
  {name: "7 Blockchain", type: "hedge", focus: null, city: "San Francisco", country: "United States", aumUsdM: null, change12m: null, change24m: null, staff: 46, founded: 2018, cryptoOnly: true, secRegistered: false},
  {name: "Aaro Capital", type: "hedge", focus: "Fund of Funds", city: "London", country: "United Kingdom", aumUsdM: 15, change12m: null, change24m: null, staff: 43, founded: null, cryptoOnly: null, secRegistered: false},
  {name: "Abraxas Capital Management", type: "hedge", focus: "FX", city: "London", country: "United Kingdom", aumUsdM: 1045, change12m: null, change24m: null, staff: 75, founded: 2002, cryptoOnly: false, secRegistered: false},
  {name: "Abstract Ventures", type: "venture", focus: "Early Stage", city: "West Tiburon", country: "United States", aumUsdM: 18, change12m: null, change24m: null, staff: 6, founded: 2016, cryptoOnly: false, secRegistered: false},
  {name: "Accel Partners", type: "venture", focus: "Early Stage", city: "Palo Alto", country: "United States", aumUsdM: 23741.4, change12m: 23.0, change24m: 24.2, staff: 100, founded: 1983, cryptoOnly: false, secRegistered: true},
  {name: "Accolade Partners", type: "pe", focus: "Fund of Funds", city: "Washington", country: "United States", aumUsdM: 7063.2, change12m: 11.6, change24m: 20.9, staff: 16, founded: 2000, cryptoOnly: null, secRegistered: true},
  {name: "Accomplice", type: "venture", focus: "Early Stage", city: "Boston", country: "United States", aumUsdM: null, change12m: null, change24m: null, staff: 3, founded: 2015, cryptoOnly: false, secRegistered: false},
  {name: "Adela Investment", type: "hedge", focus: "Mining", city: "Nashville", country: "United States", aumUsdM: 2.7, change12m: null, change24m: null, staff: 52, founded: 2016, cryptoOnly: true, secRegistered: false},
  {name: "AGE Crypto", type: "hedge", focus: "Multi Strategy", city: "Los Angeles", country: "United States", aumUsdM: 60, change12m: null, change24m: null, staff: 10, founded: 2018, cryptoOnly: true, secRegistered: false},
  {name: "Agga Capital", type: "hedge", focus: "Quantitative", city: "Den Haag", country: "Netherlands", aumUsdM: null, change12m: null, change24m: null, staff: 13, founded: 2017, cryptoOnly: true, secRegistered: false},
  {name: "Aglae Ventures", type: "venture", focus: "Web3", city: "Paris", country: "France", aumUsdM: null, change12m: null, change24m: null, staff: 2, founded: 2017, cryptoOnly: false, secRegistered: false},
  {name: "AI8 Ventures", type: "venture", focus: "Early Stage", city: "San Francisco", country: "United States", aumUsdM: null, change12m: null, change24m: null, staff: 13, founded: 2015, cryptoOnly: false, secRegistered: false},
  {name: "Akuna Capital", type: "hedge", focus: "Quantitative", city: "Chicago", country: "United States", aumUsdM: 5336.2, change12m: null, change24m: null, staff: 941, founded: 2011, cryptoOnly: false, secRegistered: true},
  {name: "alfjoli", type: "hedge", focus: "Fund of Funds", city: "Chappaqua", country: "New York", aumUsdM: 10, change12m: null, change24m: null, staff: null, founded: 2022, cryptoOnly: true, secRegistered: false},
  {name: "Algoz", type: "hedge", focus: "Quantitative", city: "Raanana", country: "Israel", aumUsdM: null, change12m: null, change24m: null, staff: 14, founded: 2018, cryptoOnly: true, secRegistered: false},
  {name: "Alice Capital", type: "hedge", focus: null, city: "Hong Kong", country: "Hong Kong", aumUsdM: null, change12m: null, change24m: null, staff: null, founded: 2017, cryptoOnly: true, secRegistered: false},
  {name: "All Blue Capital", type: "pe", focus: null, city: "Mayfair", country: "United Kingdom", aumUsdM: 1000, change12m: null, change24m: null, staff: 11, founded: 2015, cryptoOnly: false, secRegistered: false},
  {name: "Alpha Sigma Capital", type: "venture", focus: null, city: "El Segundo", country: "United States", aumUsdM: 100, change12m: null, change24m: null, staff: 9, founded: null, cryptoOnly: true, secRegistered: false},
  {name: "Alphemy Capital", type: "hedge", focus: null, city: "Geneva", country: "Switzerland", aumUsdM: 245.9, change12m: null, change24m: null, staff: null, founded: 2019, cryptoOnly: true, secRegistered: false},
  {name: "Alt Tab Capital Ltd", type: "hedge", focus: null, city: "Road Town", country: "British Virgin Islands", aumUsdM: 35, change12m: null, change24m: null, staff: 4, founded: 2021, cryptoOnly: true, secRegistered: false},
  {name: "AltaIR Capital", type: "venture", focus: "Early Stage", city: "Herzliya", country: "Israel", aumUsdM: 20, change12m: null, change24m: null, staff: 20, founded: 2010, cryptoOnly: false, secRegistered: false},
  {name: "Altana Wealth", type: "hedge", focus: "Long/Short", city: "Monaco", country: "Monaco", aumUsdM: 14, change12m: null, change24m: null, staff: 34, founded: 2016, cryptoOnly: false, secRegistered: false},
  {name: "Altonomy", type: "hedge", focus: null, city: "Singapore", country: "Singapore", aumUsdM: null, change12m: null, change24m: null, staff: 156, founded: 2018, cryptoOnly: true, secRegistered: false},
  {name: "Amber AI Group", type: "hedge", focus: "Quantitative", city: "Shenzhen", country: "China", aumUsdM: 40, change12m: null, change24m: null, staff: 9, founded: 2018, cryptoOnly: false, secRegistered: false},
  {name: "AME Cloud Ventures", type: "venture", focus: "Early Stage", city: "Palo Alto", country: "United States", aumUsdM: 55, change12m: null, change24m: null, staff: 15, founded: 2012, cryptoOnly: false, secRegistered: false},
  {name: "Amentum Investment Management", type: "hedge", focus: "FX", city: "San Francisco", country: "United States", aumUsdM: 10, change12m: null, change24m: null, staff: 6, founded: 2017, cryptoOnly: true, secRegistered: false},
  {name: "Amino Capital", type: "venture", focus: "Early Stage", city: "Palo Alto", country: "United States", aumUsdM: 148.0, change12m: 3.8, change24m: -96.3, staff: 9, founded: 2012, cryptoOnly: false, secRegistered: true},
  {name: "Amphibian Capital", type: "hedge", focus: null, city: "Tempte", country: "United States", aumUsdM: 108, change12m: null, change24m: null, staff: null, founded: null, cryptoOnly: null, secRegistered: false},
  {name: "Amplify ETFs", type: "hedge", focus: "ETF", city: "Wheaton", country: "United States", aumUsdM: 112.3, change12m: 88.8, change24m: 157.3, staff: 22, founded: 2014, cryptoOnly: false, secRegistered: true},
  {name: "Andreessen Horowitz", type: "venture", focus: "Early Stage", city: "Menlo Park", country: "United States", aumUsdM: 74739.8, change12m: 33.4, change24m: 40.4, staff: 535, founded: 2009, cryptoOnly: false, secRegistered: true},
  {name: "Animoca Brands", type: "venture", focus: "Web3", city: "Hong Kong", country: "Hong Kong", aumUsdM: null, change12m: null, change24m: null, staff: 6, founded: 2014, cryptoOnly: true, secRegistered: false},
  {name: "Antler", type: "venture", focus: null, city: "Amsterdam", country: "The Netherlands", aumUsdM: null, change12m: null, change24m: null, staff: 104, founded: 2017, cryptoOnly: false, secRegistered: false},
  {name: "Apollo Capital Management", type: "hedge", focus: "Multi Strategy", city: "Cremorne", country: "Australia", aumUsdM: 239070.9, change12m: 15.7, change24m: 35.5, staff: 2909, founded: 2018, cryptoOnly: true, secRegistered: true},
  {name: "Aquiline Technology Growth", type: "pe", focus: "FX", city: "New York", country: "United States", aumUsdM: 9574.1, change12m: 14.9, change24m: 30.8, staff: 3, founded: 2005, cryptoOnly: false, secRegistered: true},
  {name: "Arbor Ventures", type: "venture", focus: "Early Stage", city: "Hong Kong", country: "Hong Kong", aumUsdM: 5, change12m: null, change24m: null, staff: null, founded: 2015, cryptoOnly: false, secRegistered: false},
  {name: "Arca Funds", type: "hedge", focus: "Event Driven", city: "Los Angeles", country: "United States", aumUsdM: 7, change12m: null, change24m: null, staff: 46, founded: 2018, cryptoOnly: true, secRegistered: false},
  {name: "Arcane Crypto", type: "venture", focus: "Accelerator", city: "Oslo", country: "Norway", aumUsdM: null, change12m: null, change24m: null, staff: 3, founded: null, cryptoOnly: true, secRegistered: false},
  {name: "Archetype", type: "venture", focus: null, city: "New York", country: "United States", aumUsdM: 310, change12m: null, change24m: null, staff: 16, founded: 2021, cryptoOnly: null, secRegistered: false},
  {name: "Arrano Capital", type: "venture", focus: null, city: "Hong Kong", country: "Hong Kong", aumUsdM: 100, change12m: null, change24m: null, staff: 3, founded: 2020, cryptoOnly: true, secRegistered: false},
  {name: "Arrington XRP Capital", type: "hedge", focus: null, city: "Seattle", country: "United States", aumUsdM: 628.9, change12m: 22.9, change24m: -80.6, staff: 10, founded: 2017, cryptoOnly: true, secRegistered: true},
  {name: "Artesian", type: "venture", focus: "Early Stage", city: "Sydney", country: "Australia", aumUsdM: null, change12m: null, change24m: null, staff: 14, founded: 2004, cryptoOnly: false, secRegistered: false},
  {name: "Arturo Capital", type: "hedge", focus: null, city: "Golden Valley", country: "United States", aumUsdM: null, change12m: null, change24m: null, staff: 116, founded: 2018, cryptoOnly: true, secRegistered: false},
  {name: "Asha Capital Partners", type: "hedge", focus: "Fund of Funds", city: "Coral Springs", country: "United States", aumUsdM: 15.5, change12m: null, change24m: null, staff: 20, founded: 2021, cryptoOnly: true, secRegistered: false},
];
