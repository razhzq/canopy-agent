// The execution-footprint model behind /research. Pure functions, no React.
//
// WHAT IS MEASURED AND WHAT IS ASSUMED
//
// Measured (live Jupiter quotes and GeckoTerminal trades, JUP, Oct 2026):
//   - CURVE: average cost of a JUP buy by size, from $10k slices to a $500k
//     single swap (~323 bps).
//   - The size mix of everyone else's trades: median $75, 99% under ~$1.5k.
// Assumed, and labelled as such on the page:
//   - HALF_LIFE: how fast the price recovers from each of the fund's trades.
//   - FRONT_RUN: what other traders add once they notice a large trade.
//   - PROP_SHARE / MM_FLAG: the market maker's view.
//
// Every random draw is seeded, so the page shows the same story on every load
// and the server never has to agree with the client about a random number.

export const ORDER = 500_000;
export const WALLETS = 15; // fund-owned execution wallets in Canopy's pool
export const P99 = 1_525; // 99th percentile JUP trade size (USD)
export const CANOPY_HOURS = 19; // time to buy $500k at ~10% of market volume
const HALF_LIFE = 3; // minutes
const FRONT_RUN = 4; // bps added per noticed trade
export const PROP_SHARE = 0.6; // share of each trade filled by one market maker pool
export const MM_FLAG = 40_000; // flow per wallet at which that pool's operator flags it

const CURVE: [number, number][] = [
  [0, 0], [10_000, 1.2], [25_000, 5], [50_000, 7.5], [100_000, 12], [250_000, 104], [500_000, 323],
];

export function costBps(size: number): number {
  for (let i = 1; i < CURVE.length; i++) {
    const [x1, y1] = CURVE[i - 1];
    const [x2, y2] = CURVE[i];
    if (size <= x2) return y1 + ((y2 - y1) * (size - x1)) / (x2 - x1);
  }
  return CURVE[CURVE.length - 1][1];
}

export type LaneKind = "big" | "diy" | "canopy";

export interface Trade {
  t: number; // minutes from start
  s: number; // USD
}

export interface FundTrade extends Trade {
  w: number; // wallet index
  prop: number; // USD filled by the market maker pool
  cost: number; // bps vs fair price, including carry-over and front-running
  spotted: boolean;
}

export interface LaneData {
  kind: LaneKind;
  horizon: number; // minutes
  unit: "min" | "h";
  organic: Trade[];
  fund: FundTrade[];
  path: Float32Array; // price paid vs fair price, bps
}

function rng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(r: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const HORIZON: Record<LaneKind, number> = { big: 45, diy: 45, canopy: CANOPY_HOURS * 60 };
const SEED: Record<LaneKind, number> = { big: 7, diy: 3, canopy: 11 };

export function buildLane(kind: LaneKind): LaneData {
  const horizon = HORIZON[kind];
  const r = rng(SEED[kind]);

  const organic: Trade[] = [];
  const n = Math.round(horizon * 10);
  for (let i = 0; i < n; i++) {
    const s = Math.min(34_000, Math.max(2, Math.exp(Math.log(75) + 1.295 * normal(r))));
    organic.push({ t: r() * horizon, s });
  }
  organic.sort((a, b) => a.t - b.t);

  const raw: { t: number; s: number; w: number }[] = [];
  if (kind === "big") raw.push({ t: 3, s: ORDER, w: 0 });
  else if (kind === "diy") for (let i = 0; i < 20; i++) raw.push({ t: 2 + i * 2.1, s: 25_000, w: 0 });
  else {
    // each wallet has its own typical trade size, so wallets don't look alike
    const centers = Array.from({ length: WALLETS }, () => Math.exp(Math.log(350) + r() * Math.log(1100 / 350)));
    let sum = 0;
    const picks: { w: number; s: number }[] = [];
    while (sum < ORDER) {
      const w = Math.floor(r() * WALLETS);
      const s = Math.min(1450, Math.max(250, centers[w] * Math.exp(0.35 * normal(r))));
      picks.push({ w, s });
      sum += s;
    }
    picks[picks.length - 1].s -= sum - ORDER;
    const step = (horizon - 15) / picks.length;
    picks.forEach((p, i) => raw.push({ t: 5 + step * (i + 0.5 + (r() - 0.5) * 0.8), s: p.s, w: p.w }));
    raw.sort((a, b) => a.t - b.t);
  }

  const fund: FundTrade[] = raw.map((f) => ({
    ...f,
    prop: f.s * (kind === "big" ? PROP_SHARE : Math.min(0.8, Math.max(0.4, PROP_SHARE + (r() - 0.5) * 0.4))),
    cost: 0,
    spotted: f.s > P99,
  }));

  // impact from the fund's own trades (D) decays; front-running drift (F) builds
  let D = 0;
  let F = 0;
  let Ft = 0;
  let last = 0;
  const advance = (t: number) => {
    const dt = t - last;
    if (dt <= 0) return;
    D *= Math.pow(0.5, dt / HALF_LIFE);
    F += (Ft - F) * (1 - Math.exp(-dt / 1.5));
    last = t;
  };
  const wobble = (t: number) =>
    1.1 * Math.sin((t / horizon) * 37) + 0.7 * Math.sin((t / horizon) * 91 + 1) + 0.4 * Math.sin((t / horizon) * 211 + 2);

  const M = 900;
  const path = new Float32Array(M + 1);
  let fi = 0;
  for (let j = 0; j <= M; j++) {
    const t = (j / M) * horizon;
    while (fi < fund.length && fund[fi].t <= t) {
      const f = fund[fi];
      advance(f.t);
      const c = costBps(f.s);
      f.cost = D + F + c;
      D += 2 * c;
      if (f.spotted) Ft += FRONT_RUN;
      fi++;
    }
    advance(t);
    path[j] = D + F + wobble(t);
  }

  return { kind, horizon, unit: kind === "canopy" ? "h" : "min", organic, fund, path };
}

export interface LaneStats {
  bought: number;
  extra: number; // USD
  avgBps: number;
  spotted: number;
  trades: number;
  wallets: number;
  flagged: number;
  propByWallet: Map<number, number>;
}

/** Everything the lane shows at `minute` into its horizon. */
export function statsAt(lane: LaneData, minute: number): LaneStats {
  let bought = 0;
  let wcost = 0;
  let spotted = 0;
  let trades = 0;
  const used = new Set<number>();
  const propByWallet = new Map<number, number>();
  for (const f of lane.fund) {
    if (f.t > minute) break;
    trades++;
    used.add(f.w);
    bought += f.s;
    wcost += f.s * f.cost;
    if (f.spotted) spotted++;
    propByWallet.set(f.w, (propByWallet.get(f.w) ?? 0) + f.prop);
  }
  const avgBps = bought ? wcost / bought : 0;
  let flagged = 0;
  for (const v of propByWallet.values()) if (v > MM_FLAG) flagged++;
  return { bought, extra: (avgBps / 1e4) * bought, avgBps, spotted, trades, wallets: used.size, flagged, propByWallet };
}

/** Wallet tints stay inside the green family: lighter on the dark panel, deeper on white. */
export function walletColor(w: number, ground: "dark" | "light"): string {
  const h = 148 + ((w * 11) % 30);
  const s = 52 + ((w * 7) % 18);
  const l = ground === "dark" ? 46 + ((w * 17) % 38) : 26 + ((w * 17) % 30);
  return `hsl(${h} ${s}% ${l}%)`;
}
