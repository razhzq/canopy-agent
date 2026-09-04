"use client";

import { useEffect, useRef } from "react";

/**
 * Venue logos flying into the hero's right margin.
 *
 * Six marks start in a line off the left edge, take off one after another,
 * flutter across on a decaying figure-eight (the loops read as a butterfly's
 * flight — wide at first, tightening as each one nears its perch), and settle
 * on a half circle hugging the right edge. Once landed they breathe: a slow
 * bob and a faint tilt, so the group never looks pinned.
 *
 * Plain requestAnimationFrame over positioned <img>s: no GPU pipeline, no
 * dependency, crisp PNGs, and it degrades to the final arrangement for
 * anyone who asked for reduced motion.
 */

const LOGOS = [
  { src: "/venues/meteora.png", alt: "Meteora" },
  { src: "/venues/solana.png", alt: "Solana" },
  { src: "/venues/robinhood.png", alt: "Robinhood" },
  { src: "/venues/jupiter.png", alt: "Jupiter" },
  { src: "/venues/uniswap.png", alt: "Uniswap" },
  { src: "/venues/kalqix.png", alt: "KalqiX" },
];

const SIZE = 52;         // tile diameter, px
const FLIGHT_MS = 2600;  // one logo's flight
const STAGGER_MS = 420;  // gap between take-offs
const RADIUS = 150;      // half-circle radius
const ARC_FROM = 110;    // degrees; the arc runs 110° → 250°, bulging left,
const ARC_TO = 250;      // and never reaches the clipped right edge
const LOOPS = 1.5;       // figure-eights per flight

const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);

export function HeroOrbit() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const tiles = Array.from(el.querySelectorAll<HTMLElement>(".orb"));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Perches: a half circle bulging left from a centre just past the right
    // edge, spread evenly from the top of the arc to the bottom.
    const perch = (i: number) => {
      const W = el.clientWidth;
      const H = el.clientHeight;
      const cx = W - 6;
      const cy = H / 2;
      const span = ARC_TO - ARC_FROM;
      const deg = ARC_FROM + (span * i) / (LOGOS.length - 1);
      const a = (deg * Math.PI) / 180;
      return { x: cx + RADIUS * Math.cos(a) - SIZE / 2, y: cy + RADIUS * Math.sin(a) - SIZE / 2 };
    };
    // Launch line: off the left edge, one row, in take-off order.
    const launch = (i: number) => ({ x: -SIZE * 2 - i * (SIZE + 14), y: el.clientHeight / 2 - SIZE / 2 });

    const place = (t: HTMLElement, x: number, y: number, rot: number, s: number) => {
      t.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rot}deg) scale(${s})`;
    };

    if (reduce) {
      tiles.forEach((t, i) => {
        const p = perch(i);
        t.style.opacity = "1";
        place(t, p.x, p.y, 0, 1);
      });
      return;
    }

    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      const elapsed = now - t0;
      tiles.forEach((t, i) => {
        const local = elapsed - i * STAGGER_MS;
        if (local < 0) {
          t.style.opacity = "0";
          return;
        }
        const from = launch(i);
        const to = perch(i);
        const p = Math.min(local / FLIGHT_MS, 1);
        const e = easeOut(p);
        // Base flight plus a decaying figure-eight. The first loop is wide
        // (butterfly), the last vanishes as it lands.
        const amp = 90 * (1 - e);
        const th = 2 * Math.PI * LOOPS * p;
        const ox = amp * Math.sin(th);
        const oy = amp * 0.6 * Math.sin(2 * th);
        const x = from.x + (to.x - from.x) * e + ox;
        const y = from.y + (to.y - from.y) * e + oy;
        // Tilt with the vertical velocity of the loop, fading out at landing.
        const rot = 18 * Math.cos(2 * th) * (1 - e);

        if (p < 1) {
          t.style.opacity = String(Math.min(1, p * 4));
          place(t, x, y, rot, 0.8 + 0.2 * e);
          return;
        }
        // Landed: breathe.
        const idle = (local - FLIGHT_MS) / 1000;
        const bob = Math.sin(idle * 1.1 + i * 1.3) * 4;
        const sway = Math.sin(idle * 0.7 + i) * 2;
        t.style.opacity = "1";
        place(t, to.x, to.y + bob, sway, 1);
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="orbit" ref={host} aria-hidden>
      {LOGOS.map((l) => (
        <span className="orb" key={l.src}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static
              brand marks, sized by CSS */}
          <img src={l.src} alt={l.alt} />
        </span>
      ))}
    </div>
  );
}
