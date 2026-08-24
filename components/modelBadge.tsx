import Image from "next/image";

import type { ModelRef } from "@/lib/api";
import { RemoteIcon } from "@/components/remoteIcon";

/**
 * The model an agent reasons with, worn beside its name.
 *
 * A PILL, not the square `Badge` the status chips use, and the shape is doing
 * work. It sits next to the name, where the square badges say what STATE the
 * agent is in — listed, paper, delisted, yours — all of which can change while
 * you are looking at it. The model is not a state; it is what the thing is made
 * of. Rounding it keeps the two from being read as one row of statuses.
 *
 * WHAT IT NAMES, NOW THAT THERE IS A CHOICE.
 *
 * Every agent used to run the same model, so this badge could state a platform
 * fact. It cannot any more: an agent's council may reason with a model bought
 * through Pod and paid for out of that agent's own wallet. So the badge reads
 * the agent's `model`, and the platform default has become the FALLBACK rather
 * than the subject — which is exactly right, because an agent created before
 * models were a choice really does run cQWEN3, and `model` being absent really
 * does mean that.
 *
 * The mark carries no alt text: the label is right beside it, and a screen
 * reader announcing "Qwen logo cQWEN3" says it twice.
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

export function ModelBadge({
  model,
  className = "",
}: {
  /**
   * What this agent reasons with. Absent or null means the Canopy model —
   * every agent that predates the choice ran it, so absence is an answer here
   * rather than a hole.
   */
  model?: ModelRef | null;
  className?: string;
}) {
  const canopy = !model || model.provider === "canopy";
  const label = model?.label ?? AGENT_MODEL.label;

  return (
    <span
      title={`Reasons with ${label}${canopy ? " — Canopy-hosted Qwen3" : " — bought through Pod"}`}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-grid-strong py-[3px] pr-2.5 pl-1.5 font-mono text-[10px] leading-none tracking-[0.08em] text-text-dim ${className}`}
    >
      <Mark model={model} />
      {label}
    </span>
  );
}

/**
 * The 12px disc at the head of the pill.
 *
 * Three cases and they are genuinely different. Canopy's mark ships with this
 * app. A Pod model MAY carry a logo URL from the marketplace, which is a third
 * party's host — `RemoteIcon` exists for exactly that and already handles a
 * dead URL without rendering a torn image. And a Pod model with no logo gets
 * NO mark rather than a placeholder: the label is the fact, a grey circle is
 * decoration standing where a fact should be.
 */
function Mark({ model }: { model?: ModelRef | null }) {
  if (!model || model.provider === "canopy") {
    return (
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
    );
  }
  if (!model.logo) return null;
  return <RemoteIcon src={model.logo} size={12} fallback={null} />;
}
