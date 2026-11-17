import { notFound } from "next/navigation";
import { StrategyDetail } from "@/components/strategyDetail";

/**
 * A strategy's public page.
 *
 * The route segment is called `slug` for historical reasons; the value is the
 * numeric strategy id, which is what the marketplace links to.
 */
export default async function StrategyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const strategyId = Number(slug);
  if (!Number.isInteger(strategyId)) notFound();

  return (
    <main>
      <StrategyDetail strategyId={strategyId} />
    </main>
  );
}
