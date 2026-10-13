import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { ReferralCapture } from "@/components/referralCapture";
import { Analytics } from "@/components/analytics";
import { getServerT } from "@/lib/i18n/server";
import { getTenant } from "@/lib/tenant/server";
import type { TenantConfig } from "@/lib/tenant/config";
import "./globals.css";

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});

// The wordmark's face. Loaded for one word — "canopy", set in the brand
// component — and nothing else, which is why only the one weight is fetched.
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--font-archivo",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// A function rather than a constant: the title is in the reader's language,
// and that lives in a cookie. See lib/i18n/server.
export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant();
  if (!tenant) return { title: "Not found" };
  const t = await getServerT();
  return {
    title: t("page_title_root"),
    description: t("page_desc_root"),
    metadataBase: new URL(tenant.appUrl),
    // Canopy's own icons for Canopy; a tenant's favicon (or its mark) for a
    // tenant — never Canopy's on someone else's tab.
    icons: tenant.isPlatform
      ? {
          icon: [
            // The mark's ink squares are dark on the light favicon and white on
            // the dark one; the browser picks by its own chrome, not the page's.
            { url: "/brand/favicon.svg", type: "image/svg+xml", media: "(prefers-color-scheme: light)" },
            { url: "/brand/favicon-dark.svg", type: "image/svg+xml", media: "(prefers-color-scheme: dark)" },
            { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
          ],
          apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180" }],
        }
      : (tenant.brand.faviconUrl ?? tenant.brand.markUrl)
        ? {
            icon: [{ url: (tenant.brand.faviconUrl ?? tenant.brand.markUrl)! }],
            apple: [{ url: (tenant.brand.markUrl ?? tenant.brand.faviconUrl)! }],
          }
        : undefined,
  };
}

/**
 * Everything every route needs and nothing more: the document, the fonts, and
 * the Privy session.
 *
 * The signed-in chrome — nav, invite gate, page frame — moved to
 * `(app)/layout.tsx` so the marketing routes can render without it. See the
 * note there.
 */
/**
 * The tenant's accent, as overrides of the theme tokens in globals.css. Tailwind
 * v4 compiles `@theme` to CSS variables, so setting them on <html> recolours
 * every `bg-accent`, `text-accent/40`, … without a rebuild. The wash and dim
 * shades are derived from the accent the way Canopy's were from its mint.
 */
function accentStyle(tenant: TenantConfig): React.CSSProperties | undefined {
  const accent = tenant.brand.accentColor;
  if (!accent) return undefined;
  return {
    "--color-accent": accent,
    "--color-accent-wash": `color-mix(in oklab, ${accent} 20%, #0B100E)`,
    "--color-accent-dim": `color-mix(in oklab, ${accent} 22%, transparent)`,
  } as React.CSSProperties;
}

/** What an address with no hosted tenant answers. Plain, and on purpose unbranded. */
function NoTenant() {
  return (
    <html lang="en">
      <body style={{ background: "#0B100E", color: "#9AA59F", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
          <p>There is no app at this address.</p>
        </main>
      </body>
    </html>
  );
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const tenant = await getTenant();
  if (!tenant) return <NoTenant />;
  return (
    // `suppressHydrationWarning` on the document element and body, and ONLY
    // there.
    //
    // Wallet extensions write to these two nodes before React loads — a
    // TokenPocket build stamps `data-tp-bcm-channel-…` onto <html> — so the
    // server HTML and the client tree disagree about an attribute no code here
    // wrote. React reports that as a hydration mismatch at the ROOT, which is
    // the worst place to have one: the failure is not local to a component, and
    // it leaves the App Router initialising against a tree it has just been
    // told not to trust. "Router action dispatched before initialization"
    // follows from the same window.
    //
    // This is React's own escape hatch for exactly this case, and it is narrow:
    // it forgives the ATTRIBUTES AND TEXT OF THIS ELEMENT ALONE. Children are
    // still hydrated and still checked, so a genuine mismatch anywhere inside
    // the app is reported exactly as before. It buys silence about the two
    // nodes we do not control, and nothing else.
    <html
      lang="en"
      className={`${plexMono.variable} ${inter.variable} ${archivo.variable}`}
      style={accentStyle(tenant)}
      data-tenant={tenant.slug}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        {/* Outside Providers: capturing a referral is not a signed-in concern,
            and it has to happen on the marketing page too — which is where a
            referral link actually lands. */}
        <ReferralCapture />
        {/* Beside ReferralCapture and for the same reason: the marketing page
            is where visitors land, signed in or not. */}
        <Analytics id={tenant.gaMeasurementId} />
        <Providers tenant={tenant}>{children}</Providers>
      </body>
    </html>
  );
}
