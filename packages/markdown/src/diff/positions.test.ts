import { describe, expect, it } from 'bun:test';
import { parseOrThrow } from '../pipeline/index.js';
import {
  buildPositionMap,
  enrichChangesWithPositions,
  enrichDiffWithPositions,
  offsetToPosition,
} from './positions.js';
import type { Change } from './types.js';

describe('buildPositionMap', () => {
  it('creates entries for each block in AST', () => {
    const markdown = '# Heading\n\nParagraph one.\n\nParagraph two.';
    const ast = parseOrThrow(markdown);
    const map = buildPositionMap(ast);

    expect(map.length).toBe(3); // heading + 2 paragraphs
  });

  it('includes correct block types', () => {
    const markdown = '# Heading\n\nSome text.\n\n- List item';
    const ast = parseOrThrow(markdown);
    const map = buildPositionMap(ast);

    const types = map.map((e) => e.blockType);
    expect(types).toContain('heading');
    expect(types).toContain('paragraph');
    expect(types).toContain('list');
  });

  it('sorts entries by offset', () => {
    const markdown = '# First\n\nSecond\n\nThird';
    const ast = parseOrThrow(markdown);
    const map = buildPositionMap(ast);

    for (let i = 1; i < map.length; i++) {
      expect(map[i].offset).toBeGreaterThan(map[i - 1].offset);
    }
  });

  it('returns empty array for empty document', () => {
    const ast = parseOrThrow('');
    const map = buildPositionMap(ast);

    expect(map).toHaveLength(0);
  });
});

describe('offsetToPosition', () => {
  it('finds correct block for offset', () => {
    const markdown = '# Heading\n\nParagraph text here.';
    const ast = parseOrThrow(markdown);
    const map = buildPositionMap(ast);

    // Offset in heading (0-9)
    const headingPos = offsetToPosition(5, map);
    expect(headingPos?.blockType).toBe('heading');
    expect(headingPos?.blockIndex).toBe(0);

    // Offset in paragraph (after "# Heading\n\n")
    const paragraphPos = offsetToPosition(15, map);
    expect(paragraphPos?.blockType).toBe('paragraph');
    expect(paragraphPos?.blockIndex).toBe(1);
  });

  it('returns null for empty position map', () => {
    const result = offsetToPosition(10, []);

    expect(result).toBeNull();
  });

  it('returns first block for offset 0', () => {
    const markdown = '# Heading\n\nParagraph';
    const ast = parseOrThrow(markdown);
    const map = buildPositionMap(ast);

    const result = offsetToPosition(0, map);

    expect(result?.blockIndex).toBe(0);
  });

  it('uses binary search for large maps', () => {
    // Create a document with many blocks
    const blocks = Array.from({ length: 100 }, (_, i) => `Paragraph ${i}.`);
    const markdown = blocks.join('\n\n');
    const ast = parseOrThrow(markdown);
    const map = buildPositionMap(ast);

    // Find a block in the middle
    const middleOffset = markdown.length / 2;
    const result = offsetToPosition(middleOffset, map);

    expect(result).not.toBeNull();
    expect(result?.blockIndex).toBeGreaterThan(0);
    expect(result?.blockIndex).toBeLessThan(99);
  });
});

describe('enrichChangesWithPositions', () => {
  it('enriches changes with source positions', () => {
    const original = '# Hello\n\nWorld';
    const current = '# Hello\n\nUniverse';
    const originalAst = parseOrThrow(original);
    const currentAst = parseOrThrow(current);

    const changes: Change[] = [
      {
        id: 'change-0',
        type: 'replacement',
        originalText: 'World',
        currentText: 'Universe',
        originalRange: { start: 10, end: 15 },
        currentRange: { start: 10, end: 18 },
        sourcePosition: null,
        blockIndex: 0,
        blockType: 'unknown',
      },
    ];

    const enriched = enrichChangesWithPositions(changes, originalAst, currentAst);

    expect(enriched[0].sourcePosition).not.toBeNull();
    expect(enriched[0].blockType).toBe('paragraph');
    expect(enriched[0].blockIndex).toBe(1); // Second block (paragraph after heading)
  });

  it('handles insertions (no original range)', () => {
    const original = '# Hello';
    const current = '# Hello\n\nNew text';
    const originalAst = parseOrThrow(original);
    const currentAst = parseOrThrow(current);

    const changes: Change[] = [
      {
        id: 'change-0',
        type: 'insertion',
        originalText: '',
        currentText: '\n\nNew text',
        originalRange: null,
        currentRange: { start: 7, end: 17 },
        sourcePosition: null,
        blockIndex: 0,
        blockType: 'unknown',
      },
    ];

    const enriched = enrichChangesWithPositions(changes, originalAst, currentAst);

    expect(enriched[0].sourcePosition).not.toBeNull();
  });

  it('handles deletions (no current range)', () => {
    const original = '# Hello\n\nOld text';
    const current = '# Hello';
    const originalAst = parseOrThrow(original);
    const currentAst = parseOrThrow(current);

    const changes: Change[] = [
      {
        id: 'change-0',
        type: 'deletion',
        originalText: '\n\nOld text',
        currentText: '',
        originalRange: { start: 7, end: 17 },
        currentRange: null,
        sourcePosition: null,
        blockIndex: 0,
        blockType: 'unknown',
      },
    ];

    const enriched = enrichChangesWithPositions(changes, originalAst, currentAst);

    expect(enriched[0].sourcePosition).not.toBeNull();
  });

  it('preserves change properties while enriching', () => {
    const original = 'Hello';
    const current = 'World';
    const originalAst = parseOrThrow(original);
    const currentAst = parseOrThrow(current);

    const changes: Change[] = [
      {
        id: 'change-42',
        type: 'replacement',
        originalText: 'Hello',
        currentText: 'World',
        originalRange: { start: 0, end: 5 },
        currentRange: { start: 0, end: 5 },
        sourcePosition: null,
        blockIndex: 0,
        blockType: 'unknown',
      },
    ];

    const enriched = enrichChangesWithPositions(changes, originalAst, currentAst);

    expect(enriched[0].id).toBe('change-42');
    expect(enriched[0].type).toBe('replacement');
    expect(enriched[0].originalText).toBe('Hello');
    expect(enriched[0].currentText).toBe('World');
  });

  it('computes accurate line/column when sourceText is provided', () => {
    const original = '# Hello\n\nFirst line.\nSecond line.';
    const current = '# Hello\n\nFirst line.\nModified line.';
    const originalAst = parseOrThrow(original);
    const currentAst = parseOrThrow(current);

    const changes: Change[] = [
      {
        id: 'change-0',
        type: 'replacement',
        originalText: 'Second',
        currentText: 'Modified',
        originalRange: { start: 22, end: 28 },
        currentRange: { start: 22, end: 30 },
        sourcePosition: null,
        blockIndex: 0,
        blockType: 'unknown',
      },
    ];

    const enriched = enrichChangesWithPositions(
      changes,
      originalAst,
      currentAst,
      original,
      current,
    );

    expect(enriched[0].sourcePosition).not.toBeNull();
    expect(enriched[0].sourcePosition!.offset).toBe(22);
  });
});

describe('enrichDiffWithPositions', () => {
  it('returns enriched changes and groups', () => {
    const original = '# Hello\n\nWorld';
    const current = '# Hello\n\nUniverse';
    const originalAst = parseOrThrow(original);
    const currentAst = parseOrThrow(current);

    const changes: Change[] = [
      {
        id: 'change-0',
        type: 'replacement',
        originalText: 'World',
        currentText: 'Universe',
        originalRange: { start: 10, end: 15 },
        currentRange: { start: 10, end: 18 },
        sourcePosition: null,
        blockIndex: 0,
        blockType: 'unknown',
      },
    ];

    const result = enrichDiffWithPositions(changes, originalAst, currentAst);

    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].blockType).toBe('paragraph');
    expect(result.groups).toBeDefined();
    expect(Array.isArray(result.groups)).toBe(true);
  });

  it('passes sourceText through to enrichChangesWithPositions', () => {
    const original = '# Hello\n\nWorld';
    const current = '# Hello\n\nUniverse';
    const originalAst = parseOrThrow(original);
    const currentAst = parseOrThrow(current);

    const changes: Change[] = [
      {
        id: 'change-0',
        type: 'replacement',
        originalText: 'World',
        currentText: 'Universe',
        originalRange: { start: 10, end: 15 },
        currentRange: { start: 10, end: 18 },
        sourcePosition: null,
        blockIndex: 0,
        blockType: 'unknown',
      },
    ];

    const result = enrichDiffWithPositions(changes, originalAst, currentAst, original, current);

    expect(result.changes[0].sourcePosition).not.toBeNull();
    expect(result.changes[0].sourcePosition!.offset).toBe(10);
  });
});
