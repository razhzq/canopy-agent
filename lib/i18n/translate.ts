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
