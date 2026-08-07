---
name: gortex-lib-request
description: "Work in the lib · request area — 74 symbols across 1 files (93% cohesion)"
---

# lib · request

74 symbols | 1 files | 93% cohesion

## When to Use

Use this skill when working on files in:
- `lib/api.ts`

## Key Files

| File | Symbols |
|------|---------|
| `lib/api.ts` | deployAgent, token, getStrategyRecord, token, getUniverse, ... |

## How to Explore

```
get_communities with id: "community-63"
smart_context with task: "understand lib · request", format: "gcx"
```

_`format: "gcx"` returns the [GCX1 compact wire format](../../docs/wire-format.md) — round-trippable, ~27% fewer tokens than JSON. Drop it for JSON output; agents using `@gortex/wire` or the Go `github.com/gortexhq/gcx-go` package decode either._
