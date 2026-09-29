/**
 * Front matter parsing and serialization tests.
 *
 * DEP-61: Front matter (YAML) parsing and editing support
 */

import { describe, expect, test } from 'bun:test';
import { parseFrontMatter, serializeYaml, stringifyFrontMatter } from './index';

function assertPublicSerializeYamlOptions() {
  // @ts-expect-error keyOrder is recovered privately from original raw front matter.
  serializeYaml({ first: 'one' }, { keyOrder: ['first'] });
}

void assertPublicSerializeYamlOptions;

describe('parseFrontMatter', () => {
  test('parses valid YAML front matter', () => {
    const markdown = `---
title: Hello World
draft: true
tags: [test, demo]
---

# Content here`;

    const result = parseFrontMatter(markdown);

    expect(result.hasFrontMatter).toBe(true);
    expect(result.data).toEqual({
      title: 'Hello World',
      draft: true,
      tags: ['test', 'demo'],
    });
    expect(result.raw).toBe('title: Hello World\ndraft: true\ntags: [test, demo]');
    expect(result.body).toBe('\n# Content here');
  });

  test('handles document without front matter', () => {
    const markdown = '# Just a heading\n\nSome content.';

    const result = parseFrontMatter(markdown);

    expect(result.hasFrontMatter).toBe(false);
    expect(result.data).toBeNull();
    expect(result.raw).toBeNull();
    expect(result.body).toBe(markdown);
  });

  test('handles empty front matter', () => {
    const markdown = `---
---

# Content`;

    const result = parseFrontMatter(markdown);

    expect(result.hasFrontMatter).toBe(true);
    expect(result.data).toBeNull(); // Empty object becomes null
    expect(result.body).toBe('\n# Content');
  });

  test('handles empty input', () => {
    const result = parseFrontMatter('');

    expect(result.hasFrontMatter).toBe(false);
    expect(result.data).toBeNull();
    expect(result.raw).toBeNull();
    expect(result.body).toBe('');
  });

  test('handles boolean values', () => {
    const markdown = `---
draft: true
published: false
---

Content`;

    const result = parseFrontMatter(markdown);

    expect(result.data).toEqual({
      draft: true,
      published: false,
    });
  });

  test('handles nested objects', () => {
    const markdown = `---
author:
  name: Jane Doe
  email: jane@example.com
---

Content`;

    const result = parseFrontMatter(markdown);

    expect(result.data).toEqual({
      author: {
        name: 'Jane Doe',
        email: 'jane@example.com',
      },
    });
  });

  describe('rejects false-positive front matter (cinder#1325)', () => {
    test('treats a `---`-delimited YAML sequence as body, not front matter', () => {
      // `- one` is valid YAML, but it parses to an array, not an object --
      // front matter must be key/value data.
      const markdown = '---\n- one\n- two\n---\n\nBody.\n';

      const result = parseFrontMatter(markdown);

      expect(result.hasFrontMatter).toBe(false);
      expect(result.data).toBeNull();
      expect(result.raw).toBeNull();
      expect(result.body).toBe(markdown);
    });

    test('treats unparseable YAML between delimiters as body, not front matter', () => {
      // `* one` is not valid YAML (an alias reference with no matching
      // anchor) -- js-yaml throws parsing it.
      const markdown = '---\n* one\n---\n\nBody.\n';

      const result = parseFrontMatter(markdown);

      expect(result.hasFrontMatter).toBe(false);
      expect(result.data).toBeNull();
      expect(result.raw).toBeNull();
      expect(result.body).toBe(markdown);
    });

    test('two documents differing only by list-marker style inside a false-positive block parse identically', () => {
      // The exact cinder#1325 repro: both fail YAML parsing (`* one` throws,
      // `- one` parses but isn't object-shaped), so both are "not front
      // matter" and their entire text -- including the marker-style
      // difference -- lands in `body`, ready for Markdown-aware comparison
      // upstream instead of being frozen as an opaque "front matter" span.
      const withAsterisk = '---\n\n* one\n\n---\n\nBody.\n';
      const withDash = '---\n\n- one\n\n---\n\nBody.\n';

      const resultA = parseFrontMatter(withAsterisk);
      const resultB = parseFrontMatter(withDash);

      expect(resultA.hasFrontMatter).toBe(false);
      expect(resultB.hasFrontMatter).toBe(false);
      expect(resultA.body).toBe(withAsterisk);
      expect(resultB.body).toBe(withDash);
    });

    test('still recognizes an empty front-matter block (not a parse failure)', () => {
      // Blank content between delimiters is intentionally-empty front
      // matter, not invalid YAML -- must not be swept into the new
      // false-positive handling.
      const markdown = '---\n---\n\n# Content';

      const result = parseFrontMatter(markdown);

      expect(result.hasFrontMatter).toBe(true);
      expect(result.data).toBeNull();
    });

    test('still recognizes a comment-only front-matter block, the "empty block with a note" idiom, not a false positive (review finding)', () => {
      // `load()` returns `null` for `'# note'` -- the exact same value it
      // returns for a genuinely blank block -- so a comment-only span fell
      // into the "not front matter" branch above it, alongside real
      // sequences/scalars, before this fix. Unlike a Markdown list or a
      // bare scalar, `# note` immediately after the opening `---` was never
      // plausibly ordinary Markdown body content: it's the standard way to
      // leave a note in an otherwise-empty front-matter block.
      const markdown = '---\n# TODO: fill this in\n---\n\n# Content';

      const result = parseFrontMatter(markdown);

      expect(result.hasFrontMatter).toBe(true);
      expect(result.data).toBeNull();
      expect(result.body).toBe('\n# Content');
    });

    test('a comment mixed with blank lines is still comment-only, not real content', () => {
      const markdown = '---\n\n  # note\n\n---\n\nBody.\n';

      const result = parseFrontMatter(markdown);

      expect(result.hasFrontMatter).toBe(true);
      expect(result.data).toBeNull();
    });

    test('a real key past an inline comment is not treated as comment-only (only a full-line `#` counts)', () => {
      // `title: Hello # a note` has real content before its `#` -- the line
      // doesn't *start* with `#`, so isCommentOnlyYaml correctly leaves it
      // alone (YAML itself strips the trailing `# a note` as an inline
      // comment, same as it would for hand-written front matter), and the
      // block parses as ordinary front matter with real data, not as an
      // "empty, comment-only" block.
      const markdown = '---\ntitle: Hello # a note\n---\n\nBody.\n';

      const result = parseFrontMatter(markdown);

      expect(result.hasFrontMatter).toBe(true);
      expect(result.data).toEqual({ title: 'Hello' });
    });

    test('still recognizes valid object-shaped front matter', () => {
      const markdown = '---\ntitle: Real front matter\n---\n\nBody.\n';

      const result = parseFrontMatter(markdown);

      expect(result.hasFrontMatter).toBe(true);
      expect(result.data).toEqual({ title: 'Real front matter' });
    });
  });
});

describe('stringifyFrontMatter', () => {
  test('serializes data with body', () => {
    const data = { title: 'Hello', draft: true };
    const body = '# Content';

    const result = stringifyFrontMatter(data, body);

    expect(result).toContain('---');
    expect(result).toContain('draft: true');
    expect(result).toContain('title: Hello');
    expect(result).toContain('# Content');
  });

  test('returns body only when data is null', () => {
    const body = '# Content';

    const result = stringifyFrontMatter(null, body);

    expect(result).toBe('# Content');
  });

  test('returns body only when data is empty', () => {
    const body = '# Content';

    const result = stringifyFrontMatter({}, body);

    expect(result).toBe('# Content');
  });

  test('preserves empty front matter when preserveEmptyFrontMatter is true', () => {
    const body = '# Content';

    const result = stringifyFrontMatter(null, body, { preserveEmptyFrontMatter: true });

    expect(result).toBe('---\n---\n# Content');
  });

  test('preserves empty front matter with empty object data', () => {
    const body = '# Content';

    const result = stringifyFrontMatter({}, body, { preserveEmptyFrontMatter: true });

    expect(result).toBe('---\n---\n# Content');
  });

  test('sorts keys alphabetically', () => {
    const data = { zebra: 'last', apple: 'first', mango: 'middle' };
    const body = 'Content';

    const result = stringifyFrontMatter(data, body, { preserveRaw: false });

    const lines = result.split('\n');
    const keyOrder = lines
      .filter((line) => line.includes(':') && !line.startsWith('---'))
      .map((line) => line.split(':')[0]!.trim());

    expect(keyOrder).toEqual(['apple', 'mango', 'zebra']);
  });

  test('keeps sorted key output as the default when raw YAML cannot be preserved', () => {
    const data = { zebra: 'last', apple: 'first', mango: 'middle' };
    const body = 'Content';

    expect(stringifyFrontMatter(data, body)).toBe(
      '---\napple: first\nmango: middle\nzebra: last\n---\nContent',
    );
  });

  test('can serialize mappings in insertion order while quoting key names that need it', () => {
    const data = {
      first: 'one',
      'tag: group #1': ['alpha', 'beta'],
      'quoted "key"': 'value',
      second: 'two',
      obj: {
        'nested: key #2': true,
        apple: 'first',
      },
    };
    const body = '\n# Content';

    const result = stringifyFrontMatter(data, body, {
      preserveRaw: false,
      sortKeys: false,
    });

    expect(result).toBe(
      '---\nfirst: one\n"tag: group #1": [alpha, beta]\n"quoted \\"key\\"": value\nsecond: two\nobj:\n  apple: first\n  "nested: key #2": true\n---\n\n# Content',
    );
    expect(parseFrontMatter(result).data).toEqual(data);
  });

  test('uses block-style original raw order for quoted numeric-looking keys when preserving top-level insertion order', () => {
    const originalRaw =
      'first: one\n' +
      '"2": two\n' +
      '"tag: group #1": [alpha, beta]\n' +
      '"quoted \\"key\\"": value\n' +
      'nested:\n' +
      '  "1": one\n' +
      '  z: zee\n' +
      'second: { "3": three, a: aye }\n';
    const original = parseFrontMatter(`---\n${originalRaw}---\n\n# Content`);
    if (!original.data) throw new Error('Expected original front matter data.');

    const result = stringifyFrontMatter(
      {
        ...original.data,
        second: { '3': 'three', a: 'updated' },
      },
      '\n# Content',
      {
        originalRaw,
        originalData: original.data,
        sortKeys: false,
      },
    );

    expect(result).toBe(
      '---\nfirst: one\n"2": two\n"tag: group #1": [alpha, beta]\n"quoted \\"key\\"": value\nnested:\n  "1": one\n  z: zee\nsecond:\n  "3": three\n  a: updated\n---\n\n# Content',
    );
    expect(parseFrontMatter(result).data).toEqual({
      first: 'one',
      '2': 'two',
      'tag: group #1': ['alpha', 'beta'],
      'quoted "key"': 'value',
      nested: { '1': 'one', z: 'zee' },
      second: { '3': 'three', a: 'updated' },
    });
  });

  test('uses flow-style original raw order for quoted numeric-looking keys when preserving top-level insertion order', () => {
    const originalRaw =
      '{ first: one, "2": two, "tag: group #1": [alpha, beta], nested: { "1": one, z: zee }, second: { "3": three, a: aye } }';
    const original = parseFrontMatter(`---\n${originalRaw}\n---\n\n# Content`);
    if (!original.data) throw new Error('Expected original front matter data.');

    const result = stringifyFrontMatter(
      {
        ...original.data,
        second: { '3': 'three', a: 'updated' },
      },
      '\n# Content',
      {
        originalRaw,
        originalData: original.data,
        sortKeys: false,
      },
    );

    expect(result).toBe(
      '---\nfirst: one\n"2": two\n"tag: group #1": [alpha, beta]\nnested:\n  "1": one\n  z: zee\nsecond:\n  "3": three\n  a: updated\n---\n\n# Content',
    );
    expect(parseFrontMatter(result).data).toEqual({
      first: 'one',
      '2': 'two',
      'tag: group #1': ['alpha', 'beta'],
      nested: { '1': 'one', z: 'zee' },
      second: { '3': 'three', a: 'updated' },
    });
  });

  test('preserves original raw when data unchanged', () => {
    const originalRaw = 'zebra: last\napple: first';
    const data = { zebra: 'last', apple: 'first' };
    const body = 'Content';

    const result = stringifyFrontMatter(data, body, {
      preserveRaw: true,
      originalRaw,
      originalData: data,
    });

    expect(result).toContain(originalRaw);
  });

  test('preserves unchanged raw comments and quoted keys before considering insertion order', () => {
    const originalRaw = '# keep me\n"tag: group #1": [alpha]\nsecond: two';
    const data = { 'tag: group #1': ['alpha'], second: 'two' };
    const body = '\n# Content';

    const result = stringifyFrontMatter(data, body, {
      preserveRaw: true,
      originalRaw,
      originalData: data,
      sortKeys: false,
    });

    expect(result).toBe(`---\n${originalRaw}\n---\n\n# Content`);
  });

  test('handles arrays', () => {
    const data = { tags: ['one', 'two', 'three'] };
    const body = 'Content';

    const result = stringifyFrontMatter(data, body);

    expect(result).toContain('tags: [one, two, three]');
  });

  test('handles arrays with objects', () => {
    const data = { authors: [{ name: 'John' }, { name: 'Jane' }] };
    const body = 'Content';

    const result = stringifyFrontMatter(data, body);

    // Objects in arrays should be serialized in YAML flow style, not as [object Object]
    expect(result).not.toContain('[object Object]');
    expect(result).toContain('authors:');
    expect(result).toContain('{name: John}');
    expect(result).toContain('{name: Jane}');
  });

  test('handles deeply nested objects in arrays', () => {
    const data = {
      items: [
        { id: 1, meta: { category: 'A', active: true } },
        { id: 2, meta: { category: 'B', active: false } },
      ],
    };
    const body = 'Content';

    const result = stringifyFrontMatter(data, body);

    // Should not produce [object Object] anywhere
    expect(result).not.toContain('[object Object]');
    expect(result).toContain('items:');
  });

  test('quotes strings with special characters', () => {
    const data = { description: 'A string with: colons' };
    const body = 'Content';

    const result = stringifyFrontMatter(data, body);

    expect(result).toContain('"A string with: colons"');
  });

  test('preserves blank line between front matter and body', () => {
    const data = { title: 'Test' };
    // Body with leading blank line (common in markdown documents)
    const body = '\n# Content';

    const result = stringifyFrontMatter(data, body);

    // Should have: closing delimiter + newline + blank line + content
    // The pattern "---\n\n#" indicates proper blank line preservation
    expect(result).toContain('---\n\n# Content');
  });

  test('handles body without leading newline', () => {
    const data = { title: 'Test' };
    const body = '# Content';

    const result = stringifyFrontMatter(data, body);

    // Should have: closing delimiter + newline + content (no blank line)
    expect(result).toContain('---\n# Content');
  });
});
