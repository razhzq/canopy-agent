import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import { InviteGate } from "@/components/inviteGate";
import { TopNav } from "@/components/nav";
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${plexMono.variable} ${inter.variable}`}>
      <body>
        <Providers>
          <div className="mx-auto min-h-screen w-full max-w-[1440px] bg-bg">
            <TopNav />
            {/* Inside Providers so the gate can read the Privy session, and
                around children only — the nav keeps rendering behind the gate
                so the account menu (and its sign out) stays reachable. */}
            <InviteGate>{children}</InviteGate>
          </div>
        </Providers>
      </body>
    </html>
  );
}
