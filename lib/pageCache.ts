"use client";

/**
 * The last thing each page loaded, kept for the next visit in this tab.
 *
 * WHY. Portfolio fans out to listAgents plus four requests per agent, and
 * Explore lists every strategy. Both used to start from a skeleton every time
 * the nav took you back to them, because nothing outlived the component.
 * Seeding from here draws the previous result on the first frame; the page
 * still fetches and replaces it when the request lands (stale-while-revalidate).
 *
 * MEMORY ONLY. A module-level map survives client-side navigation and nothing
 * else: a reload starts clean, and a portfolio never lands in localStorage
 * where it would outlive the session on a shared machine.
 *
 * SCOPED TO ONE USER. The whole map is dropped the moment a different Privy
 * user (or nobody) reads or writes it, so signing in as someone else can never
 * draw the previous account's book, not even for a frame.
 */

const entries = new Map<string, unknown>();
let owner: string | null = null;

function scope(userId: string | null | undefined): boolean {
  const id = userId ?? null;
  if (id !== owner) {
    entries.clear();
    owner = id;
  }
  return id !== null;
}

export function readPageCache<T>(userId: string | null | undefined, key: string): T | undefined {
  if (!scope(userId)) return undefined;
  return entries.get(key) as T | undefined;
}

export function writePageCache<T>(userId: string | null | undefined, key: string, data: T): void {
  if (!scope(userId)) return;
  entries.set(key, data);
}
