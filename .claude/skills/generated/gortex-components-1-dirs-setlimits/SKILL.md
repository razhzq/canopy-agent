---
name: gortex-components-1-dirs-setlimits
description: "Work in the components +1 dirs · SetLimits area — 30 symbols across 3 files (90% cohesion)"
---

# components +1 dirs · SetLimits

30 symbols | 3 files | 90% cohesion

## When to Use

Use this skill when working on files in:
- `components/buildStrategy.tsx`
- `components/setLimits.tsx`
- `lib/api.ts`

## Key Files

| File | Symbols |
|------|---------|
| `components/buildStrategy.tsx` | value, setRule, key |
| `components/setLimits.tsx` | Field, draft, setMode, reading, err, ... |
| `lib/api.ts` | prompt, composeAgent, token |

## Entry Points

- `components/setLimits.tsx::SetLimits`
- `components/setLimits.tsx::Field`

## Connected Communities

- **components · EquityView** (1 cross-edges)
- **lib · request** (1 cross-edges)

## How to Explore

```
get_communities with id: "community-47"
smart_context with task: "understand components +1 dirs · SetLimits", format: "gcx"
find_usages with id: "components/setLimits.tsx::SetLimits", format: "gcx"
```

_`format: "gcx"` returns the [GCX1 compact wire format](../../docs/wire-format.md) — round-trippable, ~27% fewer tokens than JSON. Drop it for JSON output; agents using `@gortex/wire` or the Go `github.com/gortexhq/gcx-go` package decode either._
