import type { Metadata } from "next";
import { TenantAdmin } from "@/components/tenantAdmin";
import { getTenant } from "@/lib/tenant/server";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant();
  return { title: `Manage ${tenant?.name ?? ""}`.trim() };
}

/**
 * A tenant's own admin page: its branding, users, agents, marketplace and
 * admins. Canopy itself is managed from the Canopy admin portal, not here.
 */
export default function AdminPage() {
  return <TenantAdmin />;
}
