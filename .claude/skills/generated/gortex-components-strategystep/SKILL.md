---
name: gortex-components-strategystep
description: "Work in the components · StrategyStep area — 24 symbols across 5 files (89% cohesion)"
---

# components · StrategyStep

24 symbols | 5 files | 89% cohesion

## When to Use

Use this skill when working on files in:
- `components/addMarket.tsx`
- `components/buildStrategy.tsx`
- `components/pickRoute.tsx`
- `components/setLimits.tsx`
- `components/wizard.tsx`

## Key Files

| File | Symbols |
|------|---------|
| `components/addMarket.tsx` | n, fmt |
| `components/buildStrategy.tsx` | pick, patch, values, key, active, ... |
| `components/pickRoute.tsx` | ModeCard, pair, PickRoute, jupiterPrice, jupiterDepth |
| `components/setLimits.tsx` | RuleChip, on |
| `components/wizard.tsx` | PillRow, PillTag, StepHead, Pill |

## Entry Points

- `components/buildStrategy.tsx::StrategyStep`
- `components/pickRoute.tsx::PickRoute`

## Connected Communities

- **components · EquityView** (1 cross-edges)
- **components +1 dirs · SetLimits** (1 cross-edges)

## How to Explore

```
get_communities with id: "community-13"
smart_context with task: "understand components · StrategyStep", format: "gcx"
find_usages with id: "components/buildStrategy.tsx::StrategyStep", format: "gcx"
```

_`format: "gcx"` returns the [GCX1 compact wire format](../../docs/wire-format.md) — round-trippable, ~27% fewer tokens than JSON. Drop it for JSON output; agents using `@gortex/wire` or the Go `github.com/gortexhq/gcx-go` package decode either._
