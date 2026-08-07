---
name: gortex-components-agentdetailview
description: "Work in the components · AgentDetailView area — 65 symbols across 2 files (85% cohesion)"
---

# components · AgentDetailView

65 symbols | 2 files | 85% cohesion

## When to Use

Use this skill when working on files in:
- `components/agentDetail.tsx`
- `components/agentThread.tsx`

## Key Files

| File | Symbols |
|------|---------|
| `components/agentDetail.tsx` | ahead, BookSwitch, who, Half, copied, ... |
| `components/agentThread.tsx` | hrs, mins, iso, when |

## Entry Points

- `components/agentDetail.tsx::AgentDetailView`
- `components/agentDetail.tsx::WalletTag`

## Connected Communities

- **components · EquityView** (3 cross-edges)
- **components · StrategyStep** (1 cross-edges)
- **components +1 dirs · return30d** (1 cross-edges)
- **components · FeaturedCard** (1 cross-edges)

## How to Explore

```
get_communities with id: "community-5"
smart_context with task: "understand components · AgentDetailView", format: "gcx"
find_usages with id: "components/agentDetail.tsx::AgentDetailView", format: "gcx"
```

_`format: "gcx"` returns the [GCX1 compact wire format](../../docs/wire-format.md) — round-trippable, ~27% fewer tokens than JSON. Drop it for JSON output; agents using `@gortex/wire` or the Go `github.com/gortexhq/gcx-go` package decode either._
