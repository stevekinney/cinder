/**
 * Props for the CodeBlock component.
 *
 * Renders preformatted code in a `<pre><code>` element. Plain code is
 * Svelte-text-interpolated so HTML entities are escaped automatically.
 *
 * Syntax highlighting is opt-in through a `<CinderProvider>` ancestor: mount
 * `<CinderProvider highlighter={...}>` at your app root and every descendant
 * `<CodeBlock>` shares the highlighter. When no provider is in scope (or
 * the provider supplies no highlighter), CodeBlock renders the un-highlighted
 * `<pre><code>{code}</code></pre>` fallback with escaped text.
 *
 * **PR 2 breaking change.** The per-instance `highlighter` prop was removed.
 * Old call sites are TypeScript errors — wrap the relevant subtree (typically
 * your root layout) in `<CinderProvider highlighter={...}>` instead. The
 * bundled `cinder/highlighters/shiki` adapter (PR 3) is the recommended
 * default.
 */
export type CodeBlockProps = {
  /** The code to render. */
  code: string;
  /** Optional language label rendered in the header. */
  language?: string;
  /** When true, render a copy button in the header. */
  copyable?: boolean;
  /** Additional class names merged with `.cinder-code-block`. */
  class?: string;
};
