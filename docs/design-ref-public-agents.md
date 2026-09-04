# Design reference — Public.com "Agents" landing

Extracted from four screenshots taken 2026-09-05 (Public.com's Agents product
page). This is a *reference*. The system Canopy actually adopted from it is
written up in `DESIGN_PRINCIPLES.md`; read that for the rules. §7 below was
written before the light-ground rebuild and describes adapting these moves to
the old dark system, which now lives at `docs/design-principles-dark-legacy.md`.

Why it reads as clean: almost no colour, one serif display face doing all the
personality work, hairline borders, huge whitespace, and exactly one glowing
thing per section. Everything else is grey on white or grey on near-black.

---

## 1. Palette

They run two grounds — a white marketing ground and a near-black "product"
ground — and switch per section. Both use the same hairline logic.

### Light ground

| Role | Approx. value | Notes |
|---|---|---|
| page | `#FFFFFF` | pure white, no tint |
| card | `#FFFFFF` | same as page; separated only by border |
| card border | `#E9ECF0` | 1px hairline, cool grey |
| preview well (inset area inside a card) | `#F7F8FA → #FCFCFD` | vertical gradient, faded, holds a miniature UI mock |
| text primary | `#0F1A2B` | near-black slate, never pure black |
| text body | `#1F2A3A` | slightly lighter slate for paragraphs |
| text muted / second headline line | `#A8B3C2` | desaturated blue-grey, ~40% contrast drop |
| chip fill | `#EEF1F5` | pale slate |
| chip text | `#4A5568` | mid slate |
| "Active" pill | text `#6BB800`, border `#B6E36A`, fill transparent | lime, the only saturated hue on the light ground |

### Dark ground

| Role | Approx. value | Notes |
|---|---|---|
| page | `#0A0A0B` | near-black, neutral (not green-tinted) |
| card | `#131315` | one step up |
| card border | `#202024` | 1px hairline |
| text primary | `#FFFFFF` | |
| text body | `#C8CCD2` | |
| text muted | `#7E8590` | column headers, captions |
| chip fill | `#1E1E22` | with a tiny icon on the left |
| positive check | `#38C172` on `#1D3A2B` circle | timeline rows |
| loss | `#E5484D` | sparkline + delta |
| "Active" pill | text `#B4F03C`, border `#3E5A14` | lime again |
| spotlight | radial `#3A4B6E` → `#0A0A0B` | behind the prompt input |
| grid lines | `#1C1C20` | 1px, in the workflow diagram |
| bottom fade | `#0A0A0B → #5B6A8A` (≈35% alpha) | blue-tinted gradient at the foot of the diagram |

### The one "AI" accent

A soft iridescent halo — pink `#F5B8D6` → lavender `#C9B8F5` → peach `#F5D5B8`
— blurred ~40px and placed *behind* the single selected element (the focused
card in the carousel, the prompt node in the diagram). It never colours text
or fills. It is the only place the page uses more than one hue at once.

---

## 2. Typography

Two faces, three roles.

| Role | Face | Size | Weight | Tracking | Leading | Colour |
|---|---|---|---|---|---|---|
| Eyebrow | sans | 16px | 400 | 0 | 1.4 | text primary (light) / white (dark) |
| Display headline | **serif** | `clamp(40px, 4.2vw, 58px)` | 400 | `-0.02em` | 1.05 | text primary |
| Display second line | serif | same | 400 | `-0.02em` | 1.05 | **muted** (`#A8B3C2`) |
| Section lead | sans | 17–18px | 400 | 0 | 1.5 | body |
| Card title | sans | 28–30px | 400 | `-0.01em` | 1.2 | primary |
| Card body | sans | 16–17px | 400 | 0 | 1.5 | body |
| Column title | sans | 18px | 400 | 0 | 1.3 | muted (dark) / primary (light) |
| Chip / tag | sans | 12px | 500 | 0 | 1 | chip text |
| Timeline row | sans | 12px | 500 (label) / 400 (meta) | 0 | 1.3 | white / muted |
| Legal | sans | 11px | 400 | 0 | 1.5 | `#9AA3AE` |

The serif is a transitional/Didone-leaning display (very close to
**Instrument Serif**, free on Google Fonts; also near *Tiempos Headline* or
*Reckless*). Everything else is a neutral grotesk in the Inter / Suisse family.

Rules they follow:
- Headlines are **regular weight**, never bold. Contrast comes from the serif
  vs sans pairing and from size, not weight.
- The headline is split across two lines and the **second line drops to
  muted**. This is the single most recognisable move on the page.
- Sentence case everywhere. Headlines end with a full stop.
- Card titles are large (28px) but still regular weight.

---

## 3. Spacing and shape

| Thing | Value |
|---|---|
| Section vertical rhythm | ~120px between the headline block and the first card |
| Headline block → lead paragraph | 24px |
| Content max width | ~1060px for cards, ~760px for centred copy |
| Card padding | 32px |
| Card radius | 12–14px |
| Preview well radius | 10px |
| Chip radius | 6px, padding `4px 10px` |
| Pill input radius | full (9999px), height 96px in the hero, 56px in mocks |
| Circular button | 40px, 1px border, transparent fill |
| Hairline | always 1px, never 2 |
| Card grid gap | 0 in the two-column split (shared border); 16px in the carousel |

---

## 4. Signature components

**Split card.** One bordered container, two equal columns, a single vertical
hairline between them, no gap. Each half: title (28px) → preview well → body.
The well is a flat light-grey gradient box holding a miniature, slightly
blurred, bottom-faded mock of the real UI.

**Agent card (carousel).** Chip with icon (`⌘ Agent`) top-left, optional
`Active ●` lime pill top-right, 22px title, 16px body, category chips pinned
to the bottom. Cards are white on white; the selected card gets the
iridescent halo and lifts by ~16px. Nav is two 40px circular outline arrows
centred below.

**Prompt pill.** Full-radius input, dark glass fill (`#141416` at ~80%), 1px
`#2A2A2E` border, 22px placeholder text, white 64px circular submit button on
the right with a black arrow. Sits inside a radial blue-white spotlight.

**Workflow diagram.** Three nodes on a horizontal 1px line with 8px white
circle terminals at each join. Node 1 = prompt (dark card, halo, arrow
button). Node 2 = agent card with timeline rows (green check circle, bold
label, muted timestamp right-aligned, hairline between rows). Node 3 = asset
card with tabs, price, red delta, red sparkline, and a floating white toast
(`Order completed / Execution speed: 0.002s`) overlapping the top-right
corner. Faint 1px grid behind, blue gradient fade at the foot.

**Feature row.** Three columns under a full-width hairline. The active column
has a short 160px white line sitting on top of the hairline. Title muted,
body muted.

**Timeline row.** `[check] Label ....... meta` at 12px. Label medium weight,
meta right-aligned in muted. Rows separated by hairline, not spacing.

---

## 5. Motion (inferred from state, not observed)

- Selected carousel card: translateY(-16px) + halo opacity 0→1, ~300ms ease-out.
- Prompt pill: spotlight breathes (opacity 0.8↔1) slowly; submit button
  scales 1→1.05 on hover.
- Timeline rows appear top-down, staggered ~80ms.
- Nothing bounces. Nothing spins. Easing is `cubic-bezier(0.2, 0.8, 0.2, 1)`.

---

## 6. What makes it feel expensive (the checklist)

1. One serif display face, regular weight, tight leading, muted second line.
2. Hairlines only. No shadows on cards, ever. Elevation = halo or lift.
3. One glowing element per viewport. The halo is *behind* the element.
4. Real product UI inside preview wells, miniaturised and bottom-faded.
5. Near-black is neutral (`#0A0A0B`), not tinted, so the blue spotlight reads
   as colour.
6. Lime `Active` pill is the only status colour on the light ground.
7. Copy is short, sentence case, ends in full stops, and every headline is a
   claim ("Agents can do a lot.") followed by a softer muted line.
8. Disclaimers exist but are 11px and grey. They don't fight the layout.

---

## 7. Applying it to Canopy

Canopy already has the near-black ground and a single accent (mint). The gap
is typographic and in how "selected" is expressed. Concrete moves, in order
of impact:

1. **Add a serif display face.** Load `Instrument Serif` via `next/font` in
   `app/layout.tsx` as `--font-display`. Use it *only* for marketing
   headlines and the first-run screens' hero lines. Keep Inter for the app.
2. **Two-line headline with muted second line.** In `components/canopyLanding`
   the section headers should become: eyebrow (mono, as now) → serif line one
   in `--text` → serif line two in `--text-2`. Weight 400, `-0.02em`,
   leading 1.05.
3. **Replace the accent border on selected cards with a halo.** Where
   `--border-accent` (`#1E3A30`) is used to mark the chosen agent or plan,
   switch to a blurred radial behind the card. Keep it mint-based for Canopy
   (`#5ED3B3` → `#3AAE92` → transparent) rather than Public's pink/lavender,
   so the accent rule in `DESIGN_PRINCIPLES.md` §1 still holds.
4. **Preview wells.** The marketplace and "build an agent" cards should show a
   miniature of the real thread / strategy UI in an inset gradient box with a
   bottom fade, not an icon or illustration.
5. **Spotlight behind the prompt.** `HeroTerminal.tsx` can sit inside a
   radial `--accent-dim → --bg` glow instead of a flat panel. Make the input
   a full pill with a circular submit button.
6. **Workflow diagram for "how it works".** Prompt → agent thread → market
   card, joined by 1px lines with circle terminals. Canopy already has the
   three real components (build prompt, `agentThread.tsx`, market card); this
   is a layout, not new UI.
7. **Hairline discipline.** Canopy's `--border` (`#1A1A1A`) is already a
   hairline; the change is to stop pairing it with box-shadows on hover.
   Hover = lift 2px or border to `--elevated-2`, not shadow.

Do **not** copy: the light-ground sections (Canopy is dark-only per §1), the
lime status colour (mint is the status colour here), or the multi-hue halo.
