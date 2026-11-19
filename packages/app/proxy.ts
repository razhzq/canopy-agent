// Switched-off sections (lib/enabledSections) redirect to the app's home, so
// a bookmark or an old link to Copy or Portfolio lands somewhere that works.

import { NextResponse, type NextRequest } from "next/server";
import { HOME_ROUTE, pathOn } from "./lib/enabledSections";

export function proxy(req: NextRequest) {
  if (pathOn(req.nextUrl.pathname)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = HOME_ROUTE;
  return NextResponse.redirect(url, 307);
}

export const config = {
  matcher: [
    "/ask/:path*",
    "/studio/:path*",
    "/build/:path*",
    "/agents/:path*",
    "/deploy/:path*",
    "/atlas/:path*",
    "/portfolio/:path*",
    "/workspace/:path*",
    "/activity/:path*",
    "/earnings/:path*",
    "/wallet-audit/:path*",
    "/feed/:path*",
    "/trade/:path*",
  ],
};
