---
name: gortex-components-buildagent
description: "Work in the components · BuildAgent area — 37 symbols across 5 files (86% cohesion)"
---

# components · BuildAgent

37 symbols | 5 files | 86% cohesion

## When to Use

Use this skill when working on files in:
- `components/agentThread.tsx`
- `components/buildAgent.tsx`
- `components/buildStrategy.tsx`
- `components/pickRoute.tsx`
- `components/ui.tsx`

## Key Files

| File | Symbols |
|------|---------|
| `components/agentThread.tsx` | Row |
| `components/buildAgent.tsx` | router, Row, setNamed, setMarket, setLimits, ... |
| `components/buildStrategy.tsx` | toPayload, rules |
| `components/pickRoute.tsx` | route, v, RouteMode, describeRoute, RouteChoice |
| `components/ui.tsx` | t, Callout |

## Entry Points

- `components/buildAgent.tsx::BuildAgent`

## Connected Communities

- **components · EquityView** (2 cross-edges)

## How to Explore

```
get_communities with id: "community-11"
smart_context with task: "understand components · BuildAgent", format: "gcx"
find_usages with id: "components/buildAgent.tsx::BuildAgent", format: "gcx"
```

_`format: "gcx"` returns the [GCX1 compact wire format](../../docs/wire-format.md) — round-trippable, ~27% fewer tokens than JSON. Drop it for JSON output; agents using `@gortex/wire` or the Go `github.com/gortexhq/gcx-go` package decode either._
