import { describe, expect, it, spyOn } from 'bun:test';
import { computeDiff, groupChangesByBlock } from './compute.js';

describe('computeDiff', () => {
  describe('identical texts', () => {
    it('returns empty changes for identical strings', () => {
      const result = computeDiff('Hello world', 'Hello world');

      expect(result.changes).toHaveLength(0);
      expect(result.stats.insertions).toBe(0);
      expect(result.stats.deletions).toBe(0);
      expect(result.stats.replacements).toBe(0);
    });

    it('returns empty changes for empty strings', () => {
      const result = computeDiff('', '');

      expect(result.changes).toHaveLength(0);
    });
  });

  describe('insertions', () => {
    it('detects word insertions', () => {
      const result = computeDiff('Hello world', 'Hello beautiful world');

      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].type).toBe('insertion');
      expect(result.changes[0].currentText).toBe('beautiful ');
      expect(result.stats.insertions).toBe(1);
      expect(result.stats.wordsAdded).toBe(1);
    });

    it('detects insertions at the beginning', () => {
      const result = computeDiff('world', 'Hello world');

      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].type).toBe('insertion');
      expect(result.changes[0].currentText).toBe('Hello ');
    });

    it('detects insertions at the end', () => {
      const result = computeDiff('Hello', 'Hello world');

      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].type).toBe('insertion');
      expect(result.changes[0].currentText).toBe(' world');
    });
  });

  describe('deletions', () => {
    it('detects word deletions', () => {
      const result = computeDiff('Hello beautiful world', 'Hello world');

      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].type).toBe('deletion');
      expect(result.changes[0].originalText).toBe('beautiful ');
      expect(result.stats.deletions).toBe(1);
      expect(result.stats.wordsRemoved).toBe(1);
    });

    it('detects deletions at the beginning', () => {
      const result = computeDiff('Hello world', 'world');

      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].type).toBe('deletion');
      expect(result.changes[0].originalText).toBe('Hello ');
    });

    it('detects deletions at the end', () => {
      const result = computeDiff('Hello world', 'Hello');

      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].type).toBe('deletion');
      expect(result.changes[0].originalText).toBe(' world');
    });
  });

  describe('replacements', () => {
    it('merges adjacent delete+insert into replacement', () => {
      const result = computeDiff('Hello world', 'Hello universe');

      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].type).toBe('replacement');
      expect(result.changes[0].originalText).toBe('world');
      expect(result.changes[0].currentText).toBe('universe');
      expect(result.stats.replacements).toBe(1);
    });

    it('detects multiple replacements', () => {
      const result = computeDiff('The quick fox jumps', 'A slow dog runs');

      // Should detect replacements for changed words
      expect(result.changes.length).toBeGreaterThan(0);
      expect(result.stats.replacements).toBeGreaterThan(0);
    });
  });

  describe('multiple changes', () => {
    it('detects multiple changes in sequence', () => {
      const result = computeDiff('one two three four five', 'one TWO three FOUR five');

      expect(result.changes).toHaveLength(2);
      expect(result.changes.every((c) => c.type === 'replacement')).toBe(true);
    });

    it('handles complex edits', () => {
      const original = 'The quick brown fox jumps over the lazy dog.';
      const current = 'A fast brown cat leaps over the sleepy dog!';
      const result = computeDiff(original, current);

      // Should have multiple changes
      expect(result.changes.length).toBeGreaterThan(0);

      // Should have metadata
      expect(result.meta.originalSize).toBe(original.length);
      expect(result.meta.currentSize).toBe(current.length);
      expect(result.meta.computeTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('change IDs', () => {
    it('generates unique IDs for each change', () => {
      const result = computeDiff('one two three', 'ONE TWO THREE');

      const ids = result.changes.map((c) => c.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it('generates IDs with expected format', () => {
      const result = computeDiff('Hello', 'World');

      expect(result.changes[0].id).toMatch(/^change-\d+$/);
    });
  });

  describe('text ranges', () => {
    it('provides correct ranges for insertions', () => {
      const result = computeDiff('Hello world', 'Hello beautiful world');

      const insertion = result.changes[0];
      expect(insertion.originalRange).toBeNull();
      expect(insertion.currentRange).not.toBeNull();
      expect(insertion.currentRange?.start).toBeGreaterThanOrEqual(0);
    });

    it('provides correct ranges for deletions', () => {
      const result = computeDiff('Hello beautiful world', 'Hello world');

      const deletion = result.changes[0];
      expect(deletion.originalRange).not.toBeNull();
      expect(deletion.currentRange).toBeNull();
      expect(deletion.originalRange?.start).toBeGreaterThanOrEqual(0);
    });

    it('provides correct ranges for replacements', () => {
      const result = computeDiff('Hello world', 'Hello universe');

      const replacement = result.changes[0];
      expect(replacement.originalRange).not.toBeNull();
      expect(replacement.currentRange).not.toBeNull();
    });
  });

  describe('whitespace handling', () => {
    it('preserves whitespace in changes', () => {
      const result = computeDiff('Hello  world', 'Hello   world');

      // Should detect the whitespace difference
      expect(result.changes.length).toBeGreaterThan(0);
    });

    it('handles newlines as separate tokens', () => {
      const result = computeDiff('Line 1\nLine 2', 'Line 1\nNew line\nLine 2');

      expect(result.changes.length).toBeGreaterThan(0);
      expect(result.changes[0].type).toBe('insertion');
    });
  });

  describe('token overflow handling', () => {
    it('falls back to character diff after token overflow without corrupting text', () => {
      const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});

      try {
        const uniqueTokensBeforeOverflow = Array.from(
          { length: 65_533 },
          (_, index) => `token-${index}`,
        ).join(' ');

        const current = `${uniqueTokensBeforeOverflow} overflow-one overflow-two overflow-one overflow-three`;
        const result = computeDiff('', current);

        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(result.changes[0]).toMatchObject({
          type: 'insertion',
          originalText: '',
          currentText: current,
        });
      } finally {
        warnSpy.mockRestore();
      }
    });
  });

  describe('performance metadata', () => {
    it('includes computation time', () => {
      const result = computeDiff('Hello', 'World');

      expect(result.meta.computeTimeMs).toBeDefined();
      expect(typeof result.meta.computeTimeMs).toBe('number');
    });

    it('includes document sizes', () => {
      const original = 'Hello world';
      const current = 'Hello universe';
      const result = computeDiff(original, current);

      expect(result.meta.originalSize).toBe(original.length);
      expect(result.meta.currentSize).toBe(current.length);
    });

    it('indicates worker usage', () => {
      const result = computeDiff('Hello', 'World');

      expect(result.meta.usedWorker).toBe(false);
    });
  });
});

describe('groupChangesByBlock', () => {
  it('groups changes by block index', () => {
    const changes = [
      { id: 'c1', blockIndex: 0, blockType: 'paragraph' },
      { id: 'c2', blockIndex: 0, blockType: 'paragraph' },
      { id: 'c3', blockIndex: 1, blockType: 'heading' },
    ] as any;

    const groups = groupChangesByBlock(changes);

    expect(groups).toHaveLength(2);
    expect(groups[0].blockIndex).toBe(0);
    expect(groups[0].changes).toHaveLength(2);
    expect(groups[1].blockIndex).toBe(1);
    expect(groups[1].changes).toHaveLength(1);
  });

  it('sorts groups by block index', () => {
    const changes = [
      { id: 'c1', blockIndex: 2, blockType: 'list' },
      { id: 'c2', blockIndex: 0, blockType: 'paragraph' },
      { id: 'c3', blockIndex: 1, blockType: 'heading' },
    ] as any;

    const groups = groupChangesByBlock(changes);

    expect(groups[0].blockIndex).toBe(0);
    expect(groups[1].blockIndex).toBe(1);
    expect(groups[2].blockIndex).toBe(2);
  });

  it('returns empty array for no changes', () => {
    const groups = groupChangesByBlock([]);

    expect(groups).toHaveLength(0);
  });
});
