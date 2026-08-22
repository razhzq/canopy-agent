import { InviteGate } from "@/components/inviteGate";
import { MobileTabs } from "@/components/mobileTabs";
import { TopNav } from "@/components/nav";
import { RouteMemory } from "@/components/routeMemory";

/**
 * The application chrome — nav, invite gate, and the page frame.
 *
 * WHY THIS IS NOT IN THE ROOT LAYOUT ANY MORE
 *
 * It used to be, which meant every route in the app got the signed-in shell
 * whether or not it made sense. A landing page cannot live under that: it has
 * its own nav, it is the page people see BEFORE they have an invite, and it is
 * full-bleed rather than framed at 1440px.
 *
 * A nested layout can only ever ADD to its parent, so the chrome had to move
 * down here rather than the landing trying to opt out of it. Route groups carry
 * no URL segment, so every path is exactly what it was.
 *
 * `Providers` stays in the root layout — the landing needs Privy to offer a
 * login, it just does not need the gate that follows one.
 */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {/* Records the page behind the builder, so cancelling out of the naming
          modal returns there instead of to a fixed route. */}
      <RouteMemory />
      <div className="mx-auto min-h-screen w-full max-w-[1440px] bg-bg">
        <TopNav />
        {/* Around children only — the nav keeps rendering behind the gate so
            the account menu (and its sign out) stays reachable. */}
        {/* Padded for the tab bar, which is fixed and would otherwise sit on
            top of the last rows of every page. */}
        <div className="pb-[calc(env(safe-area-inset-bottom)+68px)] lg:pb-0">
          <InviteGate>{children}</InviteGate>
        </div>
      </div>
      <MobileTabs />
    </>
  );
}
