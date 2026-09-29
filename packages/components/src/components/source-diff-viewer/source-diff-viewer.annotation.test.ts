import { describe, expect, test } from 'bun:test';

import {
  buildLineSelection,
  commentableSidesForLine,
  extendLineSelection,
  isLineCommentable,
  type SourceDiffAnnotationPoint,
} from './source-diff-viewer.annotation.ts';
import { parseUnifiedPatch } from './source-diff-viewer.utilities.ts';

const patch = `diff --git a/src/one.ts b/src/one.ts
--- a/src/one.ts
+++ b/src/one.ts
@@ -1,5 +1,5 @@
 context before
-removed line
+added line
 context after

diff --git a/src/two.ts b/src/two.ts
--- a/src/two.ts
+++ b/src/two.ts
@@ -1,2 +1,2 @@
-second file old
+second file new
`;

function parse() {
  return parseUnifiedPatch(patch);
}

describe('SourceDiffViewer: isLineCommentable / commentableSidesForLine', () => {
  test('metadata rows are never commentable on either side', () => {
    const metadataLine = {
      kind: 'metadata' as const,
      content: 'Binary files a/x and b/x differ',
      oldLineNumber: null,
      newLineNumber: null,
    };
    expect(isLineCommentable(metadataLine)).toBe(false);
    expect(commentableSidesForLine(metadataLine)).toEqual([]);
  });

  test('an addition row is commentable only on the new side', () => {
    const addition = {
      kind: 'addition' as const,
      content: 'added line',
      oldLineNumber: null,
      newLineNumber: 2,
    };
    expect(commentableSidesForLine(addition)).toEqual(['new']);
  });

  test('a removal row is commentable only on the old side', () => {
    const removal = {
      kind: 'removal' as const,
      content: 'removed line',
      oldLineNumber: 2,
      newLineNumber: null,
    };
    expect(commentableSidesForLine(removal)).toEqual(['old']);
  });

  test('a context row is commentable on both sides', () => {
    const context = {
      kind: 'context' as const,
      content: 'context before',
      oldLineNumber: 1,
      newLineNumber: 1,
    };
    expect(commentableSidesForLine(context)).toEqual(['old', 'new']);
  });

  test('an empty-content context line with a valid number is still commentable', () => {
    const emptyContext = {
      kind: 'context' as const,
      content: '',
      oldLineNumber: 4,
      newLineNumber: 4,
    };
    expect(isLineCommentable(emptyContext)).toBe(true);
    expect(commentableSidesForLine(emptyContext)).toEqual(['old', 'new']);
  });
});

describe('SourceDiffViewer: buildLineSelection', () => {
  test('selects an addition on the new side with correct line number and text', () => {
    const parsed = parse();
    const file = parsed.files[0]!;
    const hunk = file.hunks[0]!;

    const selection = buildLineSelection(file, hunk, 'new', 2);

    expect(selection).toMatchObject({
      fileOccurrence: 0,
      hunkOccurrence: 0,
      side: 'new',
      startLine: 2,
      endLine: 2,
      coordinateSpace: 'raw-source',
      selectedText: 'added line',
      oldPath: 'src/one.ts',
      newPath: 'src/one.ts',
    });
  });

  test('selects a removal on the old side with correct line number and text', () => {
    const parsed = parse();
    const file = parsed.files[0]!;
    const hunk = file.hunks[0]!;

    const selection = buildLineSelection(file, hunk, 'old', 2);

    expect(selection).toMatchObject({
      side: 'old',
      startLine: 2,
      endLine: 2,
      selectedText: 'removed line',
    });
  });

  test('selects a context row explicitly on the old side', () => {
    const parsed = parse();
    const file = parsed.files[0]!;
    const hunk = file.hunks[0]!;

    const selection = buildLineSelection(file, hunk, 'old', 1);

    expect(selection).toMatchObject({ side: 'old', startLine: 1, selectedText: 'context before' });
  });

  test('selects the same context row explicitly on the new side', () => {
    const parsed = parse();
    const file = parsed.files[0]!;
    const hunk = file.hunks[0]!;

    const selection = buildLineSelection(file, hunk, 'new', 1);

    expect(selection).toMatchObject({ side: 'new', startLine: 1, selectedText: 'context before' });
  });

  test('an addition has no anchor on the old side', () => {
    const parsed = parse();
    const file = parsed.files[0]!;
    const hunk = file.hunks[0]!;

    // Line 2 on the old side is the removal, not the addition — asking for an
    // old-side anchor at the addition's new-side line number must miss.
    expect(buildLineSelection(file, hunk, 'old', 999)).toBeNull();
  });

  test('captures up to three same-side context lines, fewer at the hunk edge', () => {
    const parsed = parse();
    const file = parsed.files[0]!;
    const hunk = file.hunks[0]!;

    // "removed line" is old-side line 2, the second old-side row (index 1 of
    // 3: context before / removed line / context after). One row precedes
    // it, one follows — fewer than the 3-line cap on both sides.
    const selection = buildLineSelection(file, hunk, 'old', 2);

    expect(selection?.contextBefore).toEqual(['context before']);
    expect(selection?.contextAfter).toEqual(['context after']);
  });
});

describe('SourceDiffViewer: extendLineSelection', () => {
  function origin(point: Partial<SourceDiffAnnotationPoint> = {}): SourceDiffAnnotationPoint {
    return { fileOccurrence: 0, hunkOccurrence: 0, side: 'new', line: 1, ...point };
  }

  test('extends forward into a contiguous range on the same side', () => {
    const parsed = parse();
    const file = parsed.files[0]!;
    const hunk = file.hunks[0]!;

    // The hunk has exactly 3 new-side rows: "context before" (1), "added
    // line" (2), "context after" (3).
    const result = extendLineSelection(file, hunk, origin({ line: 1 }), origin({ line: 3 }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.selection.startLine).toBe(1);
      expect(result.selection.endLine).toBe(3);
      expect(result.selection.selectedText).toBe('context before\nadded line\ncontext after');
    }
  });

  test('normalizes a reversed target/origin pair to ascending line order', () => {
    const parsed = parse();
    const file = parsed.files[0]!;
    const hunk = file.hunks[0]!;

    const result = extendLineSelection(file, hunk, origin({ line: 3 }), origin({ line: 1 }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.selection.startLine).toBe(1);
      expect(result.selection.endLine).toBe(3);
    }
  });

  test('rejects a cross-file extension without moving the origin', () => {
    const parsed = parse();
    const file = parsed.files[0]!;
    const hunk = file.hunks[0]!;
    const originPoint = origin({ line: 1 });

    const result = extendLineSelection(file, hunk, originPoint, {
      ...originPoint,
      fileOccurrence: 1,
    });

    expect(result).toMatchObject({ ok: false, reason: 'cross-file' });
    expect(originPoint).toEqual(origin({ line: 1 }));
  });

  test('rejects a cross-hunk extension', () => {
    const parsed = parse();
    const file = parsed.files[0]!;
    const hunk = file.hunks[0]!;

    const result = extendLineSelection(file, hunk, origin({ line: 1 }), {
      ...origin({ line: 1 }),
      hunkOccurrence: 1,
    });

    expect(result).toMatchObject({ ok: false, reason: 'cross-hunk' });
  });

  test('rejects a cross-side extension', () => {
    const parsed = parse();
    const file = parsed.files[0]!;
    const hunk = file.hunks[0]!;

    const result = extendLineSelection(
      file,
      hunk,
      origin({ side: 'new', line: 1 }),
      origin({ side: 'old', line: 1 }),
    );

    expect(result).toMatchObject({ ok: false, reason: 'cross-side' });
  });

  test('rejects extending past the edge of the hunk on the same side as an "edge" reason', () => {
    const parsed = parse();
    const file = parsed.files[0]!;
    const hunk = file.hunks[0]!;

    // Line 999 passes the file/hunk/side checks (same as the origin) but has
    // no corresponding row on the new side of this hunk — the keyboard
    // Shift+Arrow flow reaches this exact case at the top/bottom of a hunk.
    const result = extendLineSelection(
      file,
      hunk,
      origin({ side: 'new', line: 1 }),
      origin({ side: 'new', line: 999 }),
    );

    expect(result).toMatchObject({ ok: false, reason: 'edge' });
  });

  test('rejects when the origin itself is no longer a row on that side', () => {
    const parsed = parse();
    const file = parsed.files[0]!;
    const hunk = file.hunks[0]!;

    // The origin, not the target, is the invalid one here — a defensive case
    // distinct from walking off the edge from a valid origin.
    const result = extendLineSelection(
      file,
      hunk,
      origin({ side: 'new', line: 999 }),
      origin({ side: 'new', line: 1 }),
    );

    expect(result).toMatchObject({ ok: false, reason: 'cross-hunk' });
  });

  test('extends correctly on the old side across a hunk that has an addition-only row', () => {
    const parsed = parse();
    const file = parsed.files[0]!;
    const hunk = file.hunks[0]!;

    // Old-side rows: "context before" (1), "removed line" (2), "context
    // after" (3) — the addition has no old-side line number and is skipped.
    const result = extendLineSelection(
      file,
      hunk,
      origin({ side: 'old', line: 1 }),
      origin({ side: 'old', line: 3 }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.selection.startLine).toBe(1);
      expect(result.selection.endLine).toBe(3);
      expect(result.selection.selectedText).toBe('context before\nremoved line\ncontext after');
    }
  });

  test('keyboard-style stepwise extension produces the same payload as a direct shift-click-style extension', () => {
    const parsed = parse();
    const file = parsed.files[0]!;
    const hunk = file.hunks[0]!;
    const originPoint = origin({ side: 'new', line: 1 });

    // Direct extension, as a shift-click jumps straight to the target.
    const direct = extendLineSelection(file, hunk, originPoint, origin({ side: 'new', line: 3 }));

    // Stepwise extension, as Shift+ArrowDown walks one row at a time,
    // re-validating against the same fixed origin at each step.
    const stepOne = extendLineSelection(file, hunk, originPoint, origin({ side: 'new', line: 2 }));
    if (!stepOne.ok) throw new Error('expected stepOne to succeed');
    const stepTwo = extendLineSelection(file, hunk, originPoint, origin({ side: 'new', line: 3 }));

    expect(direct.ok).toBe(true);
    expect(stepTwo.ok).toBe(true);
    if (direct.ok && stepTwo.ok) {
      expect(stepTwo.selection).toEqual(direct.selection);
    }
  });

  test('every rejection carries an accessible explanation message', () => {
    const parsed = parse();
    const file = parsed.files[0]!;
    const hunk = file.hunks[0]!;

    const result = extendLineSelection(file, hunk, origin({ line: 1 }), {
      ...origin({ line: 1 }),
      fileOccurrence: 5,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);
    }
  });
});
