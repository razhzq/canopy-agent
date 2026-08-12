# Canopy Agent Stack — agent.canopy.finance

The agent marketplace, deploy wizard, monitoring and creator tooling, built from
`~/Desktop/canopy-agent-stack.pen`.

```bash
npm install
npm run dev       # localhost:3004
npm run build
npm run start
```

Next.js 16 (App Router) + React 19 + Tailwind v4. Standalone repo — extracted
from `canopy-fe-mono/packages/canopy-agent` on 2026-08-04.

## Routes

| Design frame | Route |
|---|---|
| 01 Agent Listing | `/agents` |
| 02 Agent Detail | `/agents/[slug]` |
| 03 Deploy — Describe | `/deploy/describe` |
| 04 Deploy — Constraints | `/deploy/constraints` |
| 05 Deploy — Autonomy | `/deploy/autonomy` |
| 06 Deploy — Wallet | `/deploy/wallet` |
| 07 Deploy — Fund | `/deploy/fund` |
| 08 Monitor | `/portfolio/[slug]` |
| 09 Cycles Index | `/portfolio/[slug]/cycles` |
| 10 Cycle Trace — Council | `/portfolio/[slug]/cycles/[cycle]` |
| 11 Build Agent | `/build/new` |
| 12 Publish Gate | `/build/new/publish` |

The creator dashboard that used to sit at `/build` is gone. It existed as a
place to bounce out to when the naming modal was cancelled; cancelling now
returns to the page the builder was opened from (see `components/routeMemory.tsx`),
and `/workspace` is where a creator's own agents live.

## Layout

Everything is presentational — copy and figures live in `lib/data.ts`, so wiring
a real API means replacing that module, not touching the screens.

- `components/ui.tsx` — badges, stat rails, section heads, callouts, buttons,
  and the 1004 / 436 `Columns` split the design uses on every two-column page.
- `components/charts.tsx` — equity and drawdown bars, sparklines, tick rulers,
  segment meters, histograms. All pure CSS, no chart library.
- `components/wizard.tsx` — the five-step bar, mandate rail and choice cards
  shared by the deploy and build flows.
- `lib/data.ts` — the dataset, plus seeded generators so bar series stay
  identical between the server and client render.

Design tokens are declared once in `app/globals.css` under `@theme`, copied
verbatim from the `.pen` file's variables.

## Gotcha: never gitignore `build`

`app/build/` is a route directory. A bare `build` entry in `.gitignore` (the
usual Next.js boilerplate has one) makes git skip it **and** makes Tailwind skip
it — its source scanner ignores gitignored paths — so every utility class used
only in those files goes ungenerated. It fails quietly: the build succeeds and
the pages render half-unstyled.

Two guards are in place; keep both:

- `.gitignore` deliberately has no `build` rule, with a comment saying why.
- `app/globals.css` declares its sources explicitly with `@source`.
