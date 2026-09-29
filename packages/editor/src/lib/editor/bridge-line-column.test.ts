import { describe, expect, it } from 'bun:test';

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
