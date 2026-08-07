---
name: gortex-agents-1-dirs
description: "Work in the agents +1 dirs area — 27 symbols across 2 files (90% cohesion)"
---

# agents +1 dirs

27 symbols | 2 files | 90% cohesion

## When to Use

Use this skill when working on files in:
- `app/agents/page.tsx`
- `components/marketplace.tsx`

## Key Files

| File | Symbols |
|------|---------|
| `app/agents/page.tsx` | AgentsPage |
| `components/marketplace.tsx` | state, visible, tab, Marketplace, r, ... |

## Entry Points

- `components/marketplace.tsx::Marketplace`

## Connected Communities

- **components +1 dirs · useApi** (1 cross-edges)

## How to Explore

```
get_communities with id: "community-28"
smart_context with task: "understand agents +1 dirs", format: "gcx"
find_usages with id: "components/marketplace.tsx::Marketplace", format: "gcx"
```

_`format: "gcx"` returns the [GCX1 compact wire format](../../docs/wire-format.md) — round-trippable, ~27% fewer tokens than JSON. Drop it for JSON output; agents using `@gortex/wire` or the Go `github.com/gortexhq/gcx-go` package decode either._
