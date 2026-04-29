/**
 * Front matter diff computation tests.
 *
 * DEP-61: Front matter (YAML) parsing and editing support
 */

import { describe, expect, test } from 'bun:test';
import {
  computeDiffWithFrontMatter,
  FRONTMATTER_BLOCK_INDEX,
  FRONTMATTER_BLOCK_TYPE,
  getBodyChanges,
  getFrontMatterChanges,
  isFrontMatterChange,
} from './frontmatter';

describe('computeDiffWithFrontMatter', () => {
  test('detects front matter changes', () => {
    const original = '---\ntitle: Old Title\n---\n\n# Content';
    const current = '---\ntitle: New Title\n---\n\n# Content';

    const result = computeDiffWithFrontMatter(original, current);

    expect(result.hasFrontMatterChanges).toBe(true);
    expect(result.frontMatterGroup).not.toBeNull();
    expect(result.frontMatterGroup?.blockType).toBe(FRONTMATTER_BLOCK_TYPE);
    expect(result.frontMatterGroup?.blockIndex).toBe(FRONTMATTER_BLOCK_INDEX);
    expect(result.bodyGroups).toHaveLength(0); // Body unchanged
  });

  test('detects body changes without front matter changes', () => {
    const original = '---\ntitle: Same\n---\n\n# Old Content';
    const current = '---\ntitle: Same\n---\n\n# New Content';

    const result = computeDiffWithFrontMatter(original, current);

    expect(result.hasFrontMatterChanges).toBe(false);
    expect(result.frontMatterGroup).toBeNull();
    expect(result.bodyGroups.length).toBeGreaterThan(0);
  });

  test('detects both front matter and body changes', () => {
    const original = '---\ntitle: Old\n---\n\n# Old Content';
    const current = '---\ntitle: New\n---\n\n# New Content';

    const result = computeDiffWithFrontMatter(original, current);

    expect(result.hasFrontMatterChanges).toBe(true);
    expect(result.frontMatterGroup).not.toBeNull();
    expect(result.bodyGroups.length).toBeGreaterThan(0);
    expect(result.groups.length).toBeGreaterThan(1);
  });

  test('handles document without front matter', () => {
    const original = '# Old Content';
    const current = '# New Content';

    const result = computeDiffWithFrontMatter(original, current);

    expect(result.hasFrontMatterChanges).toBe(false);
    expect(result.frontMatterGroup).toBeNull();
    expect(result.bodyGroups.length).toBeGreaterThan(0);
  });

  test('handles adding front matter', () => {
    const original = '# Content';
    const current = '---\ntitle: Added\n---\n\n# Content';

    const result = computeDiffWithFrontMatter(original, current);

    expect(result.hasFrontMatterChanges).toBe(true);
    expect(result.frontMatterGroup).not.toBeNull();
  });

  test('handles removing front matter', () => {
    const original = '---\ntitle: Removed\n---\n\n# Content';
    const current = '# Content';

    const result = computeDiffWithFrontMatter(original, current);

    expect(result.hasFrontMatterChanges).toBe(true);
    expect(result.frontMatterGroup).not.toBeNull();
  });

  test('front matter group appears first in groups array when present', () => {
    const original = '---\ntitle: Old\n---\n\n# Old Content';
    const current = '---\ntitle: New\n---\n\n# New Content';

    const result = computeDiffWithFrontMatter(original, current);

    // When there are front matter changes, check properties
    expect(result.hasFrontMatterChanges).toBe(true);

    // If frontMatterGroup is populated, verify its structure
    if (result.frontMatterGroup) {
      expect(result.frontMatterGroup.blockType).toBe(FRONTMATTER_BLOCK_TYPE);
      expect(result.frontMatterGroup.blockIndex).toBe(FRONTMATTER_BLOCK_INDEX);
      // The first group in the array should be the front matter group
      expect(result.groups[0]).toBe(result.frontMatterGroup);
    }
  });

  test('computes correct stats for both sections', () => {
    const original = '---\ntitle: Old\nauthor: Same\n---\n\n# Content old';
    const current = '---\ntitle: New\nauthor: Same\n---\n\n# Content new';

    const result = computeDiffWithFrontMatter(original, current);

    // Should have stats from both front matter and body changes
    expect(result.stats.replacements).toBeGreaterThan(0);
  });

  test('handles identical documents', () => {
    const doc = '---\ntitle: Same\n---\n\n# Same Content';

    const result = computeDiffWithFrontMatter(doc, doc);

    // When comparing identical documents, there should be no changes
    expect(result.hasFrontMatterChanges).toBe(false);
    expect(result.bodyGroups).toHaveLength(0);
    expect(result.changes).toHaveLength(0);
  });

  test('front matter changes have prefixed IDs', () => {
    const original = '---\ntitle: Old\n---\n\nContent';
    const current = '---\ntitle: New\n---\n\nContent';

    const result = computeDiffWithFrontMatter(original, current);

    const frontMatterChanges = result.changes.filter((c) => c.blockType === FRONTMATTER_BLOCK_TYPE);

    // All front matter change IDs should start with 'fm-'
    expect(frontMatterChanges.every((c) => c.id.startsWith('fm-'))).toBe(true);
  });
});

describe('isFrontMatterChange', () => {
  test('returns true for front matter changes', () => {
    const change = {
      id: 'fm-1',
      type: 'replacement' as const,
      originalText: 'Old',
      currentText: 'New',
      originalRange: { start: 0, end: 3 },
      currentRange: { start: 0, end: 3 },
      sourcePosition: null,
      blockIndex: FRONTMATTER_BLOCK_INDEX,
      blockType: FRONTMATTER_BLOCK_TYPE,
    };

    expect(isFrontMatterChange(change)).toBe(true);
  });

  test('returns false for body changes', () => {
    const change = {
      id: '1',
      type: 'replacement' as const,
      originalText: 'Old',
      currentText: 'New',
      originalRange: { start: 0, end: 3 },
      currentRange: { start: 0, end: 3 },
      sourcePosition: null,
      blockIndex: 0,
      blockType: 'paragraph',
    };

    expect(isFrontMatterChange(change)).toBe(false);
  });
});

describe('getFrontMatterChanges', () => {
  test('filters only front matter changes', () => {
    const original = '---\ntitle: Old\n---\n\n# Old Content';
    const current = '---\ntitle: New\n---\n\n# New Content';

    const result = computeDiffWithFrontMatter(original, current);
    const frontMatterChanges = getFrontMatterChanges(result.changes);

    expect(frontMatterChanges.every((c) => c.blockType === FRONTMATTER_BLOCK_TYPE)).toBe(true);
  });
});

describe('getBodyChanges', () => {
  test('filters only body changes', () => {
    const original = '---\ntitle: Old\n---\n\n# Old Content';
    const current = '---\ntitle: New\n---\n\n# New Content';

    const result = computeDiffWithFrontMatter(original, current);
    const bodyChanges = getBodyChanges(result.changes);

    expect(bodyChanges.every((c) => c.blockType !== FRONTMATTER_BLOCK_TYPE)).toBe(true);
  });
});
