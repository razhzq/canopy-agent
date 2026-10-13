// Which tenant this address serves. Probed by canopy-be when an admin verifies
// a custom domain (routes/agentTenants.ts): a matching slug proves DNS, TLS and
// the host mapping all at once.

import { NextResponse } from "next/server";
import { getTenant } from "@/lib/tenant/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const tenant = await getTenant().catch(() => null);
  if (!tenant) return NextResponse.json({ error: "no app at this address" }, { status: 404 });
  return NextResponse.json({ slug: tenant.slug, name: tenant.name });
}
