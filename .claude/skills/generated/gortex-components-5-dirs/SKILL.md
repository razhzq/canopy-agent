---
name: gortex-components-5-dirs
description: "Work in the components +5 dirs area — 37 symbols across 8 files (92% cohesion)"
---

# components +5 dirs

37 symbols | 8 files | 92% cohesion

## When to Use

Use this skill when working on files in:
- `app/deploy/autonomy/page.tsx`
- `app/deploy/constraints/page.tsx`
- `app/deploy/describe/page.tsx`
- `app/deploy/fund/page.tsx`
- `app/deploy/wallet/page.tsx`
- `components/charts.tsx`
- `components/ui.tsx`
- `components/wizard.tsx`

## Key Files

| File | Symbols |
|------|---------|
| `app/deploy/autonomy/page.tsx` | HandGlyph, BoltGlyph, AutonomyPage, RenewGlyph |
| `app/deploy/constraints/page.tsx` | ConstraintsPage |
| `app/deploy/describe/page.tsx` | DescribePage |
| `app/deploy/fund/page.tsx` | ShieldGlyph, FundPage |
| `app/deploy/wallet/page.tsx` | SignGlyph, WalletPage |
| `components/charts.tsx` | HourHistogram, markerIndex, max, LimitRow, TickScale, ... |
| `components/ui.tsx` | PrimaryButton, InfoIcon, GhostButton, ArrowRight, cls, ... |
| `components/wizard.tsx` | MandateRail, ChoiceCard, ChoiceRow, StepBar, WizardHeader, ... |

## Entry Points

- `app/deploy/describe/page.tsx::DescribePage`
- `app/deploy/autonomy/page.tsx::AutonomyPage`
- `components/charts.tsx::HourHistogram`
- `app/deploy/constraints/page.tsx::ConstraintsPage`
- `app/deploy/fund/page.tsx::FundPage`

## How to Explore

```
get_communities with id: "community-51"
smart_context with task: "understand components +5 dirs", format: "gcx"
find_usages with id: "app/deploy/describe/page.tsx::DescribePage", format: "gcx"
```

_`format: "gcx"` returns the [GCX1 compact wire format](../../docs/wire-format.md) — round-trippable, ~27% fewer tokens than JSON. Drop it for JSON output; agents using `@gortex/wire` or the Go `github.com/gortexhq/gcx-go` package decode either._
