import { InviteGate } from "@/components/inviteGate";
import { RouteMemory } from "@/components/routeMemory";
import { BottomBar, Rail } from "@/components/shell2/rail";
import { TopBar } from "@/components/shell2/topBar";

/**
 * The Canopy v2 shell: a left rail of the six sections (a bottom bar below
 * lg) and a top bar with the breadcrumb, token search, alerts, balance,
 * Deposit and the account menu.
 *
 * The gate wraps the page only, so the bars (and sign out) stay reachable.
 */
export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <RouteMemory />
      <div className="flex min-h-screen gap-2 bg-bg px-2 lg:pt-2">
        <Rail />
        <div className="min-w-0 flex-1">
          <TopBar />
          <div className="pb-[calc(env(safe-area-inset-bottom)+76px)] lg:pb-2">
            <InviteGate>{children}</InviteGate>
          </div>
        </div>
      </div>
      <BottomBar />
    </>
  );
}
