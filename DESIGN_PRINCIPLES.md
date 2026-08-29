# Canopy — Design Principles

Use this as the reference when revamping any page, so the product reads as one
system. Two sources, two altitudes:

- **§1–9 — the look.** Distilled from the landing page (`app/(marketing)`,
  `components/canopyLanding/`). Where the landing scopes its own copy of the
  tokens under `.cnp`, the same values live in `app/globals.css` for the rest of
  the app — keep them in sync.
- **§10 — the sequence.** Distilled from the agent-creation flow: what a screen
  says the first time someone reaches it, and in what order it asks.

Below both sits **`components/kit.tsx`** — twelve numbered rules and the tokens
that enforce them, extracted from the deposit and withdraw dialogs. That file is
the authority on a single surface: what leads, what gets a border, what gets a
callout. If it and this document ever disagree about an in-app screen, the kit
is right. Read its header before building one.

---

## 1. Palette

Near-black ground, a single mint accent, cool neutrals. Warmth comes from
imagery, never from the UI.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#050505` | page ground |
| `--surface` | `#0A0A0A` | cards, panels |
| `--elevated` / `--elevated-2` | `#111111` / `#151515` | hovered / inset surfaces |
| `--border` | `#1A1A1A` | hairline dividers |
| `--border-accent` | `#1E3A30` | green-tinted border on accented cards |
| `--accent` | `#5ED3B3` | **the** brand mint — primary accent |
| `--accent-2` | `#3AAE92` | deeper mint (gradients, hovers) |
| `--accent-dim` | `#1A3D33` | mint fills/tints |
| `--text` | `#EDEDED` | primary text |
| `--text-2` | `#8A8A8A` | secondary text |
| `--text-3` | `#555555` | muted / captions **(never over imagery — see §6)** |
| `--loss` | `#E5484D` | negative / down |
| `--hot` | `#F2A64D` | "hot" flags only |

Rules:
- **Positive/up is mint** (`--accent`), not a separate green. Down is `--loss`.
- Mint is the *only* accent. Don't introduce a second UI accent colour.
- Text selection: mint background, `#031611` text.
- Amber (`--hot`) is reserved for "hot" tags; never a general accent.

## 2. Typography

Three roles, deliberately paired:

- **Display wordmark** — `NT Brick Sans` (chunky pixel face), mint, with a hard
  offset shadow. **Only** for the `canopy` wordmark / oversized brandmark. Never
  body or headings.
- **Sans** — `Inter Tight` (`--sans`) for headings and prose.
- **Mono** — `JetBrains Mono` (`--mono`) for eyebrows, numbered labels, data,
  tickers, tags, captions, fine print.

Scale & weight:
- Display headline: `clamp(40px, 6vw, 78px)`, **weight 300** (light, calm).
- Section title: `clamp(28px, 3.6vw, 52px)`, **weight 300**.
- Lede: 17–18px, `--text-2`.
- Body: 14–15px.
- Eyebrow: 11px mono, `uppercase`, `letter-spacing: .2em`, mint, often with a
  small line-icon.
- Headings are light-weight on purpose — the calm register is part of the brand.
- **Highlight the key phrase of a heading in mint** (`.mint`), the rest in
  `--text`. One highlight per heading.

## 3. Layout

- Content max-width **1200px**, 28px gutters.
- **Spacious** vertical rhythm — sections ~96px+ padding; let things breathe.
- Standard section rhythm: **mono eyebrow (+icon) → light title (mint on the key
  phrase) → grey sub → content**.
- Hero fills the first screen (`.fold` pins ticker + hero to the viewport).
- Cards: dark surface, 1px subtle border, radius 16–22px; on hover the border
  brightens and/or the card lifts a few px.
- **Breakpoints are min-width and they cascade in source order.** Write the
  small layout on the bare class and widen upward (`grid-cols-1` →
  `sm:grid-cols-[…]`). Never `lg:grid-cols-1 sm:grid-cols-[…]`: `lg` is emitted
  after `sm`, so above 1024px the *narrow* rule wins and the desktop layout
  silently collapses to a stack — correct only in the 640–1023px band nobody
  develops in. A control in a collapsed 1-column grid stretches to the
  container, which is how a 52px toggle ends up spanning the page.

## 4. Motion

Elegant, restrained, and always reduced-motion-safe.

- **Scroll reveal**: `opacity 0→1`, `translateY(30px→0)`, `blur(8px→0)` over
  **1s `cubic-bezier(.16, 1, .3, 1)`** (ease-out-expo). Add a small per-item
  stagger across a row/grid (~90ms steps). Implemented as `.rv` → `.in` via an
  IntersectionObserver.
- **Hero entrance**: choreograph the hero children in on load (eyebrow → headline
  → lede → CTAs → trust), staggered.
- **Parallax**: layered scroll transforms so depth reads — background image
  slowest (~0.22×), mid motifs ~0.34×, foreground particles ~0.5×, copy ~0.16×
  and fading as it leaves. rAF-throttled (one transform per frame).
- **Always** honour `@media (prefers-reduced-motion: reduce)` — disable reveals,
  parallax, entrance, and ambient loops.

## 5. Imagery

One consistent painted world, used sparingly and always legible.

- **Style**: cinematic, painterly, subtle **film grain**; cool near-black
  palette with **mint** as the warm-ish accent (match `--accent`). No orange/gold.
- **Recurring motifs**: glowing **mint ring-portals** (the signature), Earth /
  lunar-space scenes, slender tower spires, bioluminescent flora, floating light
  motes. A lone figure for scale/wonder.
- **Grain**: a faint fractal-noise overlay sits across the whole page.
- **Legibility over art is non-negotiable**: every image gets a scrim (radial +
  linear) plus soft text-shadows on the copy, and fades to `--bg` at its edges.
  Never place `--text-3` (muted) copy over a bright image — brighten it first.
- Prompt guidance for new art lives with the hero; keep rings mint and the scene
  cool so generated images sit natively in the palette.

## 6. Chrome & components

- **Nav**: a floating translucent panel (backdrop-blur + soft shadow, **no hard
  border**) over the hero — not a full-width bar.
- **Buttons are pills**:
  - Primary — **solid mint** (`--accent`, text `#04120e`), soft mint glow shadow.
  - Ghost — glassy translucent (blur, subtle green-tinted border).
- **Ticker**: mono marquee, hairline top/bottom, edge-masked.
- **Glassy circular badges / pills** for overlays on imagery.
- **Device mocks** (e.g. iPhone) are built in **CSS/SVG**, not image assets —
  titanium-edge bezel, inner rim, side buttons, screen glare.

## 7. Voice & copy

- Calm, confident, concrete. Short sentences. No hype, no overclaiming.
- **Say what things are, from the user's side.** Name the metric the owner
  configured; don't invent product vocabulary.
- **Vocabulary bans**:
  - Not **"mobile"** and not **"app"** — Canopy runs in the browser. Say
    "in your browser", "on the go", "wherever you are".
  - Agents are **autonomous within caps** — frame as *"runs on autopilot / you
    watch, they work"*, never "the agent proposes a trade and you approve".
- **Number formatting** (any surface that shows figures): money with thousands
  separators and `$`; percentages with `%` and trimmed decimals; indices (RSI…)
  bare with no unit; operators as `≥` / `≤`. Format by the metric's type; keep
  the raw metric key visible for technical users.

## 8. i18n & self-containment

- All copy goes through i18n keys — **English and Chinese** kept at parity
  (`lib/i18n/en`, `lib/i18n/zh`). A missing key breaks the build, by design.
- **Never translate** product identifiers: symbols (`AAPLx`, `SOL`), model names
  (`cQWEN3`, `DeepSeek-V3`), venue/brand names, agent display names.
- Keep a surface's styles self-contained and scoped (the landing lives entirely
  under `.cnp` in `components/canopyLanding/`, tokens re-declared locally) so a
  page can be lifted or removed without side effects.

## 9. Accessibility checklist

- Legible contrast over imagery (scrim + shadow), verified on the brightest frame.
- Visible keyboard focus states.
- Decorative layers `aria-hidden`.
- Reduced-motion path disables all motion.
- Wide content (tables, tickers) scrolls within its own container — the page body
  never scrolls sideways.

## 10. Flows & first run

Surface rules live in `components/kit.tsx` (twelve of them, applied by hand
where a primitive does not fit). These are the ones about *sequence* — what a
screen says the first time someone reaches it, and in what order it asks.

- **Onboarding is not management.** A panel that reports balance, spend and
  history is right for a thing with a history and wrong for one that is four
  seconds old. Do not point one at the other: split the component. Reusing the
  management panel as the first-run step is what produced a *$0.00* balance, a
  *$0.00* spend, "no cycles measured yet", "nothing recorded yet" and an **Out
  of model balance** warning, all at once, as the first thing the product said
  to someone who had just finished building an agent.
- **Absence of history is not data.** A figure that is structurally guaranteed
  to be zero is not a reading; rendering it as one asks the reader to interpret
  a number that means nothing yet. Show no figure.
- **Never open on a failure nobody has caused.** "Out of" is a sentence about
  running out. A thing that has never been filled has not run out, and greeting
  a new account with a hazard colour teaches people that the warning tone is
  noise.
- **Show the whole job before asking for the first part of it.** Every step of a
  multi-step commitment is drawn from the first frame — dimmed, unpressable, and
  carrying the value it will ask for. See kit rule 12. A second wallet signature
  that appears only after the first one lands is an ambush.
- **Ask where the context is, not where the form is.** Collect a decision on the
  screen that holds the facts it depends on, and let the later screen *confirm*
  it. The bundle size needs the model, its price ceiling and the cadence — all
  three live in step 3 and none survive into the funding step, so asking there
  meant asking with the context gone.
- **Reassurance sits next to the control, not inside the warning.** The same
  sentence reads as an excuse under a hazard heading and as an answer beside the
  button. Put it where the hesitation is.
- **Do not offer to undo a decision made five seconds ago.** A prominent "change
  it" beside the thing just chosen competes with the step the reader is actually
  on. Demote it, or move it to the page where changing it is a real task.
- **Leaving is an outcome, not an escape.** If stopping half-way is safe, say so
  in a sentence and give it a label — "Do this later", with what happens if they
  do. An X in the corner makes an ordinary choice feel like abandonment.
- **Name the act, not the mechanism** — at first contact. "Give it a wallet"
  where the reader has not met delegation; "Grant delegation" later, where the
  precise term is the useful one. Same component, overridable label.
