---
name: gortex-lib-narratedecision
description: "Work in the lib · narrateDecision area — 49 symbols across 2 files (98% cohesion)"
---

# lib · narrateDecision

49 symbols | 2 files | 98% cohesion

## When to Use

Use this skill when working on files in:
- `lib/api.ts`
- `lib/narrate.ts`

## Key Files

| File | Symbols |
|------|---------|
| `lib/api.ts` | pnl, won, s, ExitRules, closed, ... |
| `lib/narrate.ts` | narrateDecision, str, ScreenStepShape, props, narrateCycle, ... |

## Entry Points

- `lib/narrate.ts::narrateDecision`

## How to Explore

```
get_communities with id: "community-67"
smart_context with task: "understand lib · narrateDecision", format: "gcx"
find_usages with id: "lib/narrate.ts::narrateDecision", format: "gcx"
```

_`format: "gcx"` returns the [GCX1 compact wire format](../../docs/wire-format.md) — round-trippable, ~27% fewer tokens than JSON. Drop it for JSON output; agents using `@gortex/wire` or the Go `github.com/gortexhq/gcx-go` package decode either._
