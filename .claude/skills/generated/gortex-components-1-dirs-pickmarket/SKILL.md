---
name: gortex-components-1-dirs-pickmarket
description: "Work in the components +1 dirs · PickMarket area — 23 symbols across 3 files (83% cohesion)"
---

# components +1 dirs · PickMarket

23 symbols | 3 files | 83% cohesion

## When to Use

Use this skill when working on files in:
- `components/pickMarket.tsx`
- `components/publish.tsx`
- `lib/api.ts`

## Key Files

| File | Symbols |
|------|---------|
| `components/pickMarket.tsx` | Note, PickMarket, chosen, cursor, rows, ... |
| `components/publish.tsx` | Note |
| `lib/api.ts` | UniverseAsset |

## Entry Points

- `components/pickMarket.tsx::PickMarket`

## Connected Communities

- **components +1 dirs · useApi** (1 cross-edges)
- **components · StrategyStep** (1 cross-edges)
- **components · EquityView** (1 cross-edges)

## How to Explore

```
get_communities with id: "community-37"
smart_context with task: "understand components +1 dirs · PickMarket", format: "gcx"
find_usages with id: "components/pickMarket.tsx::PickMarket", format: "gcx"
```

_`format: "gcx"` returns the [GCX1 compact wire format](../../docs/wire-format.md) — round-trippable, ~27% fewer tokens than JSON. Drop it for JSON output; agents using `@gortex/wire` or the Go `github.com/gortexhq/gcx-go` package decode either._
