export interface SplitContent {
  lines: string[];
  hasTrailingNewline: boolean;
}

export interface LineChange {
  type: 'same' | 'added' | 'removed';
  originalIndex: number | null;
  currentIndex: number | null;
  text: string;
}

export function splitIntoLines(content: string, normalized: boolean): SplitContent {
  if (content === '') return { lines: [], hasTrailingNewline: normalized };
  const hasTrailingNewline = normalized || content.endsWith('\n');
  const text = content.endsWith('\n') ? content.slice(0, -1) : content;
  return { lines: text.split('\n'), hasTrailingNewline };
}

export function representTrailingNewlineChange(
  changes: LineChange[],
  original: SplitContent,
  current: SplitContent,
): void {
  if (original.hasTrailingNewline === current.hasTrailingNewline) return;
  const lastChange = changes.at(-1);
  if (!lastChange || lastChange.type !== 'same') return;

  changes.splice(
    -1,
    1,
    {
      type: 'removed',
      originalIndex: lastChange.originalIndex,
      currentIndex: null,
      text: lastChange.text,
    },
    {
      type: 'added',
      originalIndex: null,
      currentIndex: lastChange.currentIndex,
      text: lastChange.text,
    },
  );
}

export function computeLineChanges(original: string[], current: string[]): LineChange[] {
  const lcs = buildLcsTable(original, current);
  return backtrackLineChanges(original, current, lcs);
}

function buildLcsTable(original: string[], current: string[]): number[][] {
  const lcs: number[][] = Array.from({ length: original.length + 1 }, () =>
    Array(current.length + 1).fill(0),
  );

  for (let i = 1; i <= original.length; i++) {
    for (let j = 1; j <= current.length; j++) {
      lcs[i]![j] =
        original[i - 1] === current[j - 1]
          ? lcs[i - 1]![j - 1]! + 1
          : Math.max(lcs[i - 1]![j]!, lcs[i]![j - 1]!);
    }
  }
  return lcs;
}

function backtrackLineChanges(
  original: string[],
  current: string[],
  lcs: number[][],
): LineChange[] {
  let originalIndex = original.length;
  let currentIndex = current.length;
  const result: LineChange[] = [];

  while (originalIndex > 0 || currentIndex > 0) {
    if (
      originalIndex > 0 &&
      currentIndex > 0 &&
      original[originalIndex - 1] === current[currentIndex - 1]
    ) {
      result.unshift({
        type: 'same',
        originalIndex: originalIndex - 1,
        currentIndex: currentIndex - 1,
        text: original[originalIndex - 1]!,
      });
      originalIndex--;
      currentIndex--;
    } else if (
      currentIndex > 0 &&
      (originalIndex === 0 ||
        lcs[originalIndex]![currentIndex - 1]! >= lcs[originalIndex - 1]![currentIndex]!)
    ) {
      result.unshift({
        type: 'added',
        originalIndex: null,
        currentIndex: currentIndex - 1,
        text: current[currentIndex - 1]!,
      });
      currentIndex--;
    } else {
      result.unshift({
        type: 'removed',
        originalIndex: originalIndex - 1,
        currentIndex: null,
        text: original[originalIndex - 1]!,
      });
      originalIndex--;
    }
  }
  return result;
}
