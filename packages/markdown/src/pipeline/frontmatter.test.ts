/**
 * Front matter parsing and serialization tests.
 *
 * DEP-61: Front matter (YAML) parsing and editing support
 */

import { describe, expect, test } from 'bun:test';
import {
  contentEqualsWithFrontMatter,
  extractFrontMatter,
  hasFrontMatter,
  mergeFrontMatter,
  normalizeWithFrontMatter,
  parseFrontMatter,
  roundTripWithFrontMatter,
  stringifyFrontMatter,
  validateFrontMatter,
} from './index';

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
      .map((line) => line.split(':')[0].trim());

    expect(keyOrder).toEqual(['apple', 'mango', 'zebra']);
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

describe('extractFrontMatter', () => {
  test('returns tuple of data, raw, and body', () => {
    const markdown = `---
title: Test
---

Body`;

    const [data, raw, body] = extractFrontMatter(markdown);

    expect(data).toEqual({ title: 'Test' });
    expect(raw).toBe('title: Test');
    expect(body).toBe('\nBody');
  });
});

describe('hasFrontMatter', () => {
  test('returns true when front matter exists', () => {
    expect(hasFrontMatter('---\ntitle: Test\n---\nBody')).toBe(true);
  });

  test('returns false when no front matter', () => {
    expect(hasFrontMatter('# Just content')).toBe(false);
  });

  test('returns false when whitespace before delimiter (consistent with parseFrontMatter)', () => {
    // Leading whitespace means no front matter - this must be consistent with parseFrontMatter()
    // which also requires front matter to start at position 0
    expect(hasFrontMatter('  ---\ntitle: Test\n---')).toBe(false);
  });

  test('stays consistent with parseFrontMatter for a false-positive span (cinder#1325)', () => {
    // Before delegating to parseFrontMatter, this was a bare
    // `markdown.startsWith('---')`, so it said `true` here even after
    // parseFrontMatter() itself was fixed to say `false` -- directly
    // contradicting this function's own "mirrors parseFrontMatter" contract
    // for exactly the input the cinder#1325 fix targets.
    const markdown = '---\n- one\n- two\n---\n\nBody.';

    expect(hasFrontMatter(markdown)).toBe(parseFrontMatter(markdown).hasFrontMatter);
    expect(hasFrontMatter(markdown)).toBe(false);
  });
});

describe('validateFrontMatter', () => {
  test('validates correct YAML', () => {
    const result = validateFrontMatter('title: Hello\ndate: 2025-01-04');

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('validates empty string', () => {
    const result = validateFrontMatter('');

    expect(result.valid).toBe(true);
  });

  test('detects invalid YAML', () => {
    const result = validateFrontMatter('title: [\ninvalid');

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('mergeFrontMatter', () => {
  test('merges new values', () => {
    const existing = { title: 'Old', author: 'Jane' };
    const updates = { title: 'New', draft: true };

    const result = mergeFrontMatter(existing, updates);

    expect(result).toEqual({
      title: 'New',
      author: 'Jane',
      draft: true,
    });
  });

  test('removes keys with undefined values', () => {
    const existing = { title: 'Keep', remove: 'This' };
    const updates = { remove: undefined };

    const result = mergeFrontMatter(existing, updates);

    expect(result).toEqual({ title: 'Keep' });
    expect('remove' in result).toBe(false);
  });

  test('handles null existing data', () => {
    const result = mergeFrontMatter(null, { title: 'New' });

    expect(result).toEqual({ title: 'New' });
  });
});

describe('normalizeWithFrontMatter', () => {
  test('normalizes document with front matter', () => {
    const markdown = `---
zebra: z
apple: a
---

#   Heading`;

    const result = normalizeWithFrontMatter(markdown);

    // Keys should be sorted alphabetically
    expect(result.indexOf('apple')).toBeLessThan(result.indexOf('zebra'));
    // Body should be normalized
    expect(result).toContain('# Heading');
  });

  test('normalizes document without front matter', () => {
    const markdown = '#   Heading\n\nContent';

    const result = normalizeWithFrontMatter(markdown);

    expect(result).not.toContain('---');
    expect(result).toContain('# Heading');
  });

  test('preserves a false-positive front-matter span as body instead of silently dropping it (cinder#1325)', () => {
    // Before cinder#1325, `hasFrontMatter` was true here with `data: null`,
    // so this function's `!hasFrontMatter || !data` branch returned only
    // `normalize(body)` -- and `body` is everything *after* the closing
    // fence, per `parseFrontMatter`. The `---\n- one\n- two\n---` span
    // itself was silently discarded from the output. Now that the span is
    // correctly classified as ordinary body content, it survives
    // normalization instead of vanishing.
    const markdown = '---\n- one\n- two\n---\n\nBody.';

    const result = normalizeWithFrontMatter(markdown);

    expect(result).toContain('one');
    expect(result).toContain('two');
    expect(result).toContain('Body.');
  });
});

describe('roundTripWithFrontMatter', () => {
  test('passes for valid document', () => {
    const markdown = `---
title: Test
draft: false
---

# Hello world

This is *emphasized* text.`;

    const result = roundTripWithFrontMatter(markdown);

    expect(result.passes).toBe(true);
    expect(result.originalFrontMatter).toEqual({
      title: 'Test',
      draft: false,
    });
  });

  test('passes for document without front matter', () => {
    const markdown = '# Just content\n\nNo front matter here.';

    const result = roundTripWithFrontMatter(markdown);

    expect(result.passes).toBe(true);
    expect(result.originalFrontMatter).toBeNull();
  });

  test('preserves front matter data through round-trip', () => {
    const markdown = `---
title: Complex
tags: [a, b, c]
nested:
  key: value
---

Body content`;

    const result = roundTripWithFrontMatter(markdown);

    expect(result.passes).toBe(true);
    expect(result.roundTrippedFrontMatter).toEqual(result.originalFrontMatter);
  });
});

describe('contentEqualsWithFrontMatter', () => {
  test('returns true for identical documents', () => {
    const doc = `---
title: Test
---

# Content`;

    expect(contentEqualsWithFrontMatter(doc, doc)).toBe(true);
  });

  test('returns true when key order differs', () => {
    const doc1 = `---
title: Test
author: Jane
---

# Content`;

    const doc2 = `---
author: Jane
title: Test
---

# Content`;

    expect(contentEqualsWithFrontMatter(doc1, doc2)).toBe(true);
  });

  test('returns false when data differs', () => {
    const doc1 = `---
title: One
---

# Content`;

    const doc2 = `---
title: Two
---

# Content`;

    expect(contentEqualsWithFrontMatter(doc1, doc2)).toBe(false);
  });

  test('returns false when body differs', () => {
    const doc1 = `---
title: Same
---

# Different`;

    const doc2 = `---
title: Same
---

# Content`;

    expect(contentEqualsWithFrontMatter(doc1, doc2)).toBe(false);
  });

  test('handles documents without front matter', () => {
    const doc1 = '# Content';
    const doc2 = '# Content\n';

    expect(contentEqualsWithFrontMatter(doc1, doc2)).toBe(true);
  });

  test('differentiates between front matter and no front matter', () => {
    const withFm = `---
title: Test
---

# Content`;

    const withoutFm = '# Content';

    expect(contentEqualsWithFrontMatter(withFm, withoutFm)).toBe(false);
  });

  test('a false-positive front-matter span now enters the comparison, instead of being invisible to it (cinder#1325)', () => {
    // Before cinder#1325, both documents parsed to `hasFrontMatter: true,
    // data: null` (neither `- one` nor `- two` is object-shaped YAML), and
    // `contentEqualsWithFrontMatter` compares `data` and `body` -- `body`
    // being only what follows the closing fence. Both bodies are identical
    // ("Body.\n"), and `data` was null on both sides regardless of what the
    // list actually said, so the function returned true without the list
    // content -- "one" vs "two" -- ever being compared.
    //
    // After the fix, the whole `---`-delimited span is ordinary body text
    // on both sides, so it's part of what `contentEquals` normalizes and
    // compares. Genuinely different list content now makes these documents
    // compare unequal, as they should.
    const withOne = '---\n\n- one\n\n---\n\nBody.\n';
    const withTwo = '---\n\n- two\n\n---\n\nBody.\n';

    expect(contentEqualsWithFrontMatter(withOne, withTwo)).toBe(false);
  });

  test('the cinder#1325 repro itself still compares equal, now for the right reason (real Markdown normalization, not an invisible span)', () => {
    // `* one` and `- one` are the same Markdown list with a different
    // marker character -- semantically equivalent, and now actually
    // compared as such, rather than both bodies just happening to be
    // identical strings after an ignored front-matter-shaped prefix.
    const withAsterisk = '---\n\n* one\n\n---\n\nBody.\n';
    const withDash = '---\n\n- one\n\n---\n\nBody.\n';

    expect(contentEqualsWithFrontMatter(withAsterisk, withDash)).toBe(true);
  });
});
