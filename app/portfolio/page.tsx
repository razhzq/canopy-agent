import { AgentList } from "@/components/portfolio";

export default function PortfolioIndex() {
  return (
    <main>
      <section className="space-y-3 border-b border-grid px-8 pt-6 pb-6">
        <p className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
          Portfolio
        </p>
        <h1 className="font-mono text-[34px] leading-none text-text-primary">Your agents</h1>
        <p className="font-ui text-[14px] text-text-secondary">
          Every agent you have deployed, with the mandate you gave it and when it last ran.
        </p>
      </section>

      <section className="px-8 py-8">
        <AgentList />
      </section>
    </main>
  );
}
