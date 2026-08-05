import { LIVE_TAPE, MOVER_PANELS } from "@/lib/data";
import { Marketplace } from "@/components/marketplace";

function signed(n: number, suffix = "%") {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}${suffix}`;
}

export default function AgentsPage() {
  return (
    <main>
      {/* Header, tabs and the strategy table are one client component: they are
          three views of the same list, and splitting them would mean either
          three requests for one page or a headline figure that is invented. */}
      <Marketplace />

      {/* ---------------------------------------------------------- movers */}
      {/* No endpoint backs these two panels yet. They are marked SAMPLE rather
          than deleted so the layout survives, and rather than left unmarked so
          nobody reads them as live. */}
      <section className="flex border-t border-grid bg-panel">
        {MOVER_PANELS.map((panel, i) => (
          <div
            key={panel.title}
            className={`flex-1 px-8 py-6 ${i > 0 ? "border-l border-grid" : ""}`}
          >
            <div className="flex items-center justify-between pb-4">
              <span className="font-mono text-[11px] tracking-[0.1em] text-text-secondary uppercase">
                {panel.title}
              </span>
              <span className="border border-grid-strong px-1.5 py-0.5 font-mono text-[9px] tracking-[0.1em] text-text-muted uppercase">
                Sample
              </span>
            </div>
            <div className="space-y-3">
              {panel.rows.map(([name, delta]) => (
                <div key={name} className="flex items-center justify-between gap-4">
                  <span className="truncate font-mono text-[12px] text-text-secondary">
                    {name}
                  </span>
                  <span
                    className={`tnum shrink-0 font-mono text-[12px] ${
                      delta >= 0 ? "text-accent" : "text-negative"
                    }`}
                  >
                    {signed(delta)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="flex-1 border-l border-grid px-8 py-6">
          <div className="flex items-center justify-between pb-4">
            <span className="font-mono text-[11px] tracking-[0.1em] text-text-secondary uppercase">
              Live tape
            </span>
            <span className="border border-grid-strong px-1.5 py-0.5 font-mono text-[9px] tracking-[0.1em] text-text-muted uppercase">
              Sample
            </span>
          </div>
          <div className="space-y-3">
            {LIVE_TAPE.map(([time, side, asset]) => (
              <div key={time} className="flex items-center gap-4">
                <span className="tnum font-mono text-[11px] text-text-dim">{time}</span>
                <span
                  className={`font-mono text-[11px] tracking-[0.06em] ${
                    side === "SELL" ? "text-negative" : "text-accent"
                  }`}
                >
                  {side}
                </span>
                <span className="ml-auto font-mono text-[11px] text-text-secondary">
                  {asset}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
