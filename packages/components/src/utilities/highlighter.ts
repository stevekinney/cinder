/**
 * The `Highlighter` contract for `<CodeBlock>`.
 *
 * `<CodeBlock>` highlights automatically when a `language` is set by
 * lazy-loading the bundled `cinder/highlighters/shiki` adapter on the
 * client. Consumers who want a different highlighter (a non-default theme, a
 * non-Shiki engine, a pre-configured `shikiHighlighter()` instance) implement
 * this type and pass the function to `<CodeBlock highlighter={...} />`.
 *
 * This file holds the canonical type so plain `.ts` consumers and `.svelte`
 * components can both `import type` it without going through a component
 * module path. Keep it free of component/value imports so it never forms an
 * import cycle.
 */

/**
 * Signature of a syntax highlighter callback. Receives the raw `code` and
 * `lang` and returns an HTML string (sync or async) that replaces
 * `<CodeBlock>`'s default `<pre><code>` markup — including the
 * `cinder-code-block__pre` / `__code` classes — so the highlighter is also
 * responsible for matching any structural CSS the consumer relies on (Shiki's
 * own `<pre class="shiki ...">` output covers most cases).
 *
 * @security The returned string is rendered VERBATIM via `{@html}` inside
 * `<CodeBlock>`. It is a trusted-HTML boundary: the highlighter MUST escape
 * every byte of caller- or user-provided `code` before returning markup, or
 * it opens an HTML-injection / XSS hole. The narrow safety claim cinder makes
 * is only this: the bundled `cinder/highlighters/shiki` adapter WITH DEFAULT
 * OPTIONS escapes its input (Shiki's `codeToHtml` escapes, and the adapter's
 * plaintext fallback HTML-escapes). Any custom `highlighter`, and any Shiki
 * usage with custom transformers / decorations / raw-HTML options, is a
 * caller-owned trust boundary that cinder does not and cannot vouch for. When
 * highlighting is undesirable, prefer `highlight={false}` — that path escapes
 * the code via Svelte text interpolation and never touches `{@html}`.
 */
export type Highlighter = (code: string, lang: string) => string | Promise<string>;
