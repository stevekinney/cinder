import type { Highlighter } from '../../utilities/highlighter.ts';

/**
 * Props for the CodeBlock component.
 *
 * Renders preformatted code in a `<pre><code>` element. The plain (un-highlighted)
 * path is Svelte-text-interpolated, so HTML entities are escaped automatically.
 *
 * Syntax highlighting is automatic: when `language` is set, CodeBlock
 * lazy-loads the bundled `cinder/highlighters/shiki` adapter on the client and
 * enhances the block once it resolves. The server (and the first client paint)
 * always emits the plain `<pre><code>` fallback — highlighting is a two-phase,
 * client-only enhancement, so there is a brief flash before the highlighted
 * HTML swaps in. Pass `highlight={false}` to keep `language` semantics (the
 * header label) with zero highlighting and zero Shiki import. Pass a custom
 * `highlighter` to override the bundled default per instance.
 */
export type CodeBlockProps = {
  /** The code to render. */
  code: string;
  /** Optional language label rendered in the header; also selects the grammar for highlighting. */
  language?: string;
  /**
   * Whether to highlight. Defaults to `true` whenever `language` is set.
   *
   * `highlight={false}` is an absolute off switch: it disables ALL
   * highlighting — including an explicit `highlighter` prop — and triggers no
   * Shiki import. The block renders the escaped plain `<pre><code>` fallback
   * while keeping the `language` header label.
   */
  highlight?: boolean;
  /**
   * Custom highlighter for this instance, used in place of the bundled Shiki
   * default. Receives `(code, language)` and returns an HTML string (sync or
   * async). When provided, the default highlighter is never imported.
   *
   * @security The returned string is rendered VERBATIM via `{@html}` — it is a
   * trusted-HTML boundary. The highlighter MUST escape any user- or
   * caller-provided `code` before returning markup, or it opens an
   * HTML-injection / XSS hole. cinder's only safety guarantee is that the
   * bundled `cinder/highlighters/shiki` adapter WITH DEFAULT OPTIONS escapes
   * code text; a custom `highlighter` (and Shiki with custom transformers /
   * decorations / raw-HTML options) is caller-owned and not vouched for. Use
   * `highlight={false}` when you want guaranteed-escaped plaintext.
   */
  highlighter?: Highlighter;
  /** When true, render a copy button in the header. */
  copyable?: boolean;
  /** Additional class names merged with `.cinder-code-block`. */
  class?: string;
};
