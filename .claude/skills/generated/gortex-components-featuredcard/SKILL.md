---
name: gortex-components-featuredcard
description: "Work in the components · FeaturedCard area — 35 symbols across 3 files (79% cohesion)"
---

# components · FeaturedCard

35 symbols | 3 files | 79% cohesion

## When to Use

Use this skill when working on files in:
- `components/marketplace.tsx`
- `components/strategyDetail.tsx`
- `components/ui.tsx`

## Key Files

| File | Symbols |
|------|---------|
| `components/marketplace.tsx` | capital, ret, open, points, points, ... |
| `components/strategyDetail.tsx` | today, peak, n, v, diff, ... |
| `components/ui.tsx` | Badge |

## Entry Points

- `components/marketplace.tsx::StatRail`
- `components/marketplace.tsx::FeaturedCard`
- `components/marketplace.tsx::CompactCard`
- `components/strategyDetail.tsx::DayRow`

## Connected Communities

- **components · EquityView** (2 cross-edges)

## How to Explore

```
get_communities with id: "community-27"
smart_context with task: "understand components · FeaturedCard", format: "gcx"
find_usages with id: "components/marketplace.tsx::StatRail", format: "gcx"
```

_`format: "gcx"` returns the [GCX1 compact wire format](../../docs/wire-format.md) — round-trippable, ~27% fewer tokens than JSON. Drop it for JSON output; agents using `@gortex/wire` or the Go `github.com/gortexhq/gcx-go` package decode either._
