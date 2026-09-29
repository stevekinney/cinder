/**
 * Front matter parsing and serialization tests.
 *
 * DEP-61: Front matter (YAML) parsing and editing support
 */

import { describe, expect, test } from 'bun:test';
import {
  contentEqualsWithFrontMatter,
  normalizeWithFrontMatter,
  roundTripWithFrontMatter,
} from './index';

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

  test('preserves a comment-only front-matter span verbatim instead of dropping it (cinder#1330 round-6 finding)', () => {
    // `isCommentOnlyYaml` classifies `# Title\n## Subtitle` (between the
    // fences) as an intentionally-empty front-matter block with a comment,
    // so `hasFrontMatter: true, data: null` -- the exact same shape a truly
    // blank block reports. Before this fix, this function's `!data` branch
    // returned only `normalize(body)`, discarding the raw span entirely: the
    // two headings would vanish from the output with no error.
    const markdown = '---\n# Title\n## Subtitle\n---\nBody content\n';

    const result = normalizeWithFrontMatter(markdown);

    expect(result).toContain('# Title');
    expect(result).toContain('## Subtitle');
    expect(result).toContain('Body content');
  });

  test('a genuinely blank front-matter block still normalizes to just the body (no raw text to lose)', () => {
    const markdown = '---\n---\n\nBody content\n';

    const result = normalizeWithFrontMatter(markdown);

    expect(result).toBe('Body content\n');
  });

  test('normalizing a comment-only span is idempotent', () => {
    const markdown = '---\n# Title\n## Subtitle\n---\nBody content\n';

    const once = normalizeWithFrontMatter(markdown);
    const twice = normalizeWithFrontMatter(once);

    expect(twice).toBe(once);
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

  test('a comment-only front-matter span is compared, not made invisible by data equality (cinder#1330 round-6 finding)', () => {
    // Both documents parse to `hasFrontMatter: true, data: null` -- the
    // comment text itself carries the only difference, and `data` equality
    // alone can't see it. Before this fix these compared equal (a false
    // "unchanged"); the differing raw text must make them unequal.
    const docA = '---\n# Title A\n---\nBody.\n';
    const docB = '---\n# Title B\n---\nBody.\n';

    expect(contentEqualsWithFrontMatter(docA, docB)).toBe(false);
  });

  test('identical comment-only front-matter spans still compare equal', () => {
    const docA = '---\n# Same title\n---\nBody.\n';
    const docB = '---\n# Same title\n---\nBody.\n';

    expect(contentEqualsWithFrontMatter(docA, docB)).toBe(true);
  });

  test('an empty-object span and a genuinely blank span both have data: null but are not the same raw text -- compares unequal, not silently equal (documented edge case)', () => {
    // `---\n{}\n---` parses to `data: null` (an object with zero keys is
    // normalized to `null`, same as blank) but `raw: '{}'`; `---\n---`
    // parses to `raw: null`. Comparing `raw` byte-for-byte means these two
    // differ, even though neither has visible "data" -- a spurious inequality
    // rather than a missed one, which is the safe direction to be wrong on
    // here. Documented so a later round doesn't rediscover this as a mystery.
    const emptyObject = '---\n{}\n---\n\nBody.\n';
    const trulyBlank = '---\n---\n\nBody.\n';

    expect(contentEqualsWithFrontMatter(emptyObject, trulyBlank)).toBe(false);
  });
});
