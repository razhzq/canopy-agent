---
name: gortex-components-row
description: "Work in the components · Row area — 20 symbols across 1 files (85% cohesion)"
---

# components · Row

20 symbols | 1 files | 85% cohesion

## When to Use

Use this skill when working on files in:
- `components/myAgents.tsx`

## Key Files

| File | Symbols |
|------|---------|
| `components/myAgents.tsx` | setBusy, equity, wallet, error, equity, ... |

## Entry Points

- `components/myAgents.tsx::Row`

## Connected Communities

- **components · EquityView** (1 cross-edges)
- **components · FeaturedCard** (1 cross-edges)
- **components · AgentDetailView** (1 cross-edges)

## How to Explore

```
get_communities with id: "community-31"
smart_context with task: "understand components · Row", format: "gcx"
find_usages with id: "components/myAgents.tsx::Row", format: "gcx"
```

_`format: "gcx"` returns the [GCX1 compact wire format](../../docs/wire-format.md) — round-trippable, ~27% fewer tokens than JSON. Drop it for JSON output; agents using `@gortex/wire` or the Go `github.com/gortexhq/gcx-go` package decode either._
