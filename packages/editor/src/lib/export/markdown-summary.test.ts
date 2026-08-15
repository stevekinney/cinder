// @ts-nocheck -- migrated commentary assertions use runtime-verified fixture indexing.
/**
 * Tests for LLM Markdown summary export functionality.
 */

import { describe, expect, test } from 'bun:test';
import type { PersistedThread, ReviewState } from '../comments/types.js';
import { generateMarkdownSummary } from './markdown-summary';

/** Create a minimal ReviewState for testing */
function createState(
  options: {
    original?: string;
    current?: string;
    threads?: PersistedThread[];
  } = {},
): ReviewState {
  return {
    schemaVersion: 4,
    content: options.current ?? 'Current content',
    original: options.original ?? 'Original content',
    threads: options.threads ?? [],
    updatedAt: new Date().toISOString(),
  };
}

/** Create a test thread */
function createThread(
  options: {
    id?: string;
    quote?: string;
    line?: number;
    status?: 'anchored' | 'orphaned';
    comments?: Array<{ id: string; authorId: string; body: string; deletedAt?: string }>;
  } = {},
): PersistedThread {
  const now = new Date().toISOString();
  const threadId = options.id ?? 'thread-1';

  // Build comments with required fields filled in
  const comments = options.comments
    ? options.comments.map((c) => ({
        ...c,
        threadId,
        createdAt: now,
      }))
    : [
        {
          id: 'comment-1',
          threadId,
          authorId: 'user-123',
          body: 'Test comment',
          createdAt: now,
        },
      ];

  return {
    id: threadId,
    anchor: {
      quote: options.quote ?? 'selected text',
      prefix: 'before ',
      suffix: ' after',
      status: options.status ?? 'anchored',
      originalPosition: {
        offset: 0,
        line: options.line ?? 1,
        column: 1,
      },
    },
    comments,
    createdAt: now,
  };
}

describe('generateMarkdownSummary', () => {
  describe('basic structure', () => {
    test('returns empty message when no changes or feedback', () => {
      const state = createState({
        original: 'Same content',
        current: 'Same content',
        threads: [],
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toBe('No changes or feedback to report.');
    });

    test('does not include statistics section', () => {
      const state = createState({
        threads: [createThread()],
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).not.toContain('## Statistics');
    });

    test('does not include Review Summary header', () => {
      const state = createState({
        threads: [createThread()],
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).not.toContain('# Review Summary');
    });

    test('returns correct stats object', () => {
      const state = createState({
        threads: [createThread()],
      });
      const result = generateMarkdownSummary(state);

      expect(result.stats.threadCount).toBe(1);
    });
  });

  describe('document changes section', () => {
    test('includes changes when content differs', () => {
      const state = createState({
        original: 'Hello world',
        current: 'Hello universe',
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toContain('## Changes Made');
      expect(result.stats.changeCount).toBeGreaterThan(0);
    });

    test('includes explanatory text for changes', () => {
      const state = createState({
        original: 'Hello world',
        current: 'Hello universe',
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toContain('The following edits were made');
    });

    test('omits changes section when content is identical', () => {
      const state = createState({
        original: 'Same content',
        current: 'Same content',
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).not.toContain('## Changes Made');
      expect(result.stats.changeCount).toBe(0);
    });

    test('shows diff format with + and - prefixes', () => {
      const state = createState({
        original: 'Old line',
        current: 'New line',
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toContain('-Old line');
      expect(result.markdown).toContain('+New line');
    });

    test('calculates line range correctly when additions are present', () => {
      const state = createState({
        original: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5',
        current: 'Line 1\nModified 2\nNew Line A\nNew Line B\nLine 3\nLine 4\nLine 5',
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toMatch(/### Lines 1-4/);
      expect(result.markdown).not.toMatch(/### Lines 1-[5-9]/);
    });
  });

  describe('feedback section', () => {
    test('includes feedback section when threads exist', () => {
      const state = createState({
        threads: [createThread()],
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toContain('## Feedback');
    });

    test('includes explanatory text for feedback', () => {
      const state = createState({
        threads: [createThread()],
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toContain('may require action');
    });

    test('omits feedback section when no threads', () => {
      const state = createState({ threads: [] });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).not.toContain('## Feedback');
    });

    test('shows thread anchor quote in heading', () => {
      const state = createState({
        threads: [createThread({ quote: 'important text' })],
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toContain('### On "important text"');
    });

    test('uses document-level heading for empty quotes', () => {
      const thread = createThread({ quote: '' });
      // Clear the quote to simulate document-level comment
      thread.anchor.quote = '';
      const state = createState({ threads: [thread] });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toContain('### Document-level feedback');
    });

    test('does not include author IDs by default', () => {
      const state = createState({
        threads: [createThread()],
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).not.toContain('user-123');
    });

    test('includes author IDs when option is true', () => {
      const state = createState({
        threads: [createThread()],
      });
      const result = generateMarkdownSummary(state, { includeAuthorIds: true });

      expect(result.markdown).toContain('user-123');
    });

    test('does not include timestamps by default', () => {
      const state = createState({
        threads: [createThread()],
      });
      const result = generateMarkdownSummary(state);

      // Should not contain ISO timestamp format in parentheses
      expect(result.markdown).not.toMatch(/\(\d{4}-\d{2}-\d{2}T/);
    });

    test('includes timestamps when option is true', () => {
      const state = createState({
        threads: [createThread()],
      });
      const result = generateMarkdownSummary(state, { includeTimestamps: true });

      // Should contain ISO timestamp format
      expect(result.markdown).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('soft-deleted comments', () => {
    test('excludes soft-deleted comments', () => {
      const thread = createThread({
        comments: [
          {
            id: 'visible',
            authorId: 'user-1',
            body: 'Visible comment',
          },
          {
            id: 'deleted',
            authorId: 'user-2',
            body: 'Deleted comment',
            deletedAt: new Date().toISOString(),
          },
        ],
      });
      const state = createState({ threads: [thread] });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toContain('Visible comment');
      expect(result.markdown).not.toContain('Deleted comment');
    });

    test('excludes threads with only deleted comments', () => {
      const thread = createThread({
        comments: [
          {
            id: 'deleted',
            authorId: 'user-1',
            body: 'Deleted comment',
            deletedAt: new Date().toISOString(),
          },
        ],
      });
      const state = createState({ threads: [thread] });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).not.toContain('## Feedback');
    });
  });

  describe('orphaned anchors', () => {
    test('marks the quote as gone from the document', () => {
      const state = createState({
        threads: [createThread({ quote: 'vanished text', status: 'orphaned' })],
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toContain('### On "vanished text" (no longer in the document)');
    });

    test('still reports the feedback itself', () => {
      const state = createState({
        threads: [createThread({ quote: 'vanished text', status: 'orphaned' })],
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toContain('Test comment');
      expect(result.stats.threadCount).toBe(1);
    });

    test('leaves anchored threads unlabelled', () => {
      const state = createState({
        threads: [createThread({ quote: 'present text' })],
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toContain('### On "present text"\n');
      expect(result.markdown).not.toContain('no longer in the document');
    });

    test('claims no position for the vanished text', () => {
      // The summary is the one format that never printed coordinates, which is
      // why the quote heading was its only misleading signal. Keep it that way:
      // an orphan's stored offsets describe a document that no longer exists.
      const state = createState({
        original: 'Unchanged content',
        current: 'Unchanged content',
        threads: [createThread({ quote: 'vanished text', status: 'orphaned', line: 12 })],
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).not.toContain('offset');
      expect(result.markdown).not.toMatch(/Line \d+/);
      expect(result.markdown).not.toContain('position');
    });
  });

  describe('statistics (internal)', () => {
    test('counts changes correctly', () => {
      const state = createState({
        original: 'Line 1\nLine 2',
        current: 'Line 1\nModified',
      });
      const result = generateMarkdownSummary(state);

      expect(result.stats.changeCount).toBeGreaterThan(0);
    });

    test('counts threads correctly', () => {
      const state = createState({
        threads: [createThread({ id: 'thread-1' }), createThread({ id: 'thread-2' })],
      });
      const result = generateMarkdownSummary(state);

      expect(result.stats.threadCount).toBe(2);
    });
  });

  describe('normalization (cinder#1318)', () => {
    // generateMarkdownSummary used to run computeLineDiff directly on the raw
    // original/current strings, with no CRLF handling and no front-matter
    // awareness — unlike generateUnifiedDiff, whose normalizeInputs default
    // runs both through normalizeDocument first. That gap let the two exports
    // disagree about whether the exact same ReviewState contained a real edit.

    test('front matter, repro 1: blank-line padding after the closing fence is not a change', () => {
      // Exact repro from cinder#1318. Same front matter, same body text; the
      // only difference is how many blank lines separate the closing `---`
      // from the body (one vs. three). generateUnifiedDiff already reports
      // zero hunks for this pair — generateMarkdownSummary must agree.
      const frontMatter = ['---', 'title: Release Plan', 'draft: true', '---'].join('\n');
      const state = createState({
        original: `${frontMatter}\n\nAlpha line.`,
        current: `${frontMatter}\n\n\n\nAlpha line.`,
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toBe('No changes or feedback to report.');
      expect(result.stats.changeCount).toBe(0);
    });

    test('front matter, repro 1 with feedback: the changes section is omitted, the feedback section is not', () => {
      const frontMatter = ['---', 'title: Release Plan', 'draft: true', '---'].join('\n');
      const state = createState({
        original: `${frontMatter}\n\nAlpha line.`,
        current: `${frontMatter}\n\n\n\nAlpha line.`,
        threads: [createThread()],
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).not.toContain('## Changes Made');
      expect(result.markdown).toContain('## Feedback');
      expect(result.stats.changeCount).toBe(0);
    });

    test('repro 2: blank-line padding with no front matter at all is not a change', () => {
      // Proves the root cause is missing normalization in general, not a gap
      // specific to front-matter parsing.
      const state = createState({
        original: 'Alpha.\n\nBeta.',
        current: 'Alpha.\n\n\n\nBeta.',
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toBe('No changes or feedback to report.');
      expect(result.stats.changeCount).toBe(0);
    });

    test('CRLF-only differences are not a change, and no literal \\r reaches the diff fence', () => {
      const state = createState({
        original: 'Line 1\r\nLine 2\r\nLine 3',
        current: 'Line 1\nLine 2\nLine 3',
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toBe('No changes or feedback to report.');
      expect(result.stats.changeCount).toBe(0);
    });

    test('a genuine edit alongside CRLF differences is still reported, without a stray \\r', () => {
      const state = createState({
        original: 'Line 1\r\nLine 2\r\nLine 3',
        current: 'Line 1\nLine 2 modified\nLine 3',
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toContain('## Changes Made');
      expect(result.markdown).toContain('+Line 2 modified');
      expect(result.markdown).not.toContain('\r');
    });

    test('normalizeInputs: false restores the raw, unnormalized comparison', () => {
      // For callers that want formatting-only differences (blank-line
      // padding, Markdown canonicalization) to count as edits.
      const frontMatter = ['---', 'title: Release Plan', 'draft: true', '---'].join('\n');
      const state = createState({
        original: `${frontMatter}\n\nAlpha line.`,
        current: `${frontMatter}\n\n\n\nAlpha line.`,
      });
      const result = generateMarkdownSummary(state, { normalizeInputs: false });

      expect(result.markdown).toContain('## Changes Made');
      expect(result.stats.changeCount).toBeGreaterThan(0);
    });

    test('normalizeInputs: false preserves CRLF differences too — a genuinely raw comparison', () => {
      // Deliberately does NOT mirror generateUnifiedDiff's own normalizeInputs:
      // false branch, which still folds CRLF to LF even with normalization
      // "off". This option's doc comment promises a raw, verbatim comparison;
      // a CRLF-only difference must count as an edit for that promise to be
      // true rather than true only for some kinds of formatting difference.
      const state = createState({
        original: 'Line 1\r\nLine 2\r\nLine 3',
        current: 'Line 1\nLine 2\nLine 3',
      });
      const result = generateMarkdownSummary(state, { normalizeInputs: false });

      expect(result.markdown).toContain('## Changes Made');
      expect(result.stats.changeCount).toBeGreaterThan(0);
    });
  });

  describe('line numbers reference source, not normalized text (cinder#1324)', () => {
    test('the exact cinder#1324 repro: reports the source line, not the normalized one', () => {
      // normalizeDocument() collapses the run of 3 blank lines to 1, so
      // "Original text" is normalized-document line 3 but source line 5.
      // The heading must report the source line.
      const state = createState({
        original: 'Alpha\n\n\n\nOriginal text\n',
        current: 'Alpha\n\n\n\nChanged text\n',
      });
      const result = generateMarkdownSummary(state, { contextLines: 0 });

      expect(result.markdown).toMatch(/### Lines 5-5/);
      expect(result.markdown).not.toMatch(/### Lines 3-3/);
    });

    test('the end line, not just the start line, is mapped through the collapsed run -- "start + count - 1" would undercount it', () => {
      // With the default 2 lines of context, the displayed range covers the
      // entire (short) document: normalized-document lines 1-3 ("Alpha",
      // blank, the edited line). Naive "start + count - 1" arithmetic in
      // normalized-space (1 + 3 - 1 = 3) would report line 3 for the end --
      // still wrong, even with the start correctly mapped -- because the
      // collapsed blank-line run sits *inside* the displayed range. The
      // edited line must be reported at its own mapped position (5), not
      // derived from the start and a normalized-space line count.
      const state = createState({
        original: 'Alpha\n\n\n\nOriginal text\n',
        current: 'Alpha\n\n\n\nChanged text\n',
      });
      const result = generateMarkdownSummary(state);

      expect(result.markdown).toMatch(/### Lines 1-5/);
      expect(result.markdown).not.toMatch(/### Lines 1-3/);
    });

    test('interaction with cinder#1325: a false-positive front-matter block is now body, and its reported line stays source-accurate', () => {
      // Before cinder#1325, this `---`-opening span (invalid YAML) would
      // have been classified as front matter and preserved byte-for-byte,
      // so the blank-run collapse below it would never interact with it.
      // After cinder#1325, it's ordinary body content the normalizer
      // reaches -- both fixes have to agree on where "line 7" is.
      const state = createState({
        original: ['---', 'owner: [', '---', '', '', '', 'Original text', ''].join('\n'),
        current: ['---', 'owner: [', '---', '', '', '', 'Changed text', ''].join('\n'),
      });
      const result = generateMarkdownSummary(state, { contextLines: 0 });

      expect(result.markdown).toMatch(/### Lines 7-7/);
    });

    test('normalizeInputs: false reports normalized-space numbers unchanged (identity map)', () => {
      const state = createState({
        original: 'Alpha\n\n\n\nOriginal text\n',
        current: 'Alpha\n\n\n\nChanged text\n',
      });
      const result = generateMarkdownSummary(state, { contextLines: 0, normalizeInputs: false });

      // No normalization means no drift: line 5 is exactly where it always was.
      expect(result.markdown).toMatch(/### Lines 5-5/);
    });

    test('a pure trailing addition reports the "insert after EOF" position, not the last real line (review finding)', () => {
      // mapNormalizedLineNumber used to clamp any out-of-range lookup to the
      // map's last real entry. A pure addition past the end of `original`
      // legitimately produces a lookup one past the map's length ("insert
      // after this line") -- clamping silently relocated that onto the
      // document's last real line instead of reporting it as after it.
      const state = createState({
        original: 'Alpha',
        current: 'Alpha\nBeta',
      });
      const result = generateMarkdownSummary(state, { contextLines: 0, normalizeInputs: false });

      expect(result.markdown).toMatch(/### Lines 2-2/);
      expect(result.markdown).not.toMatch(/### Lines 1-1/);
    });

    test("extrapolates from the source document's true end, not the normalized document's, when normalization strips trailing lines entirely (review finding, follow-up)", () => {
      // Distinct from the test above: this uses DEFAULT normalization (not
      // normalizeInputs: false), against a source with real trailing blank
      // lines that normalizeDocument() strips away entirely rather than
      // collapsing to a representative line -- `original` here is 3 source
      // lines (Alpha, blank, blank) that normalize to just "Alpha" (1 line).
      // Anchoring the "insert after EOF" extrapolation to the *normalized*
      // line count (1) instead of the *source*'s real line count (3) reports
      // the addition several lines too early.
      const state = createState({
        original: 'Alpha\n\n\n',
        current: 'Alpha\n\n\nBeta',
      });
      const result = generateMarkdownSummary(state, { contextLines: 0 });

      expect(result.markdown).toMatch(/### Lines 4-4/);
      expect(result.markdown).not.toMatch(/### Lines 2-2/);
    });

    test('a normalized line rewritten by normalization (not just deleted) maps to its own line, not the line before it (review finding)', () => {
      // A Setext heading collapses two source lines into one normalized ATX
      // line, which has no verbatim match in the source. The naive fallback
      // -- freeze on the nearest preceding match -- would report the blank
      // line above the heading; interpolating forward instead reports the
      // heading's own line.
      const state = createState({
        original: 'Intro\n\nOld title\n===\n',
        current: 'Intro\n\nNew title\n===\n',
      });
      const result = generateMarkdownSummary(state, { contextLines: 0 });

      expect(result.markdown).toMatch(/### Lines 3-3/);
      expect(result.markdown).not.toMatch(/### Lines 2-2/);
    });

    test('a rewritten list item does not absorb a deleted separator line into its own position (review finding)', () => {
      // normalize() both rewrites `*` markers to `-` and deletes the blank
      // line between tight list items in the same pass. Editing the second
      // item must report its own source line (5), not the deleted blank
      // separator's line (4) that a marker-blind alignment would land on.
      const state = createState({
        original: 'Intro\n\n* one\n\n* old\n',
        current: 'Intro\n\n* one\n\n* new\n',
      });
      const result = generateMarkdownSummary(state, { contextLines: 0 });

      expect(result.markdown).toMatch(/### Lines 5-5/);
      expect(result.markdown).not.toMatch(/### Lines 4-4/);
    });
  });
});
