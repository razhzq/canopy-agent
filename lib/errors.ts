/**
 * A sentence from whatever was thrown.
 *
 * Privy's hooks and Kit's RPC transport throw objects, not always Errors —
 * a `cause` chain, a `details` blob, a JSON-RPC `{ code, message, data }` —
 * and rendering `String(err)` on those gives "[object Object]", which is what
 * the withdraw dialog showed. This walks the shapes that occur and returns the
 * most specific message it can find, with the chain's own error joined on
 * when there is one (a simulation failure names the program log that failed).
 */
export function describeError(err: unknown): string {
  const seen = new Set<unknown>();
  const parts: string[] = [];

  const visit = (e: unknown, depth: number): void => {
    if (e === null || e === undefined || depth > 4 || seen.has(e)) return;
    seen.add(e);
    if (typeof e === "string") {
      parts.push(e);
      return;
    }
    if (typeof e !== "object") {
      parts.push(String(e));
      return;
    }
    const o = e as Record<string, unknown>;
    if (typeof o.message === "string" && o.message.trim() !== "") parts.push(o.message);
    else if (typeof o.error === "string") parts.push(o.error);
    else if (typeof o.reason === "string") parts.push(o.reason);
    // JSON-RPC error payloads carry the useful part under `data`.
    const data = o.data as Record<string, unknown> | undefined;
    if (data && Array.isArray(data.logs)) {
      const last = (data.logs as unknown[]).filter((l) => typeof l === "string").slice(-2);
      if (last.length) parts.push(last.join(" · "));
    } else if (data && typeof data.err === "string") {
      parts.push(data.err);
    } else if (data && typeof data.err === "object" && data.err) {
      parts.push(JSON.stringify(data.err));
    }
    if (o.cause !== undefined) visit(o.cause, depth + 1);
    if (o.error && typeof o.error === "object") visit(o.error, depth + 1);
    if (o.details && typeof o.details === "object") visit(o.details, depth + 1);
  };

  visit(err, 0);
  const unique = [...new Set(parts.map((p) => p.trim()).filter(Boolean))];
  return unique.length ? unique.join(" — ") : "Something went wrong, and nothing said what.";
}
