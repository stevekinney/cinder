/**
 * The code-highlighter context. An application publishes one highlighter near
 * its root, and every descendant `<CodeBlock>` without its own `highlighter`
 * prop highlights with it.
 *
 * `<CodeBlock>` imports no highlighter of its own. A default reachable from
 * the component, even behind a lazy `import()`, makes a consumer's bundler emit
 * every grammar and theme that highlighter can load, whether or not any block
 * ever uses them. Resolving the highlighter from a prop or from this context
 * keeps the choice, and its bundle cost, with the application.
 */

import { createContext } from 'svelte';

import type { Highlighter } from '../utilities/highlighter.ts';
import { optionalContext } from './optional-context.ts';

const [getCodeHighlighterContextStrict, setCodeHighlighterContextRaw] =
  createContext<Highlighter>();

/**
 * Publish `highlighter` for every descendant `<CodeBlock>` that has no
 * `highlighter` prop. Call it during component initialization, like any
 * Svelte context setter. A nearer call replaces it for that subtree.
 *
 * @security Every block that falls back to this highlighter renders its
 * output verbatim through `{@html}`, exactly as for the `highlighter` prop:
 * the highlighter must escape the code it is given.
 */
export function setCodeHighlighterContext(highlighter: Highlighter): void {
  setCodeHighlighterContextRaw(highlighter);
}

/**
 * Read the nearest published highlighter, or `undefined` when no ancestor
 * published one. A missing provider is a supported state: the block renders
 * its escaped plain fallback.
 */
export const getCodeHighlighterContext: () => Highlighter | undefined = optionalContext(
  getCodeHighlighterContextStrict,
);
