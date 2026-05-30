/**
 * Unit tests for the example-metadata extractor.
 *
 * These assert observable behavior (parsed title/description for a given source
 * string), never the regex internals — so downstream refactors (named capture
 * groups, an added warn on missing title, etc.) don't break them.
 */

import { describe, expect, it } from 'bun:test';

import {
  extractExampleMetadataFromSource,
  unescapeStringLiteral,
} from './example-metadata.ts';

describe('extractExampleMetadataFromSource — title', () => {
  it('extracts a single-quoted title', () => {
    const source = `export const title = 'Basic usage';`;
    expect(extractExampleMetadataFromSource(source).title).toBe('Basic usage');
  });

  it('extracts a double-quoted title', () => {
    const source = `export const title = "Basic usage";`;
    expect(extractExampleMetadataFromSource(source).title).toBe('Basic usage');
  });

  it('extracts a backtick (template-literal) title', () => {
    const source = 'export const title = `Basic usage`;';
    expect(extractExampleMetadataFromSource(source).title).toBe('Basic usage');
  });

  it('unescapes an escaped backslash inside the title', () => {
    // Source literal: 'Path: C:\\Users' → rendered: Path: C:\Users
    const source = String.raw`export const title = 'Path: C:\\Users';`;
    expect(extractExampleMetadataFromSource(source).title).toBe('Path: C:\\Users');
  });

  it('unescapes an escaped same-style quote inside the title', () => {
    // Source literal: 'It\'s working' → rendered: It's working
    const source = String.raw`export const title = 'It\'s working';`;
    expect(extractExampleMetadataFromSource(source).title).toBe("It's working");
  });

  it('preserves unicode characters in the title', () => {
    const source = `export const title = 'Café — 日本語 ✓';`;
    expect(extractExampleMetadataFromSource(source).title).toBe('Café — 日本語 ✓');
  });

  it('unescapes a \\n escape sequence in the title', () => {
    const source = String.raw`export const title = 'Line one\nLine two';`;
    expect(extractExampleMetadataFromSource(source).title).toBe('Line one\nLine two');
  });

  it('does not break when the title contains a literal </script>', () => {
    // The closing-tag sequence inside the string must not terminate parsing.
    const source = `export const title = 'Before </script> after';`;
    expect(extractExampleMetadataFromSource(source).title).toBe('Before </script> after');
  });

  it('tolerates flexible whitespace around the assignment', () => {
    const source = `export   const    title   =   'Spaced';`;
    expect(extractExampleMetadataFromSource(source).title).toBe('Spaced');
  });
});

describe('extractExampleMetadataFromSource — missing title', () => {
  it('falls back to "Untitled" without throwing when no title export exists', () => {
    const source = `export const description = 'Only a description here';`;
    let meta: ReturnType<typeof extractExampleMetadataFromSource> | undefined;
    expect(() => {
      meta = extractExampleMetadataFromSource(source);
    }).not.toThrow();
    expect(meta?.title).toBe('Untitled');
  });

  it('falls back to "Untitled" for completely empty source', () => {
    expect(extractExampleMetadataFromSource('').title).toBe('Untitled');
  });

  it('does not match a non-exported `const title`', () => {
    // The export keyword is required; a local const must not be picked up.
    const source = `const title = 'Local only';`;
    expect(extractExampleMetadataFromSource(source).title).toBe('Untitled');
  });
});

describe('extractExampleMetadataFromSource — description', () => {
  it('extracts a single-line description', () => {
    const source = `export const description = 'A short blurb';`;
    expect(extractExampleMetadataFromSource(source).description).toBe('A short blurb');
  });

  it('extracts a multi-line description from a template literal', () => {
    const source = [
      'export const description = `First line',
      'Second line',
      'Third line`;',
    ].join('\n');
    expect(extractExampleMetadataFromSource(source).description).toBe(
      'First line\nSecond line\nThird line',
    );
  });

  it('omits description entirely (not "") when no description export exists', () => {
    const source = `export const title = 'Title only';`;
    const meta = extractExampleMetadataFromSource(source);
    expect(meta.description).toBeUndefined();
    expect('description' in meta).toBe(false);
  });

  it('extracts both title and description together', () => {
    const source = [
      `export const title = 'My Example';`,
      `export const description = 'What it shows';`,
    ].join('\n');
    const meta = extractExampleMetadataFromSource(source);
    expect(meta.title).toBe('My Example');
    expect(meta.description).toBe('What it shows');
  });

  it('preserves an empty-string description as "" when explicitly authored', () => {
    // An explicitly-empty description is a real (if odd) authored value; it is
    // present in the source, so it should be present in the result.
    const source = `export const description = '';`;
    const meta = extractExampleMetadataFromSource(source);
    expect(meta.description).toBe('');
    expect('description' in meta).toBe(true);
  });
});

describe('unescapeStringLiteral', () => {
  it('resolves \\n, \\t, and \\r', () => {
    expect(unescapeStringLiteral(String.raw`a\nb\tc\rd`)).toBe('a\nb\tc\rd');
  });

  it('resolves an escaped backslash', () => {
    expect(unescapeStringLiteral(String.raw`a\\b`)).toBe('a\\b');
  });

  it('resolves the three escaped quote styles', () => {
    expect(unescapeStringLiteral(String.raw`\'\"\``)).toBe('\'"`');
  });

  it('passes through an unknown escape as the bare character', () => {
    // `\x` is not a recognized escape, so it resolves to a literal `x`.
    expect(unescapeStringLiteral(String.raw`a\xb`)).toBe('axb');
  });

  it('leaves a string with no escapes unchanged', () => {
    expect(unescapeStringLiteral('plain text')).toBe('plain text');
  });
});
