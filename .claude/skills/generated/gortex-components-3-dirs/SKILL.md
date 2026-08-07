---
name: gortex-components-3-dirs
description: "Work in the components +3 dirs area — 54 symbols across 6 files (83% cohesion)"
---

# components +3 dirs

54 symbols | 6 files | 83% cohesion

## When to Use

Use this skill when working on files in:
- `app/agents/[slug]/page.tsx`
- `app/portfolio/[slug]/cycles/[cycle]/page.tsx`
- `app/portfolio/[slug]/cycles/page.tsx`
- `components/portfolio.tsx`
- `components/strategyDetail.tsx`
- `components/ui.tsx`

## Key Files

| File | Symbols |
|------|---------|
| `app/agents/[slug]/page.tsx` | strategyId, StrategyPage, slug |
| `app/portfolio/[slug]/cycles/[cycle]/page.tsx` | slug, CycleTracePage, cycle, agentId |
| `app/portfolio/[slug]/cycles/page.tsx` | slug, CyclesPage, agentId |
| `components/portfolio.tsx` | raw, setRaw, Seat, lines, TraceMark, ... |
| `components/strategyDetail.tsx` | Fact, days, day, live, iso, ... |
| `components/ui.tsx` | Breadcrumb |

## Entry Points

- `components/strategyDetail.tsx::StrategyDetail`
- `components/portfolio.tsx::Seat`
- `components/portfolio.tsx::CycleTrace`

## Connected Communities

- **components +1 dirs · useApi** (3 cross-edges)
- **components · EquityView** (2 cross-edges)
- **components · FeaturedCard** (1 cross-edges)

## How to Explore

```
get_communities with id: "community-42"
smart_context with task: "understand components +3 dirs", format: "gcx"
find_usages with id: "components/strategyDetail.tsx::StrategyDetail", format: "gcx"
```

_`format: "gcx"` returns the [GCX1 compact wire format](../../docs/wire-format.md) — round-trippable, ~27% fewer tokens than JSON. Drop it for JSON output; agents using `@gortex/wire` or the Go `github.com/gortexhq/gcx-go` package decode either._
