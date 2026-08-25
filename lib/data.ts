import type { Step } from "@/components/wizard";

/**
 * The two step tables the wizards count with.
 *
 * WHAT USED TO BE HERE.
 *
 * This file was ~1,400 lines of mock dataset for screens that have since been
 * built against the real API — AGENTS, MOVER_PANELS, LIVE_TAPE, ALPHA_HUNTER,
 * MONITOR, CYCLES, COUNCIL, CYCLE_TRACE, DISCUSSION, BUILD, PUBLISH, CREATOR
 * and the seeded series generators. Nothing imported any of them any more.
 *
 * They were removed when the app was translated rather than left in place,
 * because dead invented copy in a translated codebase is worse than ordinary
 * dead code: it reads as a hundred strings somebody forgot to translate, and
 * every future sweep re-finds them.
 *
 * The mandate wireframe's copy moved to `lib/deployCopy.ts`, where it lives in
 * both languages beside the pages that render it.
 *
 * The labels below are dictionary keys rather than words: both tables are
 * module-level constants, so a finished string here would be frozen in
 * whichever language happened to load first.
 */

export const DEPLOY_STEPS: Step[] = [
  { index: "01", labelKey: "deploy_step_describe", href: "/deploy/describe" },
  { index: "02", labelKey: "deploy_step_constraints", href: "/deploy/constraints" },
  { index: "03", labelKey: "deploy_step_autonomy", href: "/deploy/autonomy" },
  { index: "04", labelKey: "deploy_step_wallet", href: "/deploy/wallet" },
  { index: "05", labelKey: "deploy_step_fund", href: "/deploy/fund" },
];

/**
 * The build flow's stages.
 *
 * These are LIFECYCLE STATES a strategy moves through, mirroring the database
 * (draft → paper run → published), not steps in a wizard. Configuration is one
 * page; the paper run is the agent actually trading; publishing is the gate at
 * the end.
 *
 * No hrefs: you cannot click into a state, you transition into it.
 */
export const BUILD_STAGES: Step[] = [
  { index: "01", labelKey: "stage_draft" },
  { index: "02", labelKey: "stage_paper" },
  { index: "03", labelKey: "stage_published" },
];
