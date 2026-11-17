import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, Inter, Instrument_Serif, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { getServerT } from "@canopy-agent/shared/i18n/server";
import { LocaleProvider } from "@canopy-agent/shared/i18n";
import { getTenant } from "@canopy-agent/shared/tenant/server";
import { PLATFORM_FALLBACK } from "@canopy-agent/shared/tenant/config";
import { TenantProvider } from "@canopy-agent/shared/tenant/context";
import { Analytics } from "@canopy-agent/shared/analyticsTag";
import "./globals.css";

// The app's faces, for the wordmark (Archivo) and the shared components.
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-mono" });
const archivo = Archivo({ subsets: ["latin"], weight: ["800"], variable: "--font-archivo" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

// landing.css's faces: Inter Tight and JetBrains Mono for text, Instrument
// Serif for the headlines (`.h1`, `.sec-title`) only.
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });
const instrumentSerif = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-instrument-serif" });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return {
    title: t("page_title_landing"),
    description: t("page_desc_landing"),
    metadataBase: new URL(process.env.NEXT_PUBLIC_LANDING_URL || "https://agent.canopy.finance"),
    icons: {
      icon: [
        { url: "/brand/favicon.svg", type: "image/svg+xml", media: "(prefers-color-scheme: light)" },
        { url: "/brand/favicon-dark.svg", type: "image/svg+xml", media: "(prefers-color-scheme: dark)" },
        { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      ],
      apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180" }],
    },
  };
}

/**
 * The landing page's document. Canopy's own front door only: partner tenants
 * live on the app deployment. No Privy here, nobody signs in on this host.
 */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // The platform tenant, for the brand name and GA id. A backend outage falls
  // back to the build's env rather than taking the landing page down.
  const tenant = (await getTenant().catch(() => null)) ?? PLATFORM_FALLBACK;
  const fonts = [plexMono, inter, archivo, interTight, jetbrains, instrumentSerif].map((f) => f.variable).join(" ");
  return (
    // suppressHydrationWarning on <html> and <body> only: wallet extensions
    // stamp attributes onto both before React loads.
    <html lang="en" className={fonts} data-tenant={tenant.slug} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Analytics id={tenant.gaMeasurementId} />
        <TenantProvider tenant={tenant}>
          <LocaleProvider brand={tenant.name}>{children}</LocaleProvider>
        </TenantProvider>
      </body>
    </html>
  );
}
