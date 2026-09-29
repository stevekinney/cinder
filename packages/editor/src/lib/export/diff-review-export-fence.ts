/**
 * Literal-block fencing for the diff-review agent export (DR-5, "Export literalness and existing
 * threads").
 *
 * Every excerpt of source text, every authored comment body, and the review-level note are
 * rendered as literal text inside a fenced block, with no info string, so a reader (human or
 * model) never treats their content as Markdown/HTML to interpret. The fence itself must be
 * longer than any run of backticks the content contains, or the content could itself close the
 * block early; per the contract, fence length is `max(3, longest contiguous backtick run in
 * content + 1)`.
 *
 * The two newlines wrapping the content are structural — added unconditionally, never merged
 * with or trimmed against the content's own leading/trailing newlines — so a body's own trailing
 * newline is preserved as a literal blank line before the closing fence rather than silently
 * absorbed into the structural one.
 *
 * @module
 */

const BACKTICK_RUN_PATTERN = /`+/g;

/** The minimum fence length the contract requires even for content with no backticks at all. */
const MINIMUM_FENCE_LENGTH = 3;

/**
 * The exact backtick fence for `content`: long enough that no run of backticks already inside
 * `content` could be mistaken for (or prematurely close) the fence itself.
 */
export function backtickFenceFor(content: string): string {
  let longestRun = 0;
  for (const run of content.match(BACKTICK_RUN_PATTERN) ?? []) {
    longestRun = Math.max(longestRun, run.length);
  }
  return '`'.repeat(Math.max(MINIMUM_FENCE_LENGTH, longestRun + 1));
}

/**
 * Wraps `content` in a fenced block with no info string, verbatim and untrimmed. Structural
 * newlines always separate the fences from the content, regardless of whether `content` already
 * ends in one.
 */
export function literalFencedBlock(content: string): string {
  const fence = backtickFenceFor(content);
  return `${fence}\n${content}\n${fence}`;
}
