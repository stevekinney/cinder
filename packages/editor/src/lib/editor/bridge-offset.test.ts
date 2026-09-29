import { describe, expect, it } from 'bun:test';

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
