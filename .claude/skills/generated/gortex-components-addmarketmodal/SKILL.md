---
name: gortex-components-addmarketmodal
description: "Work in the components · AddMarketModal area — 29 symbols across 1 files (90% cohesion)"
---

# components · AddMarketModal

29 symbols | 1 files | 90% cohesion

## When to Use

Use this skill when working on files in:
- `components/addMarket.tsx`

## Key Files

| File | Symbols |
|------|---------|
| `components/addMarket.tsx` | router, onKey, getAccessToken, setError, setBusy, ... |

## Entry Points

- `components/addMarket.tsx::AddMarketModal`

## Connected Communities

- **components · EquityView** (1 cross-edges)
- **components · StrategyStep** (1 cross-edges)

## How to Explore

```
get_communities with id: "community-2"
smart_context with task: "understand components · AddMarketModal", format: "gcx"
find_usages with id: "components/addMarket.tsx::AddMarketModal", format: "gcx"
```

_`format: "gcx"` returns the [GCX1 compact wire format](../../docs/wire-format.md) — round-trippable, ~27% fewer tokens than JSON. Drop it for JSON output; agents using `@gortex/wire` or the Go `github.com/gortexhq/gcx-go` package decode either._
