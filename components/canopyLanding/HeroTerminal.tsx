"use client";

import { useEffect, useRef } from "react";
import { useT } from "@/lib/i18n";

interface Props {
  onLogin: () => void;
}

/** Where each glowing ring sits and how large it is — the recurring motif. */
const RINGS = [
  { d: 340, x: "8%", y: "24%", o: 0.9 },
  { d: 520, x: "62%", y: "-10%", o: 0.7 },
  { d: 260, x: "80%", y: "40%", o: 0.85 },
  { d: 180, x: "42%", y: "6%", o: 0.5 },
];

/**
 * The hero: a cinematic, near-black field with the mint ring motif and a
 * light-weight centred headline, mirroring canopyfinance.io's opening while
 * keeping Canopy's palette and copy.
 *
 * The rings and fireflies are painted from data rather than hand-written into
 * the markup so the field stays easy to retune, and both are decorative —
 * everything a reader needs is in the text above them, so a reduced-motion
 * visitor loses nothing when the fireflies hold still.
 */
export function HeroTerminal({ onLogin }: Props) {
  const t = useT();
  const flies = useRef<HTMLDivElement>(null);
  const rings = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = flies.current;
    if (!host || host.childElementCount > 0) return;
    // A deterministic-enough scatter: index-derived so it does not need
    // Math.random and stays stable across renders.
    for (let i = 0; i < 24; i++) {
      const s = document.createElement("i");
      const gx = (i * 61) % 100;
      const gy = (i * 37) % 100;
      s.style.left = `${gx}%`;
      s.style.top = `${gy}%`;
      s.style.animationDelay = `${(i % 7) * 0.9}s`;
      s.style.opacity = `${0.3 + ((i * 13) % 60) / 100}`;
      host.appendChild(s);
    }
  }, []);

  // Parallax: the ring field, the fireflies and the copy drift at different
  // rates as the page scrolls, so the hero has depth rather than moving as one
  // flat plane — the same effect the reference site opens with. Written against
  // rAF so a burst of scroll events collapses to one transform per frame, and
  // skipped entirely for anyone who asked for reduced motion.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const y = window.scrollY;
      // Only pay for the work while the hero is still on screen.
      if (y > window.innerHeight) return;
      if (rings.current) rings.current.style.transform = `translate3d(0, ${y * 0.34}px, 0)`;
      if (flies.current) flies.current.style.transform = `translate3d(0, ${y * 0.5}px, 0)`;
      if (inner.current) {
        inner.current.style.transform = `translate3d(0, ${y * 0.16}px, 0)`;
        inner.current.style.opacity = String(Math.max(0, 1 - y / 620));
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    apply();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <header className="hero" id="top">
      <div className="rings" ref={rings} aria-hidden>
        {RINGS.map((r, i) => (
          <span
            key={i}
            className="ring"
            style={{ width: r.d, height: r.d, left: r.x, top: r.y, opacity: r.o }}
          />
        ))}
      </div>
      <div className="particles" ref={flies} aria-hidden />
      <div className="meadow" aria-hidden />
      <div className="wrap">
        <div className="hero-inner" ref={inner}>
          <span className="eyebrow center">{t("ld_hero_eyebrow")}</span>
          <h1 className="h1">
            {t("ld_hero_h1_a")}
            <span className="mint">{t("ld_hero_h1_mint")}</span>
          </h1>
          <p className="lede">{t("ld_hero_lede")}</p>
          <div className="hero-cta">
            <button className="btn btn-primary" onClick={onLogin}>
              {t("ld_hero_cta")} <span className="arw">→</span>
            </button>
            <a href="#market" className="btn btn-ghost">
              {t("ld_hero_browse")}
            </a>
          </div>
          <div className="trust">
            <span>
              <i className="dot" /> {t("ld_trust_noncustodial")}
            </span>
            <span>
              <i className="dot" /> {t("ld_trust_paper")}
            </span>
            <span>
              <i className="dot" /> {t("ld_trust_routing")}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
