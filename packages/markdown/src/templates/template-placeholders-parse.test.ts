/**
 * Exhaustive tests for template placeholder domain logic.
 * DEP-582: Pure functions with no ProseMirror or DOM dependencies.
 * DEP-625: Comprehensive security tests for prototype pollution and XSS prevention.
 */

import { describe, expect, it } from 'bun:test';

import { templateFrontMatterPrefixLength } from './placeholder-front-matter.js';
import {
  parseMarkdownPlaceholderTokens,
  parsePlaceholderTokens,
  unescapePlaceholderBody,
} from './template-placeholders.js';
import type { PlaceholderToken } from './types.js';

/** A token summary: kind, raw text and original offsets. */
function spans(tokens: readonly PlaceholderToken[]): Array<[string, string, number, number]> {
  return tokens.map((token) => [token.kind, token.raw, token.startOffset, token.endOffset]);
}

/** The placeholder token expected at the first occurrence of `raw` after `from`. */
function placeholderAt(source: string, raw: string, from = 0): [string, string, number, number] {
  const start = source.indexOf(raw, from);
  if (start === -1) throw new Error(`fixture does not contain ${raw}`);
  return ['placeholder', raw, start, start + raw.length];
}

describe('parsePlaceholderTokens', () => {
  it('parses a single well-formed token with correct fields', () => {
    const text = '{{input.x}}';
    const tokens = parsePlaceholderTokens(text);

    expect(tokens).toHaveLength(1);
    expect(tokens[0]!).toEqual({
      raw: '{{input.x}}',
      path: 'input.x',
      startOffset: 0,
      endOffset: 11,
      kind: 'placeholder',
    });
  });

  it('trims whitespace around path', () => {
    const text = '{{ input.x }}';
    const tokens = parsePlaceholderTokens(text);

    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.path).toBe('input.x');
    expect(tokens[0]!.raw).toBe('{{ input.x }}');
    expect(tokens[0]!.kind).toBe('placeholder');
  });

  it('parses adjacent tokens with correct non-overlapping offsets', () => {
    const text = '{{a}}{{b}}';
    const tokens = parsePlaceholderTokens(text);

    expect(tokens).toHaveLength(2);
    expect(tokens[0]!).toEqual({
      raw: '{{a}}',
      path: 'a',
      startOffset: 0,
      endOffset: 5,
      kind: 'placeholder',
    });
    expect(tokens[1]!).toEqual({
      raw: '{{b}}',
      path: 'b',
      startOffset: 5,
      endOffset: 10,
      kind: 'placeholder',
    });
  });

  it('returns two separate token objects for repeated same token', () => {
    const text = '{{x}} and {{x}}';
    const tokens = parsePlaceholderTokens(text);

    expect(tokens).toHaveLength(2);
    expect(tokens[0]!.path).toBe('x');
    expect(tokens[1]!.path).toBe('x');
    expect(tokens[0]!.startOffset).toBe(0);
    expect(tokens[1]!.startOffset).toBe(10);
    expect(tokens[0]!).not.toBe(tokens[1]!);
  });

  it('reports an unclosed token at end of string as malformed', () => {
    const text = '{{input.x';
    const tokens = parsePlaceholderTokens(text);

    expect(tokens).toHaveLength(1);
    expect(tokens[0]!).toEqual({
      raw: '{{input.x',
      path: 'input.x',
      startOffset: 0,
      endOffset: text.length,
      kind: 'malformed',
    });
  });

  it('returns a placeholder token with empty string path for empty body', () => {
    const text = '{{}}';
    const tokens = parsePlaceholderTokens(text);

    expect(tokens).toHaveLength(1);
    expect(tokens[0]!).toEqual({
      raw: '{{}}',
      path: '',
      startOffset: 0,
      endOffset: 4,
      kind: 'placeholder',
    });
  });

  it('returns empty array for text with no tokens', () => {
    expect(parsePlaceholderTokens('Hello world')).toEqual([]);
    expect(parsePlaceholderTokens('')).toEqual([]);
    expect(parsePlaceholderTokens('just { single braces }')).toEqual([]);
  });

  it('parses tokens interspersed with prose with correct offsets', () => {
    const text = 'Hello {{name}}, your {{item}} is ready';
    const tokens = parsePlaceholderTokens(text);

    expect(tokens).toHaveLength(2);

    expect(tokens[0]!).toEqual({
      raw: '{{name}}',
      path: 'name',
      startOffset: 6,
      endOffset: 14,
      kind: 'placeholder',
    });

    expect(tokens[1]!).toEqual({
      raw: '{{item}}',
      path: 'item',
      startOffset: 21,
      endOffset: 29,
      kind: 'placeholder',
    });
  });

  it('parses nested braces as-is for path body', () => {
    const text = '{{ {inner} }}';
    const tokens = parsePlaceholderTokens(text);

    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.path).toBe('{inner}');
    expect(tokens[0]!.kind).toBe('placeholder');
  });
});

describe('parsePlaceholderTokens grammar', () => {
  it('reports {{{name}}} as one malformed token over its whole span', () => {
    const text = '{{{name}}}';

    expect(spans(parsePlaceholderTokens(text))).toEqual([['malformed', text, 0, text.length]]);
    expect(text.length).toBe(10);
  });

  it('reports nested opening delimiters as one malformed token over the balanced span', () => {
    const text = '{{user {{name}}}}';

    expect(spans(parsePlaceholderTokens(text))).toEqual([['malformed', text, 0, text.length]]);
    expect(text.length).toBe(17);
  });

  it('keeps a valid token before an unclosed opener at the end', () => {
    const text = '{{name}} tail {{';
    const tailStart = '{{name}} tail '.length;

    expect(spans(parsePlaceholderTokens(text))).toEqual([
      ['placeholder', '{{name}}', 0, '{{name}}'.length],
      ['malformed', '{{', tailStart, tailStart + 2],
    ]);
    expect([tailStart, tailStart + 2]).toEqual([14, 16]);
  });

  it('stops an unbalanced triple-brace span at the line end', () => {
    const text = '{{{name}} x\n{{b}}';
    const lineEnd = text.indexOf('\n');

    expect(spans(parsePlaceholderTokens(text))).toEqual([
      ['malformed', text.slice(0, lineEnd), 0, lineEnd],
      placeholderAt(text, '{{b}}'),
    ]);
  });

  it('trims only spaces and tabs inside the delimiters', () => {
    const [spaced] = parsePlaceholderTokens('{{ \tname\t }}');
    const [nonBreaking] = parsePlaceholderTokens('{{\u00a0name}}');

    expect(spaced?.path).toBe('name');
    expect(nonBreaking?.path).toBe('\u00a0name');
  });

  it('never spans a line ending and counts CRLF as two code units', () => {
    const lf = '{{name\n}} {{b}}';
    const crlf = '{{a\r\n{{b}}';
    const cr = '{{a\r{{b}}';

    expect(spans(parsePlaceholderTokens(lf))).toEqual([
      ['malformed', '{{name', 0, 6],
      placeholderAt(lf, '{{b}}'),
    ]);
    expect(spans(parsePlaceholderTokens(crlf))).toEqual([
      ['malformed', '{{a', 0, 3],
      ['placeholder', '{{b}}', '{{a\r\n'.length, '{{a\r\n{{b}}'.length],
    ]);
    expect('{{a\r\n'.length).toBe(5);
    expect(spans(parsePlaceholderTokens(cr))).toEqual([
      ['malformed', '{{a', 0, 3],
      ['placeholder', '{{b}}', 4, 9],
    ]);
  });

  it('follows consecutive-backslash parity before the opening brace', () => {
    expect(parsePlaceholderTokens('\\{{a}}')).toEqual([]);
    expect(spans(parsePlaceholderTokens('\\\\{{a}}'))).toEqual([['placeholder', '{{a}}', 2, 7]]);
    expect(parsePlaceholderTokens('\\\\\\{{a}}')).toEqual([]);
    // The escaped brace is literal; the remaining `{{a}}` is an ordinary token.
    expect(spans(parsePlaceholderTokens('\\{{{a}}'))).toEqual([['placeholder', '{{a}}', 2, 7]]);
  });

  it('resolves a CommonMark backslash escape inside the body before computing the path', () => {
    // Source text: {{user\_name}} (one backslash) -- what the Markdown serializer
    // produces from {{user_name}} after a rich-mode round trip.
    const text = '{{user\\_name}}';
    const [token] = parsePlaceholderTokens(text);

    expect(text.length).toBe(14);
    expect(token).toEqual({
      raw: text,
      path: 'user_name',
      startOffset: 0,
      endOffset: 14,
      kind: 'placeholder',
    });
  });

  it('treats a backslash-escaped backslash as one literal backslash, read left to right', () => {
    // Source text: {{\\_}} (two backslashes then an underscore).
    const text = '{{\\\\_}}';
    const [token] = parsePlaceholderTokens(text);

    expect(text.length).toBe(7);
    expect(token?.path).toBe('\\_');
  });

  it('resolves the remaining escape golden cases from the issue', () => {
    // {{\_meta\_}} -> path "_meta_", range [0, 12).
    const meta = '{{\\_meta\\_}}';
    expect(meta.length).toBe(12);
    expect(spans(parsePlaceholderTokens(meta))).toEqual([['placeholder', meta, 0, 12]]);
    expect(parsePlaceholderTokens(meta)[0]?.path).toBe('_meta_');

    // {{a\*b}} -> path "a*b" (later invalid_path_format; not this scanner's job).
    expect(parsePlaceholderTokens('{{a\\*b}}')[0]?.path).toBe('a*b');

    // {{user\name}} -> a backslash before a non-escapable character stays,
    // so the path is "user\name" (later invalid_path_format).
    expect(parsePlaceholderTokens('{{user\\name}}')[0]?.path).toBe('user\\name');

    // {{a\}}} -> token [0, 6) with path "a\" (the trailing backslash precedes
    // no character inside the body, so it stays), followed by a literal "}".
    const trailing = '{{a\\}}}';
    expect(trailing.length).toBe(7);
    expect(spans(parsePlaceholderTokens(trailing))).toEqual([['placeholder', '{{a\\}}', 0, 6]]);
    expect(parsePlaceholderTokens(trailing)[0]?.path).toBe('a\\');

    // {{a\{{b}} -> one malformed_token under the unchanged nested-brace rule;
    // an escape inside the body never affects delimiter detection.
    const nested = '{{a\\{{b}}';
    expect(spans(parsePlaceholderTokens(nested))).toEqual([
      ['malformed', nested, 0, nested.length],
    ]);
  });

  it('keeps UTF-16 offsets for adjacent, repeated and Unicode-surrounded tokens', () => {
    const text = 'é{{a}}😀{{b}}{{a}}ß';

    expect(spans(parsePlaceholderTokens(text))).toEqual([
      ['placeholder', '{{a}}', 1, 6],
      ['placeholder', '{{b}}', 8, 13],
      ['placeholder', '{{a}}', 13, 18],
    ]);
    expect('é'.length + '{{a}}'.length + '😀'.length).toBe(8);
  });

  it('treats a trailing extra brace as literal text', () => {
    expect(spans(parsePlaceholderTokens('{{a}}}'))).toEqual([['placeholder', '{{a}}', 0, 5]]);
  });

  it('never throws on pathological brace runs', () => {
    const text = `${'{'.repeat(1000)}${'}'.repeat(999)}`;

    expect(spans(parsePlaceholderTokens(text))).toEqual([['malformed', text, 0, text.length]]);
  });
});

describe('parseMarkdownPlaceholderTokens eligibility', () => {
  it('finds tokens in paragraphs, headings, lists, blockquotes, tables, link labels and footnotes', () => {
    const source = [
      '# Heading {{a}}',
      '',
      'Setext {{b}}',
      '===',
      '',
      '- item {{c}}',
      '',
      '> quote {{d}}',
      '> more',
      '',
      '| head |',
      '| --- |',
      '| cell {{e}} |',
      '',
      '[label {{f}}](https://example.com) and **strong {{g}}**',
      '',
      '[^note]: footnote {{h}}',
      '',
      '<span>{{i}}</span>',
    ].join('\n');

    expect(spans(parseMarkdownPlaceholderTokens(source))).toEqual(
      ['{{a}}', '{{b}}', '{{c}}', '{{d}}', '{{e}}', '{{f}}', '{{g}}', '{{h}}', '{{i}}'].map((raw) =>
        placeholderAt(source, raw),
      ),
    );
  });

  it('excludes code, HTML, math, URLs, titles, definitions, alt text and autolinks', () => {
    const source = [
      '```',
      '{{fenced}}',
      '```',
      '',
      '    {{indented}}',
      '',
      '<div>',
      '{{html_block}}',
      '</div>',
      '',
      '$$',
      '{{block_math}}',
      '$$',
      '',
      'Inline `{{code}}` and $x{{math}}$ and <a title="{{attribute}}">x</a>.',
      '',
      '[link](https://example.com/{{destination}} "{{title}}") ![{{alt}}](image.png)',
      '',
      'www.example.com/{{literal}} and <https://example.com/{{angle}}>',
      '',
      '[reference]: https://example.com/{{definition}} "{{definition_title}}"',
      '',
      'Kept {{kept}}.',
    ].join('\n');

    expect(spans(parseMarkdownPlaceholderTokens(source))).toEqual([
      placeholderAt(source, '{{kept}}'),
    ]);
  });

  it('keeps escaped and entity-encoded opening braces literal', () => {
    const source = '\\{{escaped}} &#123;&#123;numeric}} &lbrace;&lbrace;named}} &#x7b;{hex}}';

    expect(parseMarkdownPlaceholderTokens(source)).toEqual([]);
  });

  it('resolves body backslash escapes the same way the plain-text scanner does', () => {
    // The Markdown-aware scanner delegates to parsePlaceholderTokens per text
    // run, so it inherits the escape rule: {{user\_name}} resolves to path
    // "user_name" (one literal backslash), and {{\_meta\_}} resolves to
    // "_meta_" -- the serialized, round-trip-safe form of {{_meta_}}, which
    // as raw unescaped Markdown is emphasis and splits into a malformed
    // token instead (covered separately).
    const source = 'Hello {{user\\_name}} and {{\\_meta\\_}}.';

    const tokens = parseMarkdownPlaceholderTokens(source);

    expect(tokens.map((token) => token.kind)).toEqual(['placeholder', 'placeholder']);
    expect(tokens.map((token) => token.path)).toEqual(['user_name', '_meta_']);
  });

  it('never lets a token span a formatting boundary', () => {
    const source = '{{a*b*}} and {{c**d**e}}';

    const tokens = parseMarkdownPlaceholderTokens(source);

    expect(tokens.every((token) => token.kind === 'malformed')).toBe(true);
    expect(spans(tokens)).toEqual([
      ['malformed', '{{a', 0, 3],
      ['malformed', '{{c', source.indexOf('{{c'), source.indexOf('{{c') + 3],
    ]);
  });

  it('keeps original offsets after multi-byte text and multi-line blockquotes', () => {
    const source = '😀 {{a}}\n\n> line {{b}}\n> next {{c}}';

    expect(spans(parseMarkdownPlaceholderTokens(source))).toEqual([
      placeholderAt(source, '{{a}}'),
      placeholderAt(source, '{{b}}'),
      placeholderAt(source, '{{c}}'),
    ]);
  });

  it('scans separate rich text runs without producing a token across a run boundary', () => {
    // A rich adapter scans each contiguous same-mark text run on its own,
    // exactly as the Markdown scanner does for each mdast text node.
    const runs = ['Hello {{na', 'me}} and {{ok}}'];
    let runStart = 0;
    const tokens: PlaceholderToken[] = [];
    for (const run of runs) {
      for (const token of parsePlaceholderTokens(run)) {
        tokens.push({
          ...token,
          startOffset: token.startOffset + runStart,
          endOffset: token.endOffset + runStart,
        });
      }
      runStart += run.length;
    }
    const joined = runs.join('');

    expect(spans(parsePlaceholderTokens(joined))[0]).toEqual(placeholderAt(joined, '{{name}}'));
    expect(spans(tokens)).toEqual([['malformed', '{{na', 6, 10], placeholderAt(joined, '{{ok}}')]);
    const boundary = runs[0]!.length;
    expect(tokens.some((token) => token.startOffset < boundary && token.endOffset > boundary)).toBe(
      false,
    );
  });
});

describe('template front-matter prefix', () => {
  it.each([
    ['LF', '---\ntitle: x\n---\nbody', '---\ntitle: x\n---\n'.length],
    ['CRLF', '---\r\ntitle: x\r\n---\r\nbody', '---\r\ntitle: x\r\n---\r\n'.length],
    ['CR', '---\rtitle: x\r---\rbody', '---\rtitle: x\r---\r'.length],
    ['EOF close', '---\ntitle: x\n---', '---\ntitle: x\n---'.length],
    ['trailing spaces and tabs', '--- \t\na: 1\n---\t \nbody', '--- \t\na: 1\n---\t \n'.length],
    ['malformed YAML', '---\n: : [unclosed\n---\nbody', '---\n: : [unclosed\n---\n'.length],
    ['empty', '---\n---\nbody', 8],
  ])('excludes the exact closed prefix with %s', (_label, source, expected) => {
    expect(templateFrontMatterPrefixLength(source)).toBe(expected);
  });

  it.each([
    ['unmatched opener', '---\ntitle: x\nbody'],
    ['opener without a line ending', '---'],
    ['byte order mark', '\ufeff---\na: 1\n---\nbody'],
    ['leading whitespace', ' ---\na: 1\n---\nbody'],
    ['four hyphens', '----\na: 1\n---\nbody'],
    ['text before the opener', 'x\n---\na: 1\n---\n'],
  ])('excludes no prefix for %s', (_label, source) => {
    expect(templateFrontMatterPrefixLength(source)).toBe(0);
  });

  it('excludes tokens inside closed front matter and keeps original body offsets', () => {
    const source = '---\r\ntitle: {{inside}}\r\n---\r\n# {{a}}\r\n\r\n{{b}}';

    expect(spans(parseMarkdownPlaceholderTokens(source))).toEqual([
      placeholderAt(source, '{{a}}'),
      placeholderAt(source, '{{b}}'),
    ]);
  });

  it('parses an unmatched opener as ordinary Markdown', () => {
    const source = '---\ntitle {{a}}\n\n{{b}}';

    expect(spans(parseMarkdownPlaceholderTokens(source))).toEqual([
      placeholderAt(source, '{{a}}'),
      placeholderAt(source, '{{b}}'),
    ]);
  });

  it('keeps original offsets after a byte order mark', () => {
    const plain = '\ufeff{{a}} x {{b}}';
    const withFrontMatter = '\ufeff---\ntitle: {{c}}\n---\n{{d}}';
    const afterFrontMatter = '---\n---\n\ufeff{{e}}';

    expect(spans(parseMarkdownPlaceholderTokens(plain))).toEqual([
      ['placeholder', '{{a}}', 1, 6],
      placeholderAt(plain, '{{b}}'),
    ]);
    expect(spans(parseMarkdownPlaceholderTokens(withFrontMatter))).toEqual([
      placeholderAt(withFrontMatter, '{{c}}'),
      placeholderAt(withFrontMatter, '{{d}}'),
    ]);
    expect(spans(parseMarkdownPlaceholderTokens(afterFrontMatter))).toEqual([
      placeholderAt(afterFrontMatter, '{{e}}'),
    ]);
  });
});

describe('unescapePlaceholderBody', () => {
  it('resolves escaped ASCII punctuation left to right and keeps every other backslash', () => {
    expect(unescapePlaceholderBody('user\\_name')).toBe('user_name');
    expect(unescapePlaceholderBody('a\\.b\\_')).toBe('a.b_');
    expect(unescapePlaceholderBody('a\\\\_b')).toBe('a\\_b');
    expect(unescapePlaceholderBody('a\\b')).toBe('a\\b');
    expect(unescapePlaceholderBody('trailing\\')).toBe('trailing\\');
    expect(unescapePlaceholderBody('plain')).toBe('plain');
  });
});
