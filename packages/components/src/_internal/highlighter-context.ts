/**
 * Internal context shape for the cinder highlighter. Factored out of
 * `cinder-provider.svelte` so plain `.ts` consumers (component implementations
 * like `code-block.svelte`) can import the symbol key and types without
 * going through the ambient `*.svelte` module path. The ambient declaration
 * only exposes the default export to plain TS, so any context bridge needs a
 * `.ts` home.
 *
 * Mirrors the shape used by `toast-context.ts` + `use-toast.ts`.
 */

import { getContext } from 'svelte';

/** Symbol key for the highlighter Svelte context. */
export const HIGHLIGHTER_CONTEXT_KEY = Symbol('cinder-highlighter');

/**
 * Signature of a syntax highlighter callback. Receives the raw `code` and
 * `lang` and returns an HTML string (sync or async).
 *
 * The return value is rendered with `{@html}` inside `<CodeBlock>` and
 * replaces the default `<pre><code>` markup — including the
 * `cinder-code-block__pre` / `__code` classes — so the highlighter is also
 * responsible for matching any structural CSS the consumer relies on
 * (Shiki's own `<pre class="shiki ...">` output covers most cases).
 *
 * **Trust contract.** The returned string is rendered verbatim via
 * `{@html}`. The highlighter MUST escape any user-provided input so the
 * output is safe HTML. Shiki's `codeToHtml` escapes input by default and
 * is the recommended choice; the bundled adapter at `cinder/highlighters/shiki`
 * (PR 3) ships that contract out of the box.
 */
export type Highlighter = (code: string, lang: string) => string | Promise<string>;

/**
 * Shape of the value stored under {@link HIGHLIGHTER_CONTEXT_KEY}. Wraps the
 * current `Highlighter` (if any) in a getter so consumers see fresh values
 * when the provider's prop changes — Svelte 5 closures over `$props()` are
 * not automatically reactive across `setContext` boundaries, so the
 * provider must update the property via the accessor pattern.
 *
 * Mirrors the canonical reactive-context shape used by `accordion.svelte`,
 * `tabs.svelte`, and `dropdown.svelte`.
 */
export type HighlighterContext = {
  /** Returns the current highlighter, or `undefined` when none is configured. */
  readonly highlighter: Highlighter | undefined;
};

/**
 * Returns the nearest enclosing `<CinderProvider>`'s highlighter, or
 * `undefined` when no provider is mounted (or when the provider is mounted
 * with no highlighter prop). The "no provider" case is the unhighlighted
 * fallback — `<CodeBlock>` renders escaped plaintext.
 *
 * Unlike `useToast()`, this MUST NOT throw on a missing provider: cinder
 * supports the "no syntax highlighting" path as a first-class state, and a
 * `<CodeBlock>` rendered outside a provider just falls back to plain
 * `<pre><code>{code}</code></pre>`.
 */
export function getHighlighter(): Highlighter | undefined {
  const context = getContext<HighlighterContext | undefined>(HIGHLIGHTER_CONTEXT_KEY);
  return context?.highlighter;
}
