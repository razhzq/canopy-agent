/**
 * Runs `work` over every item, at most `limit` at a time, in order.
 *
 * Plain `Promise.all` over a list opens one socket per item; the browser queues
 * them anyway, and the API sees a burst. This keeps the burst to a width the
 * server is happy with while still finishing in a fraction of the time a
 * sequential loop would take.
 *
 * Lives here because three screens fan out per-agent requests — the agent list,
 * the portfolio overview, and the activity feed — and a fourth copy of a
 * concurrency limiter is a fourth chance to get the limit wrong.
 */
export async function pooled<T, R>(
  items: readonly T[],
  limit: number,
  work: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await work(items[i], i);
    }
  });
  await Promise.all(runners);
  return out;
}

/** How many per-agent requests are in flight at once. */
export const CONCURRENCY = 6;
