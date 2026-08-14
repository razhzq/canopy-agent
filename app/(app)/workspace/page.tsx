import { MyAgents } from "@/components/myAgents";

/** "My agents" — wireframe 1j. The landing page for an owner. */
export default function MyAgentsPage() {
  return (
    <main>
      <section className="space-y-2 border-b border-grid px-8 pt-6 pb-5">
        <p className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
          Portfolio
        </p>
        <h1 className="font-mono text-[30px] leading-none text-text-primary">My agents</h1>
        <p className="font-ui text-[13.5px] text-text-secondary">
          Everything you have deployed — what it holds, how it is doing, and which one wants you.
        </p>
      </section>

      <MyAgents />
    </main>
  );
}
