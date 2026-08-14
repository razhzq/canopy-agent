import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import { Providers } from "@/components/providers";
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

export const metadata: Metadata = {
  title: "Canopy Agent Stack",
  description:
    "Deploy a strategy as your own agent. You keep custody. You set every limit.",
  metadataBase: new URL("https://agent.canopy.finance"),
};

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
    <html lang="en" className={`${plexMono.variable} ${inter.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
