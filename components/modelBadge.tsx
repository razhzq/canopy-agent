import Image from "next/image";

/**
 * Which model reasons inside every agent on this platform.
 *
 * ONE CONSTANT, NOT A FIELD, AND THE COMMENT IS THE HONEST PART.
 *
 * Nothing in the strategy list, the strategy detail or the agent detail payload
 * carries a model — the only place the backend reports one is per decision, on
 * `ActivityDecision.model` and the rows `getCycle` returns, which is a fact
 * about a cycle that has already run rather than about the agent. So this badge
 * states a PLATFORM fact: every seat of the council runs Qwen3 today.
 *
 * That is true and it is worth saying, but it stops being true the moment a
 * second model is offered, and a badge that has hardcoded its own subject is
 * the kind that keeps rendering afterwards. When an agent-scoped model reaches
 * the API, pass it in and delete the default — the wiring point is one prop.
 */
export const AGENT_MODEL = {
  /**
   * "cQWEN3", not "Qwen3": the c is the whole point of the label — the weights
   * are Qwen3, the inference is Canopy's, and an agent whose reasoning runs on
   * someone else's endpoint is a different promise about latency, cost and who
   * sees the prompt. The prefix is lowercase and the badge does NOT uppercase
   * its text, because `text-transform: uppercase` renders this "CQWEN3" and
   * throws away the one character carrying the meaning.
   */
  label: "cQWEN3",
  /**
   * The mark, as homarr-labs/dashboard-icons publishes it — a purple gradient
   * glyph on transparent, so it sits on the badge's own background rather than
   * carrying a box of its own.
   */
  logo: "/models/qwen.svg",
  /** The source viewBox, near-square. next/image wants the ratio, not a size. */
  width: 148,
  height: 146,
} as const;

/**
 * The model an agent thinks with, worn beside its name.
 *
 * A PILL, not the square `Badge` the status chips use, and the shape is doing
 * work. It sits next to the name, where the square badges say what STATE the
 * agent is in — listed, paper, delisted, yours — all of which can change while
 * you are looking at it. The model is not a state; it is what the thing is made
 * of. Rounding it keeps the two from being read as one row of statuses.
 *
 * The mark carries no alt text: the label is right beside it, and a screen
 * reader announcing "Qwen logo cQWEN3" says it twice.
 */
export function ModelBadge({
  label = AGENT_MODEL.label,
  className = "",
}: {
  /** Override once the API reports a model per agent. */
  label?: string;
  className?: string;
}) {
  return (
    <span
      title={`Reasons with ${label} — Canopy-hosted Qwen3`}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-grid-strong py-[3px] pr-2.5 pl-1.5 font-mono text-[10px] leading-none tracking-[0.08em] text-text-dim ${className}`}
    >
      <Image
        src={AGENT_MODEL.logo}
        alt=""
        aria-hidden
        width={AGENT_MODEL.width}
        height={AGENT_MODEL.height}
        // `unoptimized` for the same reason SourceMark does it: the optimiser
        // refuses SVG without dangerouslyAllowSVG, and a 1.6KB vector has
        // nothing to gain from being rasterised.
        unoptimized
        className="size-3 shrink-0"
      />
      {label}
    </span>
  );
}
