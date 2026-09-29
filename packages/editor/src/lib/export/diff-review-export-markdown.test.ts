import { describe, expect, test } from 'bun:test';

import {
  emptyAndTrailingNewlineFixture,
  emptyReviewFixture,
  maliciousContentFixture,
  markdownTargetsFixture,
  twoSourceTargetsFixture,
} from './diff-review-export-fixtures.js';
import { exportDiffReviewMarkdown } from './diff-review-export.js';

function unwrap(result: ReturnType<typeof exportDiffReviewMarkdown>): string {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.error)}`);
  return result.value;
}

describe('DiffReview export Markdown', () => {
  test('a custom reviewTitle option replaces the default top-level heading', () => {
    const markdown = unwrap(
      exportDiffReviewMarkdown(twoSourceTargetsFixture, { reviewTitle: 'Custom review title' }),
    );
    expect(markdown.startsWith('# Custom review title\n')).toBe(true);
    expect(markdown).not.toContain('# Review feedback');
  });

  test('a comment with only a base revision label renders that one label, without an arrow', () => {
    const state = {
      ...twoSourceTargetsFixture,
      comments: [
        {
          ...twoSourceTargetsFixture.comments[0]!,
          capturedContext: {
            ...twoSourceTargetsFixture.comments[0]!.capturedContext,
            baseRevisionLabel: 'main',
            headRevisionLabel: undefined,
          },
        },
      ],
    };
    const markdown = unwrap(exportDiffReviewMarkdown(state));
    expect(markdown).toContain('Revision: main\n');
    expect(markdown).not.toContain('→');
  });

  test('renders the fixed preamble, scope, and totals line adjacent (no blank line between them)', () => {
    const markdown = unwrap(exportDiffReviewMarkdown(twoSourceTargetsFixture));
    expect(markdown).toContain(
      'Address open comments. Resolved comments are historical context. ' +
        'Verify outdated locations against current content before acting.',
    );
    expect(markdown).toContain(
      'Scope: all saved comments\nRecords: 3; message bodies: 3; open: 2; resolved: 1; outdated: 1',
    );
  });

  test('an unresolved-only export names its scope explicitly', () => {
    const markdown = unwrap(
      exportDiffReviewMarkdown(twoSourceTargetsFixture, { scope: 'unresolved' }),
    );
    expect(markdown).toContain('Scope: unresolved only');
  });

  test('an empty review states a zero-comment summary explicitly, still ending in exactly one newline', () => {
    const markdown = unwrap(exportDiffReviewMarkdown(emptyReviewFixture));
    expect(markdown).toContain('Records: 0; message bodies: 0; open: 0; resolved: 0; outdated: 0');
    expect(markdown.endsWith('\n')).toBe(true);
    expect(markdown.endsWith('\n\n')).toBe(false);
  });

  test('a resolved comment is present and explicitly labeled in the default export', () => {
    const markdown = unwrap(exportDiffReviewMarkdown(twoSourceTargetsFixture));
    expect(markdown).toContain('### Comment comment-resolved');
    expect(markdown).toContain('State: resolved, current');
  });

  test('an outdated comment is explicitly labeled verification-needed', () => {
    const markdown = unwrap(exportDiffReviewMarkdown(twoSourceTargetsFixture));
    expect(markdown).toContain('State: open, outdated (verification needed)');
  });

  test('a file comment states no fabricated line range', () => {
    const markdown = unwrap(exportDiffReviewMarkdown(twoSourceTargetsFixture));
    expect(markdown).toContain('Location: file comment');
  });

  test('a raw-source range comment names its side and inclusive line range', () => {
    const markdown = unwrap(exportDiffReviewMarkdown(twoSourceTargetsFixture));
    expect(markdown).toContain('Location: new side, raw-source lines 10–12');
  });

  test('a single-line range renders "line N", not a fabricated range', () => {
    const markdown = unwrap(exportDiffReviewMarkdown(twoSourceTargetsFixture));
    expect(markdown).toContain('Location: old side, raw-source line 5');
  });

  test('quoted source caps context to two lines on each side, from the middle of the three captured', () => {
    const markdown = unwrap(exportDiffReviewMarkdown(twoSourceTargetsFixture));
    // Three lines were captured on each side; only the nearest two are quoted.
    expect(markdown).not.toContain('// before-3');
    expect(markdown).toContain('// before-2');
    expect(markdown).toContain('// before-1');
    expect(markdown).toContain('// after-1');
    expect(markdown).toContain('// after-2');
    expect(markdown).not.toContain('// after-3');
  });

  test('a normalized-markdown comment never emits a raw coordinate, and is explicitly labeled', () => {
    const markdown = unwrap(exportDiffReviewMarkdown(markdownTargetsFixture));
    expect(markdown).toContain('Location: new side, normalized-markdown line 3');
    const normalizedCommentBlock = markdown.slice(
      markdown.indexOf('### Comment comment-normalized'),
      markdown.indexOf('## Target md-raw'),
    );
    expect(normalizedCommentBlock).not.toMatch(/raw-source/);
  });

  test('a raw-source Markdown comment (normalization disabled) is labeled raw-source with its exact range', () => {
    const markdown = unwrap(exportDiffReviewMarkdown(markdownTargetsFixture));
    expect(markdown).toContain('Location: old side, raw-source lines 8–9');
  });

  test('the review note is rendered inside a fenced literal block, verbatim', () => {
    const markdown = unwrap(exportDiffReviewMarkdown(markdownTargetsFixture));
    expect(markdown).toContain('## Review note');
    expect(markdown).toContain('Overall this looks good; a few docs nits below.');
  });

  test('no review-note section when the note is empty', () => {
    const markdown = unwrap(exportDiffReviewMarkdown(twoSourceTargetsFixture));
    expect(markdown).not.toContain('## Review note');
  });

  describe('malicious-looking fenced text and HTML', () => {
    const markdown = unwrap(exportDiffReviewMarkdown(maliciousContentFixture));

    test('the fence around the quoted source is longer than any backtick run inside it', () => {
      // The quoted source contains a run of four backticks ("````closing four") and a
      // three-backtick fence; the safe fence is five backticks: max(3, 4 + 1).
      expect(markdown).toContain(
        '`````\n```js\nconst x = "````closing four";\n```\n<script>alert(1)</script>\n`````',
      );
    });

    test('the fence around the feedback body is longer than its own longest backtick run', () => {
      // The body contains a run of six backticks; the safe fence is seven.
      expect(markdown).toContain(
        '```````\nEscaping looks wrong here: `````` and <img src=x onerror=alert(1)> should never render.\n```````',
      );
    });

    test('the fence around the review note is longer than its own longest backtick run', () => {
      // The note contains isolated triple-backtick runs; the safe fence is four.
      expect(markdown).toContain(
        '````\nNote contains ``` a fence ``` and <b>bold-looking</b> text.\n````',
      );
    });

    test('HTML-looking text is never unwrapped outside a fence', () => {
      expect(markdown.split('<script>alert(1)</script>').length - 1).toBe(1);
      // It only ever appears inside the fenced block just verified above.
    });
  });

  test('an empty quoted line (selectable blank source line) renders as an empty fenced block, not omitted', () => {
    const markdown = unwrap(exportDiffReviewMarkdown(emptyAndTrailingNewlineFixture));
    expect(markdown).toContain('Quoted source:\n\n```\nfunction f() {\n\n  return 1;\n```');
  });

  test('a body ending in a trailing newline preserves it as a literal blank line before the closing fence', () => {
    const markdown = unwrap(exportDiffReviewMarkdown(emptyAndTrailingNewlineFixture));
    expect(markdown).toContain('```\nFix this please.\n\n```');
  });

  test('repeated exports of identical input and options produce byte-identical output', () => {
    const first = unwrap(exportDiffReviewMarkdown(twoSourceTargetsFixture));
    const second = unwrap(exportDiffReviewMarkdown(twoSourceTargetsFixture));
    expect(first).toBe(second);
  });

  test('export never reads the wall clock: no module under diff-review-export-* references Date', async () => {
    const { readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const dir = dirname(fileURLToPath(import.meta.url));
    const modules = [
      'diff-review-export.ts',
      'diff-review-export-model.ts',
      'diff-review-export-markdown.ts',
      'diff-review-export-json.ts',
      'diff-review-export-fence.ts',
      'diff-review-export-document-threads.ts',
    ];
    for (const module of modules) {
      const source = readFileSync(join(dir, module), 'utf-8');
      expect(source).not.toMatch(/\bDate\b/);
    }
  });
});
