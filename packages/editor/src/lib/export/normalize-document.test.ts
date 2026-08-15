/**
 * Tests for the shared front-matter-aware document normalizer.
 *
 * This logic used to live only inside unified-diff.ts. It is factored out
 * here (cinder#1307, cinder#1318) so `generateUnifiedDiff`, the ReviewEditor
 * toolbar's `diffStats`, and `generateMarkdownSummary` all normalize whole
 * documents the same way instead of each carrying their own copy — the exact
 * defect class this module exists to stop from recurring a fourth time.
 */
import { describe, expect, test } from 'bun:test';
import { normalizeDocument, splitDocument } from './normalize-document.ts';

describe('splitDocument', () => {
  test('splits front matter from body, collapsing the separator to at most one newline', () => {
    const result = splitDocument('---\ntitle: Plan\n---\n\n\n\nBody text.\n');

    expect(result.frontMatter).toBe('---\ntitle: Plan\n---\n');
    expect(result.separator).toBe('\n');
    expect(result.body).toBe('\n\n\nBody text.\n');
  });

  test('returns an empty front matter for documents without one', () => {
    const result = splitDocument('Just body text.\n');

    expect(result.frontMatter).toBe('');
    expect(result.separator).toBe('');
    expect(result.body).toBe('Just body text.\n');
  });

  test('normalizes CRLF to LF before splitting', () => {
    const result = splitDocument('---\r\ntitle: Plan\r\n---\r\n\r\nBody.\r\n');

    expect(result.frontMatter).toBe('---\ntitle: Plan\n---\n');
    expect(result.body).toBe('\nBody.\n');
  });
});

describe('normalizeDocument', () => {
  test('keeps front matter byte-for-byte instead of reading it as Markdown', () => {
    const original = '---\ntitle: Plan\nowner: jane\n---\n\nBody.\n';
    const current = '---\ntitle: Plan\nowner: bob\n---\n\nBody.\n';

    // The bug this guards: normalize() has no front-matter step, so a document
    // handed to it whole gets its `---` fences read as a thematic break plus a
    // setext heading, and the underline gets rewritten to match content width.
    expect(normalizeDocument(original)).not.toMatch(/^-{4,}$/m);
    expect(normalizeDocument(current)).not.toMatch(/^-{4,}$/m);
    expect(normalizeDocument(original)).toContain('owner: jane');
    expect(normalizeDocument(current)).toContain('owner: bob');
  });

  test('collapses blank-line padding between front matter and body to one line', () => {
    const frontMatter = '---\ntitle: Plan\n---';
    const oneBlankLine = normalizeDocument(`${frontMatter}\n\nBody.`);
    const threeBlankLines = normalizeDocument(`${frontMatter}\n\n\n\nBody.`);

    expect(oneBlankLine).toBe(threeBlankLines);
  });

  test('still runs the body through the Markdown pipeline', () => {
    const original = '---\ntitle: Plan\n---\n\n- one\n- two\n';
    const starred = '---\ntitle: Plan\n---\n\n* one\n* two\n';

    expect(normalizeDocument(original)).toBe(normalizeDocument(starred));
  });

  test('returns an empty string for blank input', () => {
    expect(normalizeDocument('')).toBe('');
    expect(normalizeDocument('   \n  ')).toBe('');
  });

  test('handles a front-matter-only document with no body', () => {
    expect(normalizeDocument('---\ntitle: Plan\n---')).toBe('---\ntitle: Plan\n---');
  });
});
