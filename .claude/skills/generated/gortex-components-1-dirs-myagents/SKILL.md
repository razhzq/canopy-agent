---
name: gortex-components-1-dirs-myagents
description: "Work in the components +1 dirs · MyAgents area — 30 symbols across 3 files (83% cohesion)"
---

# components +1 dirs · MyAgents

30 symbols | 3 files | 83% cohesion

## When to Use

Use this skill when working on files in:
- `app/workspace/page.tsx`
- `components/agentDetail.tsx`
- `components/myAgents.tsx`

## Key Files

| File | Symbols |
|------|---------|
| `app/workspace/page.tsx` | MyAgentsPage |
| `components/agentDetail.tsx` | Cell |
| `components/myAgents.tsx` | rows, base, sum30d, any, authenticated, ... |

## Entry Points

- `components/myAgents.tsx::MyAgents`

## Connected Communities

- **components · EquityView** (2 cross-edges)
- **components · AgentDetailView** (1 cross-edges)

## How to Explore

```
get_communities with id: "community-30"
smart_context with task: "understand components +1 dirs · MyAgents", format: "gcx"
find_usages with id: "components/myAgents.tsx::MyAgents", format: "gcx"
```

_`format: "gcx"` returns the [GCX1 compact wire format](../../docs/wire-format.md) — round-trippable, ~27% fewer tokens than JSON. Drop it for JSON output; agents using `@gortex/wire` or the Go `github.com/gortexhq/gcx-go` package decode either._
