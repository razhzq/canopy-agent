import type { TranslationKey } from "./en";

/**
 * The shape of `t`, so it can be passed as an argument.
 *
 * Lives in its own module because the code that needs it most is not a
 * component: `lib/narrate` turns council decision rows into sentences, and it
 * is a pure function called from several surfaces. It takes the translator
 * rather than calling `useT()`, which it cannot — and which would tie the
 * narrator to React for no reason.
 */
export type Translate = (
  key: TranslationKey,
  vars?: Record<string, string | number>,
) => string;

/**
 * Fills `{name}` placeholders. `{brand}` is always available — the tenant's
 * name — so a string can name the product without every caller passing it.
 * An explicit `brand` var still wins. Unknown names are left as written.
 */
export function fill(
  raw: string,
  vars: Record<string, string | number> | undefined,
  brand: string,
): string {
  if (!raw.includes("{")) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = vars?.[name] ?? (name === "brand" ? brand : undefined);
    return v != null ? String(v) : `{${name}}`;
  });
}
