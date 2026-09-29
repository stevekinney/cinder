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
