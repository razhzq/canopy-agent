import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { ReferralCapture } from "@/components/referralCapture";
import { getServerT } from "@/lib/i18n/server";
import "./globals.css";

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// A function rather than a constant: the title is in the reader's language,
// and that lives in a cookie. See lib/i18n/server.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return {
    title: t("page_title_root"),
    description: t("page_desc_root"),
    metadataBase: new URL("https://agent.canopy.finance"),
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
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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
      className={`${plexMono.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        {/* Outside Providers: capturing a referral is not a signed-in concern,
            and it has to happen on the marketing page too — which is where a
            referral link actually lands. */}
        <ReferralCapture />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
