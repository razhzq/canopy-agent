import { redirect } from "next/navigation";
import { SOL_MINT } from "@/lib/market";

/** /trade opens on SOL — the market everyone already knows. */
export default function TradeIndex() {
  redirect(`/trade/${SOL_MINT}`);
}
