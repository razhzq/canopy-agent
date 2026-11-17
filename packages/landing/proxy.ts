// The landing deployment serves `/`, `/research` and its own assets. Every other path is an
// app page someone reached on the old address (agent.canopy.finance/agents,
// a shared /agents/<id> link, …), so it moves to the same path on the app host,
// query string and all.

import { NextResponse, type NextRequest } from "next/server";
import { APP_URL } from "./lib/appUrl";

/** Pages this deployment serves itself. */
const LANDING_PATHS = new Set(["/", "/research"]);

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (LANDING_PATHS.has(pathname)) return NextResponse.next();
  return NextResponse.redirect(`${APP_URL}${pathname}${search}`, 308);
}

export const config = {
  // Not Next's own files, and not anything with an extension (public/ assets).
  matcher: ["/((?!_next/|.*\\.[a-zA-Z0-9]+$).*)"],
};
