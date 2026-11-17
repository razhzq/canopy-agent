import type { Metadata } from "next";
import { TradeScreen } from "@/components/trade/tradeScreen";

export const metadata: Metadata = { title: "Trade" };

export default async function TradePage({ params }: { params: Promise<{ mint: string }> }) {
  const { mint } = await params;
  return <TradeScreen mint={decodeURIComponent(mint)} />;
}
