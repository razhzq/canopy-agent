import type { Metadata } from "next";
import { ActivityFeed } from "@/components/activityFeed";

export const metadata: Metadata = {
  title: "Activity · Canopy",
};

/**
 * Every cycle your agents have run, newest first.
 *
 * Deliberately account-wide where the rest of the app is agent-at-a-time: the
 * question "what have they been doing" is not one you should have to ask six
 * times. It is assembled client-side from each agent's own log — there is no
 * account-wide endpoint — which is why it is capped per agent rather than
 * paginated.
 */
export default function ActivityPage() {
  return (
    <main>
      <section className="space-y-2 border-b border-grid px-6 pt-6 pb-5 sm:px-8">
        <p className="font-mono text-[10px] tracking-[0.14em] text-text-dim uppercase">
          Portfolio
        </p>
        <h1 className="font-mono text-[26px] leading-none text-text-primary sm:text-[30px]">
          Activity
        </h1>
        <p className="font-ui text-[13.5px] text-text-secondary">
          Every cycle your agents have run — including the ones where they looked and did
          nothing.
        </p>
      </section>

      <ActivityFeed />
    </main>
  );
}
