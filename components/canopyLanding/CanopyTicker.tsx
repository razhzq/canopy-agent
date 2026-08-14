"use client";

import { TICKERS } from "./data";

/**
 * The scrolling price belt.
 *
 * Lifted out of `CanopyBody`, where it was the first block and therefore sat
 * directly BELOW the hero. It reads better directly below the nav: a market
 * ticker is context for everything under it, and the page now opens with
 * evidence that the market is live before it starts making claims about it.
 *
 * Its own component rather than markup inlined into the page, because it is a
 * band with its own borders and its own animation — and because leaving it in
 * `CanopyBody` while rendering it elsewhere would put its position in one file
 * and its content in another.
 *
 * The list is DUPLICATED on purpose. The track scrolls exactly -50% and loops,
 * so the second copy is what makes the wrap seamless; with one copy the belt
 * visibly snaps back at the end of each pass.
 */
export function CanopyTicker() {
  return (
    <div className="ticker">
      <div className="ticker-track">
        {[0, 1].map((dup) =>
          TICKERS.map((t) => (
            <div className="tick" key={`${dup}-${t.sym}`}>
              <span className="sym">{t.sym}</span>
              <span className="px">${t.px}</span>
              <span className={t.up ? "up" : "down"}>{t.chg}</span>
            </div>
          )),
        )}
      </div>
    </div>
  );
}
