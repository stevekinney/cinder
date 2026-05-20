/**
 * Props for the CodeBlock component.
 *
 * Renders preformatted code in a `<pre><code>` element. Plain code is
 * Svelte-text-interpolated so HTML entities are escaped automatically.
 * Syntax highlighting is opt-in via the `highlighter` prop — when provided,
 * the highlighter's HTML output replaces the entire `<pre><code>` block and
 * is rendered via `{@html}`, so the caller owns the sanitization contract.
 */
export type CodeBlockProps = {
  /** The code to render. */
  code: string;
  /** Optional language label rendered in the header. */
  language?: string;
  /** When true, render a copy button in the header. */
  copyable?: boolean;
  /**
   * Optional syntax highlighter. Receives the raw `code` and `lang` and must
   * return an HTML string (sync or async). The return value is rendered with
   * `{@html}` and replaces the default `<pre><code>` markup — including the
   * `cinder-code-block__pre` / `__code` classes — so the caller is also
   * responsible for matching any structural CSS the consumer relies on
   * (Shiki's own `<pre class="shiki ...">` output covers most cases).
   *
   * The return value is rendered verbatim with `{@html}`. It is the caller's
   * responsibility to ensure the output is safe — specifically, that the
   * input `code` is escaped. Shiki's `codeToHtml` escapes input by default
   * and is the recommended choice.
   *
   * Only invoked when `language` is also set. Theme/color-scheme selection
   * is the caller's responsibility — pass it through closure.
   */
  highlighter?: (code: string, lang: string) => string | Promise<string>;
  /** Additional class names merged with `.cinder-code-block`. */
  class?: string;
};
