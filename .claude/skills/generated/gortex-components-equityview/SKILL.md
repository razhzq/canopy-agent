---
name: gortex-components-equityview
description: "Work in the components · EquityView area — 44 symbols across 5 files (77% cohesion)"
---

# components · EquityView

44 symbols | 5 files | 77% cohesion

## When to Use

Use this skill when working on files in:
- `components/charts.tsx`
- `components/equity.tsx`
- `components/myAgents.tsx`
- `components/publish.tsx`
- `components/strategyDetail.tsx`

## Key Files

| File | Symbols |
|------|---------|
| `components/charts.tsx` | DayBlocks |
| `components/equity.tsx` | s, hitRate, Stat, v, deployed, ... |
| `components/myAgents.tsx` | n, money |
| `components/publish.tsx` | n, thin, days, pct, Stat, ... |
| `components/strategyDetail.tsx` | Stat |

## Entry Points

- `components/equity.tsx::EquityView`
- `components/publish.tsx::Body`

## Connected Communities

- **components · FeaturedCard** (1 cross-edges)

## How to Explore

```
get_communities with id: "community-24"
smart_context with task: "understand components · EquityView", format: "gcx"
find_usages with id: "components/equity.tsx::EquityView", format: "gcx"
```

_`format: "gcx"` returns the [GCX1 compact wire format](../../docs/wire-format.md) — round-trippable, ~27% fewer tokens than JSON. Drop it for JSON output; agents using `@gortex/wire` or the Go `github.com/gortexhq/gcx-go` package decode either._
