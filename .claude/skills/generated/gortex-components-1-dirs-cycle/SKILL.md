---
name: gortex-components-1-dirs-cycle
description: "Work in the components +1 dirs · Cycle area — 28 symbols across 2 files (97% cohesion)"
---

# components +1 dirs · Cycle

28 symbols | 2 files | 97% cohesion

## When to Use

Use this skill when working on files in:
- `components/activity.tsx`
- `lib/api.ts`

## Key Files

| File | Symbols |
|------|---------|
| `components/activity.tsx` | iso, headline, lines, total, running, ... |
| `lib/api.ts` | ActivityDecision, ActivityCycle |

## Entry Points

- `components/activity.tsx::Cycle`

## How to Explore

```
get_communities with id: "community-1"
smart_context with task: "understand components +1 dirs · Cycle", format: "gcx"
find_usages with id: "components/activity.tsx::Cycle", format: "gcx"
```

_`format: "gcx"` returns the [GCX1 compact wire format](../../docs/wire-format.md) — round-trippable, ~27% fewer tokens than JSON. Drop it for JSON output; agents using `@gortex/wire` or the Go `github.com/gortexhq/gcx-go` package decode either._
