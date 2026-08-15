/**
 * Shared, front-matter-aware document normalization for diff-like exports.
 *
 * `normalize()` (`@lostgradient/markdown/pipeline`) is a Markdown pipeline with no
 * front-matter step. Handed a whole document — front matter and body together —
 * it re-reads the opening `---` as a thematic break and the YAML lines closed by
 * the second `---` as a setext heading, whose underline it re-emits as a run of
 * dashes as long as the longest line it underlines. The YAML itself gets
 * rewritten (blank lines injected, sequence-item indentation lost) and every
 * following line shifts.
 *
 * `generateUnifiedDiff` sidesteps this by splitting front matter off and
 * normalizing only the body (cinder#1285). This module is that same fix,
 * factored out so it has exactly one implementation instead of one per
 * consumer: `generateUnifiedDiff` (`unified-diff.ts`), the ReviewEditor
 * toolbar's `diffStats` (`review-editor-diff-stats.ts`, cinder#1307), and
 * `generateMarkdownSummary` (`markdown-summary.ts`, cinder#1318) all call
 * {@link normalizeDocument} rather than re-deriving their own front-matter
 * handling.
 */
import { normalize, parseFrontMatter } from '@lostgradient/markdown/pipeline';

export interface DocumentParts {
  /** The fenced front-matter block verbatim, including the newline that closes it. */
  frontMatter: string;
  /** The blank line between front matter and body, collapsed to at most one. */
  separator: string;
  /** Everything after the front matter block. */
  body: string;
}

/**
 * Split a document into its verbatim front-matter block and its body.
 *
 * CRLF is normalized to LF first: `parseFrontMatter`'s fence matching and every
 * downstream line-based diff in this package assume LF, so doing it once here
 * keeps `frontMatter`/`body` consistent with each other.
 */
export function splitDocument(content: string): DocumentParts {
  const text = content.replace(/\r\n?/g, '\n');
  const parsed = parseFrontMatter(text);
  if (!parsed.hasFrontMatter) return { frontMatter: '', separator: '', body: text };

  return {
    frontMatter: text.slice(0, text.length - parsed.body.length),
    // normalize() collapses runs of blank lines to a single one, so apply the same
    // rule to the gap after the front matter rather than copying it verbatim —
    // otherwise a whitespace-only difference there would surface as a phantom hunk.
    separator: parsed.body.startsWith('\n') ? '\n' : '',
    body: parsed.body,
  };
}

/**
 * Canonicalize a whole document for diffing or change-counting: front matter
 * kept byte-for-byte, body run through the Markdown pipeline, blank-line
 * padding between them collapsed to at most one line.
 *
 * Note: normalize() adds a trailing newline; we strip it to avoid phantom empty lines.
 */
export function normalizeDocument(content: string): string {
  if (!content.trim()) return '';

  const { frontMatter, separator, body } = splitDocument(content);
  const normalizedBody = body.trim() ? normalize(body).replace(/\n+$/, '') : '';
  if (!frontMatter) return normalizedBody;
  if (!normalizedBody) return frontMatter.replace(/\n+$/, '');

  return `${frontMatter}${separator}${normalizedBody}`;
}
