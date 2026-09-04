# Canopy — Design Principles

What the landing rebuild (`components/landing/`) established, written down so
every new surface reads as the same product. The constant is **clean and
modern**. Ground, layout and density are choices made per section; the rules
below say what makes any of those choices look clean.

Tokens and values are lifted from `components/landing/landing.css`. The
previous system lives at `docs/design-principles-dark-legacy.md`; its §10
(flow and first-run sequencing) still applies to the app and is not restated.
Reference: `docs/design-ref-public-agents.md`.

---

## 1. What "clean" means here

1. **One idea per container.** A section makes one claim. A card or cell
   holds one thought, one figure, or one miniature — never two of them.
2. **Hairlines separate; nothing floats.** On any ground, edges are 1px
   lines. Shadows exist only to lift a miniature off a well, or a toast off a
   panel. Cards on the page ground never cast one.
3. **Colour is a signal.** Each section gets one accent moment: a halo, a
   meter fill, a live pill, a sparkline, a fade. Text is never the accent.
4. **Show the product, not a picture of it.** Where a site would put an icon
   or an illustration, put a faithful miniature of the real UI.
5. **Whitespace is structure.** Consistent gaps, generous padding, and one
   grid per container. Nothing is nudged by hand.
6. **Quiet type, tight and light.** Hierarchy comes from size and cut, not
   weight or colour.

If a layout satisfies all six it is allowed, whatever shape it takes.

## 2. Grounds

Two grounds, equal standing. Choose per section for rhythm; alternate them,
never mix them inside one container.

### Light

| Token | Value | Use |
|---|---|---|
| `--bg` | `#FFFFFF` | page and cards (same white; borders do the separating) |
| `--ink` | `#0B1410` | headlines, primary buttons, nav |
| `--body` | `#33403A` | paragraphs |
| `--muted` | `#8A968F` | captions, placeholders, inactive tabs |
| `--line` | `#E6EBE8` | every hairline |
| `--chip` | `#EEF3F0` | selected segment, tag fill |
| `--green-deep` | `#1FA97A` | the accent when it must read on white |
| second headline line | `#A8B3AD` | |

### Dark

| Token | Value | Use |
|---|---|---|
| panel / section | `#0B100E` | ground |
| card | `#151A17` | cells, nodes |
| card, emphasised | `#12171A` | the one highlighted card |
| border | `#262D29` | every hairline |
| grid line | `#1B221E` | faint construction lines |
| text | `#FFFFFF` / `#E8ECEA` | headings / body |
| meta | white at 45–55% | timestamps, labels |
| `--green` | `#5ED3B3` | the accent; safe on dark |
| check circle | `#1E4A38` fill, green tick | |

Shared: `--loss` `#E5484D` for negative deltas on either ground.

Rules:
- **Green is the only accent.** No amber, blue or violet. On white use
  `--green-deep` for anything that must be read; `--green` is for dark.
- **Buttons are ink on light and white on dark.** Never green.
- **A dark section on a light page has a radius** (20px) when it is a panel
  inside the flow, and none when it is full-bleed. Either is fine; pick one
  per section.

## 3. Typography

One family with two cuts, plus mono for figures. Same on both grounds.

| Role | Face | Size | Weight | Tracking | Leading |
|---|---|---|---|---|---|
| Display headline | Inter Tight (`--display`) | `clamp(40px, 5.2vw, 72px)` | 300 | `-.03em` | 1.02 |
| Section title | Inter Tight | `clamp(32px, 4vw, 56px)` | 300 | `-.03em` | 1.06 |
| Card / column title | Inter (`--sans`) | 18–30px | 400–500 | `-.01em` | 1.2 |
| Eyebrow | Inter | 16px | 400 | 0 | 1.4 |
| Body | Inter | 15–18px | 400 | 0 | 1.5 |
| Chip / tag | Inter | 11–12.5px | 500 | 0 | 1 |
| Figures | IBM Plex Mono (`--mono`) | 11–32px | 400 | `-.02em` above 20px | — |

- Headlines are light, never bold. Section titles run two lines: the claim,
  then a muted second line.
- Sentence case. Headlines end with a full stop.
- Every number is mono. The words around it are not.
- The wordmark is the pixel image `public/canopy-wordmark.png`, 24px in the
  nav; never typeset.

## 4. Layouts

A catalogue, not a sequence. Any of these may follow any other. What keeps a
page coherent is the shared header, the shared tokens, and the gap rhythm.

**Section header** — eyebrow, two-line title, optional one-sentence lede,
centred, 72px above the content. Every section starts this way.

**Hero** — header, one primary pill, one disclosure chip, then a dark demo
panel showing the product running. Decorative motion lives in the margins
(the orbit), never behind the copy.

**Split card** — one hairline container cut by one vertical hairline, halves
of title → preview well → body. For "two ways" choices.

**Feature row** — three or four columns under one hairline, each a title, a
short body and optionally one mono figure pinned to the bottom.

**Bento** — a grid of cells. Rules that keep a bento clean:
- one gap value throughout (12–16px), one radius (16px), one border colour;
- at most two cell sizes, and exactly one feature cell (the largest);
- the feature cell holds the miniature; every other cell holds one title,
  one line, and at most one figure;
- no gradients on cells; the accent appears in one cell only;
- cells are the card colour of the ground, never lighter and darker mixed.

**Dark panel** — a rounded dark container inside the light flow (the demo
panel, a spotlight prompt). Carries the section's colour: a green fade at the
foot or a halo behind the highlighted element.

**Carousel** — equal cards in a row, the selected one lifted 16px with a halo
behind it; two 40px circular outline arrows centred below.

**Preview well** — the inset gradient box (`#F7F9F8 → #FCFDFC` on light,
card colour on dark) that holds a miniature, fading out at the bottom.

Spacing constants: container 1280px with 28px gutters; inner containers
1060px; section padding 120px top and 96px bottom; card padding 32px sides,
48px top, 56px bottom; 72px from header to content.

## 5. Components

Defined once in `landing.css`; reuse the class.

- **Pill button (`.pill`)** — 42px in the nav, 56px in a hero, full radius,
  1px border. `.dark` is the primary. Hover lifts 1px. Arrow icons slide 3px.
- **Disclosure chip (`.disc`)** — 28px hairline chip for the one quiet link
  under a primary.
- **Segmented pill (`.seg`)** — white tray, selected segment in `--chip`,
  default on the left.
- **Prompt pill (`.ask`)** — 56px input, ink circular submit, soft shadow and
  a 6px green ring at 10%. The "AI" cue.
- **Category strip (`.cats`)** — chips in a hairline tray.
- **Marketplace card (`.mcard`)** — name and tags, 44px sparkline, hairline,
  four-column stat row (label 10px muted, value 14px mono). No avatar.
- **Watch strip (`.watch`)** — market label, live dot, rule in words, a
  meter from 0 to the firing threshold, mono footer with check cadence.
- **Demo nodes** — prompt (gradient hairline, halo), agent (chip, name,
  Active pill, timeline rows), market (tabs, mono price, delta, drawn
  sparkline, toast). Joined by 1px connectors with 8px white terminals.
- **Orbit tiles (`.orb`)** — 52px white circles holding brand marks;
  decorative and hidden under 1180px.

## 6. Motion

Easing `cubic-bezier(.2,.8,.2,1)`. Nothing bounces or spins.

- Hover: lift 1px in 180ms.
- Demo: prompts cycle every 7s; rows enter top-down at 150 / 550 / 950 /
  1350ms; sparkline draws over 1.6s; toast lands at 2.1s. Picking a prompt
  pins it.
- Orbit: take-offs 420ms apart, 2.6s figure-eight flights, then a 4px bob.
- Reduced motion is a full path: everything renders in its final state.

## 7. Copy, i18n, accessibility

- One line says who Canopy is; one sentence says what you can do.
- Product identifiers (tickers, venues, models, agent names) are never
  translated. Every other string goes through i18n, English and Chinese at
  parity, keys prefixed `lp_`.
- Demo content is illustrative and shaped like real data: a rule, the checks
  it ran, the fill it produced.
- Ink and body clear AA on white; white and `#E8ECEA` clear it on dark.
  Muted is for skippable text only.
- Decorative layers are `aria-hidden` and ignore the pointer. Mocks contain
  no real controls. Tab strips use `role="tablist"`.

## 8. Do not

- Do not put a shadow on a card on the page ground, light or dark.
- Do not colour a button, heading or link green.
- Do not set a headline bold or in a serif.
- Do not use gradients on cells, or mix cell tones inside one grid.
- Do not put two accent moments in one section.
- Do not use an icon or illustration where a miniature of the real UI fits.
- Do not mix the light and dark token sets inside one container.
