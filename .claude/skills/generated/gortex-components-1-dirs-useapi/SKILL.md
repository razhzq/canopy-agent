---
name: gortex-components-1-dirs-useapi
description: "Work in the components +1 dirs · useApi area — 52 symbols across 7 files (77% cohesion)"
---

# components +1 dirs · useApi

52 symbols | 7 files | 77% cohesion

## When to Use

Use this skill when working on files in:
- `components/activity.tsx`
- `components/creator.tsx`
- `components/portfolio.tsx`
- `components/publish.tsx`
- `components/states.tsx`
- `components/workspace.tsx`
- `lib/useApi.ts`

## Key Files

| File | Symbols |
|------|---------|
| `components/activity.tsx` | ActivityLog, anyRunning, fresh, empty, cycles, ... |
| `components/creator.tsx` | CreatorDashboard, counts, strategies, state, s, ... |
| `components/portfolio.tsx` | cycles, CycleList, state |
| `components/publish.tsx` | params, raw, Frame, strategyId, PublishScreen, ... |
| `components/states.tsx` | login, LoadingState, ready, SignedOutState, Frame, ... |
| `components/workspace.tsx` | state, Workspace, agent, router |
| `lib/useApi.ts` | latest, setState, ready, setNonce, useApi, ... |

## Entry Points

- `components/activity.tsx::ActivityLog`
- `components/publish.tsx::PublishScreen`
- `components/workspace.tsx::Workspace`
- `components/portfolio.tsx::CycleList`
- `components/creator.tsx::CreatorDashboard`

## Connected Communities

- **components · AgentDetailView** (1 cross-edges)

## How to Explore

```
get_communities with id: "community-46"
smart_context with task: "understand components +1 dirs · useApi", format: "gcx"
find_usages with id: "components/activity.tsx::ActivityLog", format: "gcx"
```

_`format: "gcx"` returns the [GCX1 compact wire format](../../docs/wire-format.md) — round-trippable, ~27% fewer tokens than JSON. Drop it for JSON output; agents using `@gortex/wire` or the Go `github.com/gortexhq/gcx-go` package decode either._
