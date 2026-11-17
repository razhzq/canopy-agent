# Canopy Agent — monorepo

Two deployable Next.js apps and the code they share (npm workspaces):

| Package | Deploys to | What |
|---|---|---|
| `packages/app` | app.canopy.finance (+ every white-label tenant host) | The product: Feed, Trade, agents, portfolio, build, settings. Privy sign-in lives here. |
| `packages/landing` | agent.canopy.finance | The landing page and `/research`. No Privy. Every other path 308-redirects to the same path on the app. |
| `packages/shared` | (not deployed) | Translations, tenant lookup, wordmark, language switcher, analytics, theme CSS. |

```bash
npm install            # once, at the repo root
npm run dev:app        # localhost:3004
npm run dev:landing    # localhost:3005
npm run build:app
npm run build:landing
npm run typecheck      # both
```

## Deploying (Vercel)

One Vercel project per package, both pointing at this repo:

| Vercel project | Root Directory | Domain |
|---|---|---|
| app | `packages/app` | app.canopy.finance |
| landing | `packages/landing` | agent.canopy.finance |

Leave the install command on the default; Vercel installs the workspace from the repo root.

- **app** env: as before (`NEXT_PUBLIC_CANOPY_API_URL`, `NEXT_PUBLIC_PRIVY_*`, `SOLANA_RPC_URL`, …). `app.canopy.finance` is a Canopy host out of the box; add any other (e.g. a staging domain) to `AGENT_PLATFORM_HOSTS`.
- **landing** env: `NEXT_PUBLIC_CANOPY_API_URL` (brand + GA id), `NEXT_PUBLIC_APP_URL` (default `https://app.canopy.finance`), optional `NEXT_PUBLIC_LANDING_URL`, `NEXT_PUBLIC_GA_ID`.
- Privy allowed origins need the **app** domain only.

Login and sign-up buttons on the landing page link to `<APP_URL>/agents`, carrying `?ref=` so referrals are still recorded by the app. The app has no page at `/`: it redirects to `/agents`, query string kept.

---

Next.js 16 (App Router) + React 19 + Tailwind v4. Standalone repo — extracted
from `canopy-fe-mono/packages/canopy-agent` on 2026-08-04.

## Tenants: one deployment, many brands

The app package serves Canopy **and every hosted white-label tenant** (canopy-be
`CANOPY_143`). The root layout reads the request host and asks canopy-be
`GET /api/agent-tenant/config?host=…` which tenant lives there; its name,
logos, accent colour, Privy app, quorum/policy ids, features and instruments
arrive with the page (`packages/shared/src/tenant/*`, `useTenant()`). Nothing tenant-specific
is a build-time constant.

- `app.canopy.finance`, `agent.canopy.finance`, `localhost` and `*.vercel.app` → Canopy.
- `<slug>.agent.canopy.finance` → that tenant; a tenant's custom domain → it.
- Unknown host → a plain "no app at this address" page.
- Translations say `{brand}` where they used to say "Canopy"; `t()` fills it.

Server env (runtime, not `NEXT_PUBLIC_`):

| Var | Use |
|---|---|
| `AGENT_TENANT_FORCE_SLUG` | Development: serve one tenant whatever the host (`lyfi`, `canopy`). |
| `AGENT_TENANT_BASE_DOMAIN` | Default `agent.canopy.finance`; tenants live at `<slug>.` under it. |
| `AGENT_PLATFORM_HOSTS` | Extra hosts that should be Canopy (comma list). |

`NEXT_PUBLIC_PRIVY_*` and `NEXT_PUBLIC_GA_ID` are now only Canopy's fallback,
used when canopy-be cannot be reached on a Canopy host. Tenants are created
and branded in the admin portal; see canopy-be `docs/agent-tenants.md`.
Hosting needs the wildcard `*.agent.canopy.finance` (and each custom domain)
attached to this project.

## Gotcha: `npm run dev` runs on webpack, not Turbopack

The `--webpack` flag in the `dev` script is load-bearing. **Do not remove it**
without re-running the check below.

On Next.js 16.2.6, Turbopack's HMR channel gets stuck asserting that the server
components changed. The client believes it and refetches the route — forever.
Measured on `/workspace/57` in a clean browser profile, doing nothing: **197
RSC requests in 20 seconds against 0 on webpack.** Every one carries
`next-hmr-refresh: 1`, so it is Next's own dev refresh looping, not a `<Link>`
prefetch and nothing in this repo.

It is worth knowing how it PRESENTS, because it looks like six other things:
pages that never finish loading, requests that appear to take 8-9 seconds (they
are queued behind hundreds of siblings, not slow), and a dev server log filling
with `GET /<route> 200` for a page nobody is navigating to. It happens on every
route, signed in or out, and never in `build` — so a production build looks
perfectly healthy while local development is unusable.

`npm run dev:turbo` keeps the Turbopack path for testing whether a later Next
release has fixed it. To check:

```bash
npm run dev:turbo
# then, with the page open and idle, watch the dev server log or the Network
# tab filtered to `_rsc`. Repeats = still broken.
```

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
