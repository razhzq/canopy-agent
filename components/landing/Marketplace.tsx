"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useT } from "@/lib/i18n";
import { AGENTS } from "./data";

/**
 * The marketplace — an endless rail of agent cards on the dark ground.
 *
 * The rail drifts on its own and the pointer steers it: hover the right
 * half and it runs faster to the left, hover the left half and it reverses,
 * the further from the centre the faster. Whichever card is nearest the
 * centre is the highlighted one — lifted, gradient hairline, green halo (the
 * section's one accent) — unless the pointer is over a card, in which case
 * that card takes the highlight. The rail keeps steering underneath, so the
 * highlight hands from card to card as they pass. No arrows.
 *
 * The nine agents are rendered three times and the position wraps by one
 * set, so the rail never reaches an end. Numbers are illustrative; symbols
 * are real.
 */

const CARD_W = 300;
const GAP = 16;
const STEP = CARD_W + GAP;
const COPIES = 3;
const DRIFT = 28;      // px/s when the pointer is elsewhere
const STEER = 320;     // px/s at the rail's edge

/** A deterministic sparkline from the agent's seed: 16 points, 0..1. */
function spark(seed: number, up: boolean): number[] {
  let x = seed * 9301 + 49297;
  const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  const pts: number[] = [];
  let v = up ? 0.3 : 0.7;
  for (let i = 0; i < 16; i++) {
    v += (up ? 0.035 : -0.03) + (rnd() - 0.5) * 0.16;
    v = Math.max(0.05, Math.min(0.95, v));
    pts.push(v);
  }
  return pts;
}

export function Marketplace() {
  const t = useT();
  const { locale } = useLocale();
  const [on, setOn] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  // Steering input from the pointer, -1 (far left) … 1 (far right); null
  // when the pointer is off the rail.
  const steer = useRef<number | null>(null);

  useEffect(() => {
    const rail = host.current;
    const el = track.current;
    if (!rail || !el) return;
    const N = AGENTS.length;
    const SET = N * STEP;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Start with the middle copy's middle card under the centre.
    let pos = SET + Math.floor(N / 2) * STEP + CARD_W / 2;
    let vel = reduce ? 0 : DRIFT;
    let last = performance.now();
    let current = -1;
    let raf = 0;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      // Pointer left of centre: the rail moves right. Right of centre: it
      // moves left. Further out, faster.
      const target = steer.current === null ? (reduce ? 0 : DRIFT) : steer.current * STEER;
      vel += (target - vel) * Math.min(1, dt * 6);
      pos += vel * dt;
      if (pos >= 2 * SET) pos -= SET;
      if (pos < SET) pos += SET;

      const w = rail.clientWidth;
      el.style.transform = `translate3d(${w / 2 - pos}px, 0, 0)`;

      const j = Math.round((pos - CARD_W / 2) / STEP);
      const i = ((j % N) + N) % N;
      if (i !== current) {
        current = i;
        setOn(i);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onMove = (e: MouseEvent) => {
      const r = rail.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width; // 0..1
      const s = (x - 0.5) * 2;                   // -1..1
      // A dead zone in the middle so a resting pointer holds the rail.
      steer.current = Math.abs(s) < 0.12 ? 0 : Math.sign(s) * ((Math.abs(s) - 0.12) / 0.88);
    };
    const onLeave = () => (steer.current = null);
    rail.addEventListener("mousemove", onMove);
    rail.addEventListener("mouseleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      rail.removeEventListener("mousemove", onMove);
      rail.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  const W = 260, H = 48;

  return (
    <section className="market" id="market">
      <div className="wrap">
        <div className="sec-head">
          <span className="eyebrow">{t("lp_mkt_eyebrow")}</span>
          <h2 className="h2">
            {t("lp_mkt_h1")}
            <span>{t("lp_mkt_h2")}</span>
          </h2>
          <p className="lede">{t("lp_mkt_lede")}</p>
        </div>
      </div>

      <div className="rail" ref={host}>
        <div className="track" ref={track}>
          {Array.from({ length: COPIES }, (_, c) =>
            AGENTS.map((a, n) => {
              const pts = spark(a.seed, a.up).map((v, k) => [
                (k / 15) * W,
                H - 4 - v * (H - 8),
              ]);
              const stroke = a.up ? "#5ED3B3" : "#E5484D";
              return (
                <div
                  className={`acard${n === (hover ?? on) ? " on" : ""}`}
                  key={`${c}-${a.name}`}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(null)}
                >
                  <div className="ahead">
                    <div>
                      <b>{locale === "zh" ? a.nameZh : a.name}</b>
                      <small>{t("lp_mkt_meta", { pair: a.pair, days: String(a.days) })}</small>
                    </div>
                    {a.flag && <span className={`tag ${a.flag}`}>{t(`lp_mkt_${a.flag}`)}</span>}
                  </div>
                  <svg className="aspark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
                    <polyline
                      points={pts.map((p) => p.join(",")).join(" ")}
                      fill="none"
                      stroke={stroke}
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div className="astats">
                    <div>
                      <small>{t("lp_mkt_return")}</small>
                      <span className={a.up ? "up" : "down"}>{a.ret}</span>
                    </div>
                    <div>
                      <small>{t("lp_mkt_capital")}</small>
                      <span>{a.capital}</span>
                    </div>
                    <div>
                      <small>{t("lp_mkt_trades")}</small>
                      <span>{a.trades}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
