import type { Snippet } from 'svelte';

import type { Highlighter } from '../../utilities/highlighter.ts';

/**
 * Props for {@link CinderProvider}. Wraps a subtree and makes a
 * `Highlighter` available to any descendant `<CodeBlock>` via Svelte
 * context — replaces the per-instance `highlighter` prop on `<CodeBlock>`
 * (removed in PR 2).
 *
 * The provider is reactive: assigning a new `highlighter` after mount
 * re-renders every descendant `<CodeBlock>` with the new function's
 * output. Pass `undefined` (or omit) to opt every descendant into the
 * unhighlighted `<pre><code>` fallback.
 */
export type CinderProviderProps = {
  /**
   * Syntax highlighter shared with every descendant `<CodeBlock>`. The
   * function is invoked per `<CodeBlock>` with the block's `code` and
   * `language`; the returned HTML is rendered via `{@html}` and must be
   * pre-escaped (Shiki's `codeToHtml` escapes its input by default).
   *
   * Omit or pass `undefined` to disable syntax highlighting for the
   * subtree — useful for toggling highlighting dynamically without
   * unmounting the provider.
   */
  highlighter?: Highlighter | undefined;
  /** Subtree the provider wraps. Required. */
  children: Snippet;
};
