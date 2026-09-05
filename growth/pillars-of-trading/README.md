# The Pillars of Trading — Instagram carousel

Eight 1080×1080 slides, in upload order. Slide 1 is the feed thumbnail and
carries the whole post.

| # | File | Pillar |
|---|------|--------|
| 1 | `01-cover.png` | Cover — six uneven columns |
| 2 | `02-edge.png` | EDGE |
| 3 | `03-risk.png` | RISK |
| 4 | `04-patience.png` | PATIENCE |
| 5 | `05-discipline.png` | DISCIPLINE |
| 6 | `06-process.png` | PROCESS |
| 7 | `07-time.png` | TIME |
| 8 | `08-close.png` | Close — the six under one lintel |

Post as a **photo carousel**, not through the Reels composer. Attach music:
carousels with audio get surfaced into the Reels feed.

## Caption

> **The Pillars of Trading**
>
> Most people look for the one thing that makes trading work. There isn't one.
> There are six, and they only hold weight together.
>
> **1. Edge** — A reason your trades make money that survives the fees. Without
> it you're paying for the privilege of being busy.
>
> **2. Risk** — Your first job is to still be here next month. Size so that
> being wrong is survivable, because you will be wrong often.
>
> **3. Patience** — The setup arrives on its own schedule. Most of trading is
> not trading.
>
> **4. Discipline** — A plan you abandon under pressure was never a plan. The
> rules exist precisely for the moments you don't want to follow them.
>
> **5. Process** — Judge the decision, not the outcome. Good trades lose and bad
> trades win; only the process tells you which one you made.
>
> **6. Time** — Edge is small per trade and enormous across thousands.
> Compounding is the only part that does the work for you.
>
> Remove one pillar and the whole thing comes down. Which one is weakest for you
> right now? 👇

## Regenerating

The slides are hand-authored SVG, not AI-generated raster — `src/gen.py` draws
every stroke. Jittered Catmull-Rom paths give the ink its wobble; each line is
laid down twice at slightly different offsets for the double-inked look.

```sh
cd src
python3 gen.py            # writes the .svg and .html files
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for f in 0*.html; do
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=1 --virtual-time-budget=4000 \
    --window-size=1080,1080 --screenshot="${f%.html}.png" "file://$PWD/$f"
done
```

Recolour, reword, resize (1350×1080 for the taller IG crop) or add a pillar by
editing `gen.py` and re-running — no redrawing.

## Design notes

- Paper `#F2EBDD`, ink `#23201C`, accent ochre `#B0702A`.
- The wordmark is the real `public/canopy-wordmark.png`, embedded as base64 so
  each SVG stays self-contained. It carries the navbar mint `#5ED3B3` natively.
- Every slide contains a drawn stone column — that through-line is what makes
  the eight read as one set rather than eight unrelated sketches.
- Mint on cream is a soft pairing. It holds at full size but goes quiet at feed
  scale; if that bothers you, bump the wordmark height in `lockup()` or invert
  the set to the product's dark ground (`--color-bg: #0B100E`).
