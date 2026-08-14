import { Marketplace } from "@/components/marketplace";

/**
 * The agent list.
 *
 * Everything on this page comes from the database. The movers and live-tape
 * panels that used to sit under the table were sample data — clearly labelled,
 * but still three panels of invented numbers on the page whose entire job is to
 * be a truthful record. They are gone until an endpoint backs them.
 */
export default function AgentsPage() {
  return (
    <main>
      {/* Header, tabs and the strategy table are one client component: they are
          three views of the same list, and splitting them would mean either
          three requests for one page or a headline figure that is invented. */}
      <Marketplace />
    </main>
  );
}
