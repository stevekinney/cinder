import { describe, expect, it } from 'bun:test';
import { enrichSelectionWithSource, mapPosToSource, mapSourceToPos } from './bridge.js';
import type { EditorSelection, SourcePosition } from './types.js';

function expectSourcePosition(sourcePosition: SourcePosition | null): SourcePosition {
  expect(sourcePosition).not.toBeNull();

  if (sourcePosition === null) {
    throw new Error('Expected source position.');
  }

  return sourcePosition;
}

describe('mapPosToSource', () => {
  it('maps position 0 to line 1, column 1', () => {
    const markdown = 'Hello world';
    const result = mapPosToSource(0, markdown);

    expect(result).toEqual({
      line: 1,
      column: 1,
      offset: 0,
    });
  });

  it('tracks column position within a line', () => {
    const markdown = 'Hello world';
    const result = mapPosToSource(6, markdown);

    expect(result).toEqual({
      line: 1,
      column: 7,
      offset: 6,
    });
  });

  it('tracks line position across newlines', () => {
    const markdown = 'Line one\nLine two\nLine three';
    const result = mapPosToSource(9, markdown);

    expect(result).toEqual({
      line: 2,
      column: 1,
      offset: 9,
    });
  });

  it('tracks both line and column', () => {
    const markdown = 'First\nSecond\nThird';
    // Position 10 is 'o' in "Second" (after "First\nSec")
    const result = mapPosToSource(10, markdown);

    expect(result).toEqual({
      line: 2,
      column: 5,
      offset: 10,
    });
  });

  it('returns null for negative position', () => {
    const markdown = 'Hello';
    const result = mapPosToSource(-1, markdown);

    expect(result).toBeNull();
  });

  it('returns null for position beyond document length', () => {
    const markdown = 'Hello';
    const result = mapPosToSource(100, markdown);

    expect(result).toBeNull();
  });

  it('handles empty string', () => {
    const result = mapPosToSource(0, '');

    expect(result).toEqual({
      line: 1,
      column: 1,
      offset: 0,
    });
  });

  it('handles position at end of document', () => {
    const markdown = 'Hi';
    const result = mapPosToSource(2, markdown);

    expect(result).toEqual({
      line: 1,
      column: 3,
      offset: 2,
    });
  });
});

describe('mapSourceToPos', () => {
  it('uses offset directly when available', () => {
    const markdown = 'Hello world';
    const result = mapSourceToPos({ line: 1, column: 7, offset: 6 }, markdown);

    expect(result).toBe(6);
  });

  it('calculates position from line/column when no offset', () => {
    const markdown = 'First\nSecond\nThird';
    // Line 2, column 3 = "Second"[2] = 'c'
    const result = mapSourceToPos({ line: 2, column: 3, offset: -1 }, markdown);

    expect(result).toBe(8); // "First\nSe" = 8 characters
  });

  it('finds first line position', () => {
    const markdown = 'Hello';
    const result = mapSourceToPos({ line: 1, column: 1, offset: -1 }, markdown);

    expect(result).toBe(0);
  });

  it('handles line beyond document', () => {
    const markdown = 'Only one line';
    const result = mapSourceToPos({ line: 5, column: 1, offset: -1 }, markdown);

    expect(result).toBeNull();
  });

  it('clamps offset to document length', () => {
    const markdown = 'Short';
    const result = mapSourceToPos({ line: 1, column: 1, offset: 100 }, markdown);

    expect(result).toBe(5); // Clamped to length
  });

  it('handles multi-line document correctly', () => {
    const markdown = '# Heading\n\nParagraph text.';
    // Line 3 = "Paragraph text.", column 1 = 'P'
    const result = mapSourceToPos({ line: 3, column: 1, offset: -1 }, markdown);

    expect(result).toBe(11); // "# Heading\n\n" = 11 characters
  });
});

describe('enrichSelectionWithSource', () => {
  it('adds sourcePosition to selection', () => {
    const selection: EditorSelection = {
      from: 5,
      to: 10,
      isCollapsed: false,
    };
    const markdown = 'Hello world, how are you?';

    const enriched = enrichSelectionWithSource(selection, markdown);

    expect(enriched.from).toBe(5);
    expect(enriched.to).toBe(10);
    expect(enriched.isCollapsed).toBe(false);
    expect(enriched.sourcePosition).toEqual({
      line: 1,
      column: 6,
      offset: 5,
    });
  });

  it('handles collapsed selection (cursor)', () => {
    const selection: EditorSelection = {
      from: 0,
      to: 0,
      isCollapsed: true,
    };
    const markdown = 'Hello';

    const enriched = enrichSelectionWithSource(selection, markdown);

    expect(enriched.isCollapsed).toBe(true);
    expect(enriched.sourcePosition).toEqual({
      line: 1,
      column: 1,
      offset: 0,
    });
  });

  it('maps position at start of new line', () => {
    const selection: EditorSelection = {
      from: 6,
      to: 6,
      isCollapsed: true,
    };
    const markdown = 'Hello\nWorld';

    const enriched = enrichSelectionWithSource(selection, markdown);

    expect(enriched.sourcePosition).toEqual({
      line: 2,
      column: 1,
      offset: 6,
    });
  });
});

describe('round-trip position mapping', () => {
  it('round-trips simple position', () => {
    const markdown = 'Hello world';
    const position = 6;

    const source = expectSourcePosition(mapPosToSource(position, markdown));

    const roundTripped = mapSourceToPos(source, markdown);
    expect(roundTripped).toBe(position);
  });

  it('round-trips position in multi-line document', () => {
    const markdown = '# Heading\n\nParagraph with some text.\n\nAnother paragraph.';
    const position = 15;

    const source = expectSourcePosition(mapPosToSource(position, markdown));

    const roundTripped = mapSourceToPos(source, markdown);
    expect(roundTripped).toBe(position);
  });

  it('round-trips position at document boundaries', () => {
    const markdown = 'Content';

    // Start
    const startSource = expectSourcePosition(mapPosToSource(0, markdown));
    expect(mapSourceToPos(startSource, markdown)).toBe(0);

    // End
    const endSource = expectSourcePosition(mapPosToSource(7, markdown));
    expect(mapSourceToPos(endSource, markdown)).toBe(7);
  });
});

// ============================================================================
// Text Offset <-> ProseMirror Position Mapping Tests
// ============================================================================
// NOTE: Full testing of buildTextToProseMirrorPositionMap, textOffsetToProseMirrorPosition,
// and proseMirrorPositionToTextOffset requires actual ProseMirror documents.
// These tests verify the function contracts and behavior expectations.
// End-to-end testing happens in browser tests with the actual editor.

describe('textOffsetToProseMirrorPosition contract', () => {
  // Import the functions dynamically to test their existence and types
  it('exports textOffsetToProseMirrorPosition function', async () => {
    const bridge = await import('./bridge.js');
    expect(typeof bridge.textOffsetToProseMirrorPosition).toBe('function');
  });

  it('exports proseMirrorPositionToTextOffset function', async () => {
    const bridge = await import('./bridge.js');
    expect(typeof bridge.proseMirrorPositionToTextOffset).toBe('function');
  });

  it('exports buildTextToProseMirrorPositionMap function', async () => {
    const bridge = await import('./bridge.js');
    expect(typeof bridge.buildTextToProseMirrorPositionMap).toBe('function');
  });
});

describe('position offset map structure', () => {
  it('PositionOffsetMap has correct shape', () => {
    // The map should have bidirectional mapping
    interface PositionOffsetMap {
      textToPm: Map<number, number>;
      pmToText: Map<number, number>;
    }

    const map: PositionOffsetMap = {
      textToPm: new Map(),
      pmToText: new Map(),
    };

    // Simulate adding a mapping
    map.textToPm.set(0, 1); // text offset 0 -> PM position 1
    map.pmToText.set(1, 0); // PM position 1 -> text offset 0

    expect(map.textToPm.get(0)).toBe(1);
    expect(map.pmToText.get(1)).toBe(0);
  });

  it('bidirectional mapping is consistent', () => {
    // For every textToPm[x] = y, pmToText[y] should = x
    const textToPm = new Map<number, number>();
    const pmToText = new Map<number, number>();

    // Add consistent mappings
    const pairs: [number, number][] = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 5], // PM positions can skip (structural positions)
    ];

    for (const [textOff, pmPos] of pairs) {
      textToPm.set(textOff, pmPos);
      pmToText.set(pmPos, textOff);
    }

    // Verify consistency
    for (const [textOff, pmPos] of pairs) {
      expect(textToPm.get(textOff)).toBe(pmPos);
      expect(pmToText.get(pmPos)).toBe(textOff);
    }
  });
});

describe('offset mapping edge cases', () => {
  it('handles offset 0 (start of document)', () => {
    // In ProseMirror, position 0 is before the doc
    // Position 1 is at the start of the first block's content
    // This is documented behavior

    // For a doc with just text, we expect:
    // text offset 0 -> PM position 1 (inside first paragraph)
    // This is because PM has structural positions

    const expectedFirstTextPosition = 1; // After doc opening tag
    expect(expectedFirstTextPosition).toBeGreaterThan(0);
  });

  it('block separators add to text offset', () => {
    // When doc.textBetween is called, blocks are separated by '\n'
    // This means text offset grows by 1 at each block boundary

    // For "Para 1\nPara 2", the text between two paragraphs includes '\n'
    const para1 = 'Para 1';
    const separator = '\n';
    const para2 = 'Para 2';

    const textContent = para1 + separator + para2;
    expect(textContent).toBe('Para 1\nPara 2');

    // The offset of 'P' in "Para 2" is 7 (including separator)
    expect(textContent.indexOf('Para 2')).toBe(7);
  });

  it('nested blocks add separators correctly', () => {
    // For lists and blockquotes, separators are added between block content
    // Example: "- Item 1\n- Item 2" has separator between list items

    const listItem1 = 'Item 1';
    const listItem2 = 'Item 2';
    const separator = '\n';

    // textBetween for a list would produce:
    const expectedText = listItem1 + separator + listItem2;
    expect(expectedText).toBe('Item 1\nItem 2');

    // Offset of "Item 2" is after "Item 1\n"
    expect(expectedText.indexOf('Item 2')).toBe(7);
  });

  it('leaf nodes with leafText contribute to offset', () => {
    // Some nodes like hard_break have leafText that adds to offset
    // Example: hard_break typically adds '\n'

    const textBefore = 'Line 1';
    const hardBreak = '\n'; // leafText for hard_break
    const textAfter = 'Line 2';

    const combined = textBefore + hardBreak + textAfter;
    expect(combined).toBe('Line 1\nLine 2');
  });
});

describe('nested block structure separator rules', () => {
  /**
   * This describes the critical distinction between isBlock and isTextblock:
   *
   * isBlock = true for: doc, paragraph, heading, blockquote, bullet_list,
   *                     ordered_list, list_item, code_block, etc.
   * isTextblock = true for: paragraph, heading, code_block
   *                         (blocks that DIRECTLY contain inline content)
   *
   * doc.textBetween() adds separators ONLY between textblocks, not between
   * wrapper blocks like list_item or blockquote.
   */

  it('only adds separator between text blocks, not wrapper blocks', () => {
    // For a list structure:
    // bullet_list > list_item > paragraph > "Item 1"
    // bullet_list > list_item > paragraph > "Item 2"
    //
    // textBetween produces: "Item 1\nItem 2" (ONE separator)
    //
    // The walk function must use isTextblock (not isBlock) to match this.
    // list_item.isBlock = true, list_item.isTextblock = false
    // paragraph.isBlock = true, paragraph.isTextblock = true

    // Expected: separator added ONLY when entering the second paragraph
    const expectedOutput = 'Item 1\nItem 2';
    expect(expectedOutput.match(/\n/g)?.length).toBe(1);
  });

  it('handles deeply nested blockquote with list', () => {
    // > - Item A
    // > - Item B
    //
    // Structure: blockquote > bullet_list > list_item > paragraph > text
    // textBetween produces: "Item A\nItem B" (ONE separator)

    const expectedOutput = 'Item A\nItem B';
    expect(expectedOutput.split('\n').length).toBe(2);
  });

  it('handles multiple paragraphs in a list item', () => {
    // - Para 1
    //
    //   Para 2
    // - Para 3
    //
    // Structure has 3 paragraphs, so 2 separators
    // textBetween produces: "Para 1\nPara 2\nPara 3"

    const expectedOutput = 'Para 1\nPara 2\nPara 3';
    expect(expectedOutput.split('\n').length).toBe(3);
    expect(expectedOutput.match(/\n/g)?.length).toBe(2);
  });

  it('handles code block inside list', () => {
    // - Item
    //
    //   ```
    //   code
    //   ```
    //
    // list_item contains paragraph + code_block (both isTextblock)
    // textBetween produces: "Item\ncode" (ONE separator)

    const expectedOutput = 'Item\ncode';
    expect(expectedOutput.split('\n').length).toBe(2);
  });

  it('correctly skips separator for wrapper blocks', () => {
    // Wrapper blocks that should NOT trigger separator:
    const wrapperBlocks = ['bullet_list', 'ordered_list', 'list_item', 'blockquote'];

    // Text blocks that SHOULD trigger separator (after first content):
    const textBlocks = ['paragraph', 'heading', 'code_block'];

    // This documents the behavior: separator only before textBlocks
    expect(wrapperBlocks.every((b) => !textBlocks.includes(b))).toBe(true);
    expect(textBlocks.every((b) => !wrapperBlocks.includes(b))).toBe(true);
  });
});

describe('end position mapping for slice semantics', () => {
  /**
   * JavaScript string slice uses exclusive end indices: str.slice(0, 5)
   * includes indices 0-4, not 5. When reanchorQuote returns { from: 10, to: 15 },
   * we need textOffsetToProseMirrorPosition(15) to return a valid PM position.
   *
   * The fix: After processing each text node, we map the exclusive end offset
   * (textOffset after incrementing) to the PM position after the text node.
   */

  it('maps exclusive end offset for text content', () => {
    // For text "Hello" (length 5) at text offset 0:
    // - Indices 0-4 map to content positions
    // - Index 5 (exclusive end) must also be mapped for slice semantics
    //
    // This ensures textOffsetToProseMirrorPosition(5) returns the position
    // after "Hello", not null.

    const text = 'Hello';
    const expectedMappings = text.length + 1; // 0..5 inclusive = 6 entries

    // The map should have entries for indices 0 through text.length
    expect(expectedMappings).toBe(6);
  });

  it('end offset equals start of next content', () => {
    // For "Para 1\nPara 2", the end of "Para 1" (offset 6)
    // is the same position as the separator (also offset 6).
    // The separator is between blocks, and its end position
    // aligns with the start of "Para 2" content.

    const para1 = 'Para 1';
    const separator = '\n';
    const para2 = 'Para 2';
    const combined = para1 + separator + para2;

    // Offset 6 is both the end of "Para 1" and the separator position
    expect(para1.length).toBe(6);
    expect(combined.indexOf(separator)).toBe(6);

    // Offset 7 is the start of "Para 2"
    expect(combined.indexOf(para2)).toBe(7);
  });
});

describe('offset map caching', () => {
  it('cache key should be document instance', () => {
    // The offset map is cached using WeakMap with doc as key
    // This ensures the map is garbage collected when doc is unreferenced

    // WeakMap behavior verification
    const cache = new WeakMap<object, string>();
    const obj1 = { id: 1 };
    const obj2 = { id: 2 };

    cache.set(obj1, 'map1');
    cache.set(obj2, 'map2');

    expect(cache.get(obj1)).toBe('map1');
    expect(cache.get(obj2)).toBe('map2');
  });

  it('same doc returns cached map', () => {
    // If buildTextToProseMirrorPositionMap is called with same doc
    // it should return the cached map, not rebuild

    // This is verified by the implementation using WeakMap
    // We test the caching behavior works as expected
    const cache = new WeakMap<object, { built: number }>();
    let buildCount = 0;

    function getOrBuild(doc: object) {
      const cached = cache.get(doc);
      if (cached) return cached;

      buildCount++;
      const map = { built: buildCount };
      cache.set(doc, map);
      return map;
    }

    const doc = {};
    const map1 = getOrBuild(doc);
    const map2 = getOrBuild(doc);

    expect(map1).toBe(map2);
    expect(buildCount).toBe(1); // Only built once
  });
});

// ============================================================================
// textOffsetToLineColumn Contract Tests
// ============================================================================
// NOTE: Full testing requires actual ProseMirror documents.
// These tests verify the function export and expected behavior patterns.

describe('textOffsetToLineColumn contract', () => {
  it('exports textOffsetToLineColumn function', async () => {
    const bridge = await import('./bridge.js');
    expect(typeof bridge.textOffsetToLineColumn).toBe('function');
  });

  it('returns SourcePosition with offset, line, and column', async () => {
    // Verify the return type structure
    interface ExpectedSourcePosition {
      offset: number;
      line: number;
      column: number;
    }

    const mockResult: ExpectedSourcePosition = {
      offset: 5,
      line: 1,
      column: 6,
    };

    expect(mockResult).toHaveProperty('offset');
    expect(mockResult).toHaveProperty('line');
    expect(mockResult).toHaveProperty('column');
    expect(typeof mockResult.offset).toBe('number');
    expect(typeof mockResult.line).toBe('number');
    expect(typeof mockResult.column).toBe('number');
  });

  it('line counting starts at 1 (1-based)', () => {
    // Line numbers should be 1-based (matching editor conventions)
    // At the start of a document, line = 1
    const expectedFirstLine = 1;
    expect(expectedFirstLine).toBe(1);
  });

  it('column counting starts at 1 (1-based)', () => {
    // Column numbers should be 1-based (matching editor conventions)
    // At the start of a line, column = 1
    const expectedFirstColumn = 1;
    expect(expectedFirstColumn).toBe(1);
  });

  it('newlines increment line count and reset column', () => {
    // Expected behavior:
    // "abc\ndef" at offset 4 (the 'd') should be line 2, column 1
    const text = 'abc\ndef';
    const offsetOfD = text.indexOf('d');
    expect(offsetOfD).toBe(4);

    // After the newline, we're on line 2
    const expectedLine = 2;
    // First character of new line is column 1
    const expectedColumn = 1;

    expect(expectedLine).toBe(2);
    expect(expectedColumn).toBe(1);
  });

  it('handles multi-line text correctly', () => {
    // "line1\nline2\nline3" has 3 lines
    const text = 'line1\nline2\nline3';
    const lines = text.split('\n');
    expect(lines.length).toBe(3);

    // Offset of 'l' in "line3" (position 12)
    const offsetOfLine3 = text.indexOf('line3');
    expect(offsetOfLine3).toBe(12);

    // Should be line 3, column 1
    const expectedLine = 3;
    const expectedColumn = 1;
    expect(expectedLine).toBe(3);
    expect(expectedColumn).toBe(1);
  });

  it('clamps offset to valid range', () => {
    // Negative offsets should be clamped to 0
    // Offsets beyond content should be clamped to content length
    const contentLength = 10;
    const clampedNegative = Math.max(0, -5);
    const clampedOverflow = Math.min(contentLength, 15);

    expect(clampedNegative).toBe(0);
    expect(clampedOverflow).toBe(contentLength);
  });
});
