import Image from "next/image";
import { COUNCIL, CYCLE_TRACE as C, DISCUSSION, type Speaker } from "@/lib/data";
import { Badge, Breadcrumb, CheckIcon } from "@/components/ui";

const BY_KEY = Object.fromEntries(COUNCIL.map((c) => [c.key, c]));

/** Seat coordinates inside the 1000×500 council scene, straight from the .pen. */
const SEAT_POS: Record<Speaker, { x: number; y: number }> = {
  desk: { x: 170, y: 18 },
  analyst: { x: 620, y: 18 },
  risk: { x: 800, y: 172 },
  trader: { x: 620, y: 342 },
  pm: { x: 170, y: 342 },
};

const FRAME_COLOR = {
  accent: "var(--color-accent)",
  negative: "var(--color-negative)",
  warning: "var(--color-warning)",
  muted: "var(--color-text-dim)",
} as const;

function Portrait({
  speaker,
  size,
  frame = "muted",
}: {
  speaker: Speaker;
  size: number;
  frame?: keyof typeof FRAME_COLOR;
}) {
  const member = BY_KEY[speaker];
  return (
    <span
      className="relative block shrink-0 overflow-hidden rounded-lg"
      style={{
        width: size,
        height: size,
        boxShadow: `inset 0 0 0 2px ${FRAME_COLOR[frame]}`,
      }}
    >
      <Image
        src={member.portrait}
        alt={member.name}
        width={size}
        height={size}
        className="size-full object-cover"
      />
    </span>
  );
}

export default function CycleTracePage() {
  return (
    <main>
      {/* ---------------------------------------------------------- header */}
      <section className="flex items-end justify-between border-b border-grid px-[220px] pt-6 pb-5">
        <div className="space-y-3">
          <Breadcrumb parts={["alpha_hunter", "Cycles", String(C.cycle)]} />
          <div className="flex items-center gap-4">
            <h1 className="font-mono text-[34px] leading-none text-text-primary">
              Cycle {C.cycle}
            </h1>
            <Badge tone="neutral">Fully autonomous</Badge>
          </div>
          <p className="font-ui text-[14px] text-text-secondary">
            {C.time} · {C.subtitle}
          </p>
        </div>

        <div className="flex shrink-0">
          {C.stats.map((s, i) => (
            <div
              key={s.label}
              className={`px-7 ${i > 0 ? "border-l border-grid" : ""}`}
            >
              <div className="flex flex-col items-end gap-2.5">
                <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                  {s.label}
                </span>
                <span
                  className={`tnum font-mono text-[20px] leading-none ${
                    s.tone === "accent"
                      ? "text-accent"
                      : s.tone === "negative"
                        ? "text-negative"
                        : s.tone === "muted"
                          ? "text-text-dim"
                          : "text-text-primary"
                  }`}
                >
                  {s.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- council */}
      <section className="border-b border-grid px-[220px] pt-[26px] pb-[30px]">
        <div className="flex items-center justify-between pb-4">
          <h2 className="font-mono text-[13px] tracking-[0.1em] text-text-primary uppercase">
            The council
          </h2>
          <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
            Five agents · Each speaks once per cycle
          </span>
        </div>

        <div className="relative h-[500px] w-[1000px] border border-grid-strong bg-bg">
          {/* the table */}
          <div
            className="absolute rounded-[50%] border border-grid-strong bg-surface-2"
            style={{ left: 310, top: 175, width: 380, height: 140 }}
          />
          <div
            className="absolute rounded-[50%] bg-panel"
            style={{ left: 324, top: 187, width: 352, height: 116 }}
          />
          <div
            className="absolute flex flex-col items-center gap-1.5"
            style={{ left: 400, top: 230, width: 200 }}
          >
            <span className="font-mono text-[13px] tracking-[0.08em] text-accent">
              CYCLE {C.cycle}
            </span>
            <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
              1 executed · 2 blocked
            </span>
          </div>

          {/* the seats */}
          {COUNCIL.map((member) => {
            const pos = SEAT_POS[member.key];
            return (
              <div
                key={member.key}
                className="absolute flex flex-col items-center gap-[9px]"
                style={{ left: pos.x, top: pos.y, width: 180 }}
              >
                <Portrait speaker={member.key} size={76} frame={member.tone} />
                <div className="flex items-center gap-[7px] whitespace-nowrap">
                  <span className="tnum font-mono text-[10px] text-text-dim">
                    {member.seat}
                  </span>
                  <span className="font-mono text-[12px] tracking-[0.06em] text-text-primary uppercase">
                    {member.name}
                  </span>
                </div>
                <span className="font-ui text-[10px] text-text-dim">
                  {member.role}
                </span>
                <Badge
                  tone={
                    member.tone === "accent"
                      ? "accent"
                      : member.tone === "negative"
                        ? "negative"
                        : "muted"
                  }
                >
                  {member.status}
                </Badge>
              </div>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------------ discussion */}
      <section className="px-[220px] pt-[26px] pb-8">
        <div className="flex items-center justify-between pb-6">
          <h2 className="font-mono text-[13px] tracking-[0.1em] text-text-primary uppercase">
            The discussion
          </h2>
          <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
            In order · 7.1 seconds
          </span>
        </div>

        <div className="space-y-7">
          {DISCUSSION.map((entry, i) => {
            const member = BY_KEY[entry.speaker];
            const prevNested = DISCUSSION[i - 1]?.nested ?? false;
            const nextNested = DISCUSSION[i + 1]?.nested ?? false;

            const row = (
              <div className="flex gap-5">
                <Portrait
                  speaker={entry.speaker}
                  size={entry.nested ? 44 : 46}
                  frame={entry.frame}
                />
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-[12px] tracking-[0.08em] text-text-primary uppercase">
                        {member.name}
                      </span>
                      {entry.qualifier ? (
                        <span className="font-mono text-[10.5px] text-text-dim">
                          {entry.qualifier}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      {entry.badge ? (
                        <Badge tone={entry.badge.tone}>{entry.badge.label}</Badge>
                      ) : null}
                      <span className="tnum font-mono text-[10.5px] text-text-dim">
                        {entry.time}
                      </span>
                    </div>
                  </div>

                  <p className="font-ui text-[14px] leading-relaxed text-text-secondary">
                    {entry.body}
                  </p>

                  {entry.showCandidates ? (
                    <div className="mt-4 bg-panel">
                      {C.candidates.map(([asset, signal, size]) => (
                        <div
                          key={asset}
                          className="grid grid-cols-[80px_minmax(0,1fr)_120px] items-center gap-4 border-b border-grid px-5 py-3.5 last:border-b-0"
                        >
                          <span className="font-mono text-[12px] tracking-[0.04em] text-text-primary">
                            {asset}
                          </span>
                          <span className="font-mono text-[11.5px] text-text-dim">
                            {signal}
                          </span>
                          <span className="tnum text-right font-mono text-[12.5px] text-text-primary">
                            {size}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );

            if (!entry.nested) return <div key={i}>{row}</div>;

            /* Nested replies hang off a rule that runs the length of the thread. */
            return (
              <div
                key={i}
                className={`border-l border-grid pl-[76px] ${prevNested ? "-mt-7 pt-7" : ""} ${nextNested ? "-mb-7 pb-7" : ""}`}
              >
                {row}
              </div>
            );
          })}
        </div>

        <div className="mt-9 flex items-center gap-4 bg-panel px-5 py-5">
          <div className="w-0.5 shrink-0 self-stretch bg-accent" />
          <CheckIcon className="shrink-0 text-accent" />
          <p className="font-ui text-[13.5px] text-text-secondary">{C.outcome}</p>
        </div>
      </section>
    </main>
  );
}
