/**
 * Lexical front-matter prefix detection for template scanning.
 *
 * The global front-matter parser in `pipeline/frontmatter.ts` exposes no
 * source spans and treats malformed YAML as body text, so the template
 * scanner uses this small, span-exact helper instead. It never parses YAML
 * and emits no diagnostics.
 *
 * @internal
 * @module
 */

const LINE_FEED = 0x0a;
const CARRIAGE_RETURN = 0x0d;

/** Exactly three hyphens followed only by optional spaces or tabs. */
const DELIMITER_PATTERN = /^---[ \t]*$/;

interface SourceLine {
  /** The line's text without its line ending. */
  readonly content: string;
  /** Whether a line ending (LF, CR or CRLF) terminates the line. */
  readonly terminated: boolean;
  /** The offset just after the line ending, or the source length at EOF. */
  readonly next: number;
}

function readLine(source: string, start: number): SourceLine {
  let end = start;
  while (end < source.length) {
    const code = source.charCodeAt(end);
    if (code === LINE_FEED || code === CARRIAGE_RETURN) break;
    end++;
  }
  const content = source.slice(start, end);
  if (end === source.length) return { content, terminated: false, next: end };
  const crlf =
    source.charCodeAt(end) === CARRIAGE_RETURN && source.charCodeAt(end + 1) === LINE_FEED;
  return { content, terminated: true, next: end + (crlf ? 2 : 1) };
}

/**
 * The length of the closed front-matter prefix at the start of a template,
 * or `0` when there is none.
 *
 * At offset zero the opening line must be exactly `---`, optionally followed
 * by spaces or tabs, and then a line ending. The first later line that is
 * also exactly `---` plus optional spaces or tabs closes the prefix, whether
 * it ends with a line ending or at EOF; the returned length includes that
 * closing line ending. LF, CRLF and CR are all line endings. Enclosed YAML is
 * never parsed, so malformed YAML is still excluded. A byte order mark or any
 * text before the opener, or an opener with no closing line, yields `0`.
 *
 * @param source - The complete template source.
 * @returns The UTF-16 length of the prefix to exclude from placeholder scanning.
 */
export function templateFrontMatterPrefixLength(source: string): number {
  const opener = readLine(source, 0);
  if (!opener.terminated || !DELIMITER_PATTERN.test(opener.content)) return 0;
  let position = opener.next;
  while (position < source.length) {
    const line = readLine(source, position);
    if (DELIMITER_PATTERN.test(line.content)) return line.next;
    position = line.next;
  }
  return 0;
}
