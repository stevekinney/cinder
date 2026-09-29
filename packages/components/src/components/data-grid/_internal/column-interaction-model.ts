import type { DataGridColumnPin } from '../data-grid.types.ts';

/**
 * Clamps `width` to `[minWidth, maxWidth]`. `maxWidth` of `undefined` means
 * unbounded. Shared by pointer resize (COR-1131) and keyboard resize
 * (COR-1133) so both gestures land on identical final widths.
 */
export function clampColumnWidth(
  width: number,
  minWidth: number,
  maxWidth: number | undefined,
): number {
  const upperBound = maxWidth ?? Number.POSITIVE_INFINITY;
  return Math.min(Math.max(width, minWidth), upperBound);
}

/**
 * Resolves the live width for a pointer-driven resize drag: `startWidth`
 * plus `deltaX` (already sign-adjusted for text direction by the caller),
 * clamped to the column's bounds.
 */
export function getPointerResizedColumnWidth(
  startWidth: number,
  deltaX: number,
  minWidth: number,
  maxWidth: number | undefined,
): number {
  return clampColumnWidth(startWidth + deltaX, minWidth, maxWidth);
}

/** Default step used by Shift+ArrowLeft/Right keyboard resize (COR-1133). */
export const KEYBOARD_COLUMN_RESIZE_STEP = 10;

/**
 * Resolves the next width for a single Shift+ArrowLeft/Right keyboard
 * resize step in `direction` (`1` widens, `-1` narrows), clamped to the
 * column's bounds.
 */
export function getKeyboardResizedColumnWidth(
  currentWidth: number,
  direction: 1 | -1,
  minWidth: number,
  maxWidth: number | undefined,
  step: number = KEYBOARD_COLUMN_RESIZE_STEP,
): number {
  return clampColumnWidth(currentWidth + direction * step, minWidth, maxWidth);
}

type PinLookup = ReadonlyMap<string, DataGridColumnPin | undefined>;

/**
 * Rebuilds `currentOrder` with every key belonging to `pin`'s group replaced,
 * in order, by `nextGroupOrder` — every other key keeps its existing
 * position. Both arrays must contain exactly the same set of keys for that
 * pin group; used internally by the reorder helpers below to keep pin
 * groups (left-pinned, unpinned, right-pinned) from ever interleaving.
 */
function withReorderedGroup(
  currentOrder: readonly string[],
  pinByKey: PinLookup,
  pin: DataGridColumnPin | undefined,
  nextGroupOrder: readonly string[],
): readonly string[] {
  let cursor = 0;
  return currentOrder.map((key) => {
    if (pinByKey.get(key) !== pin) return key;
    const nextKey = nextGroupOrder[cursor];
    cursor += 1;
    return nextKey ?? key;
  });
}

/**
 * Moves `draggedKey` immediately before or after `targetKey` and returns the
 * resulting full column-key order. Reordering is constrained to within the
 * same pin group: a drop is a no-op (returns `undefined`) whenever
 * `draggedKey` and `targetKey` do not share a `pin` value, either key is
 * missing from `currentOrder`, or the drop would not change the order.
 */
export function reorderColumnKeyBeforeOrAfter(
  currentOrder: readonly string[],
  pinByKey: PinLookup,
  draggedKey: string,
  targetKey: string,
  dropSide: 'before' | 'after',
): readonly string[] | undefined {
  if (draggedKey === targetKey) return undefined;
  const pin = pinByKey.get(draggedKey);
  if (pin !== pinByKey.get(targetKey)) return undefined;

  const groupKeys = currentOrder.filter((key) => pinByKey.get(key) === pin);
  const fromIndex = groupKeys.indexOf(draggedKey);
  const targetIndex = groupKeys.indexOf(targetKey);
  if (fromIndex < 0 || targetIndex < 0) return undefined;

  const withoutDragged = groupKeys.filter((key) => key !== draggedKey);
  const targetIndexWithoutDragged = withoutDragged.indexOf(targetKey);
  const insertAt =
    dropSide === 'before' ? targetIndexWithoutDragged : targetIndexWithoutDragged + 1;
  const nextGroupKeys = [
    ...withoutDragged.slice(0, insertAt),
    draggedKey,
    ...withoutDragged.slice(insertAt),
  ];

  if (nextGroupKeys.every((key, index) => key === groupKeys[index])) return undefined;
  return withReorderedGroup(currentOrder, pinByKey, pin, nextGroupKeys);
}

/**
 * Moves `columnKey` one position toward `direction` (`1` = later, `-1` =
 * earlier) within its own pin group and returns the resulting full
 * column-key order, or `undefined` when the column is missing or already at
 * that edge of its pin group (Ctrl/Cmd+Shift+ArrowLeft/Right, COR-1133).
 */
export function moveColumnKeyWithinPinGroup(
  currentOrder: readonly string[],
  pinByKey: PinLookup,
  columnKey: string,
  direction: 1 | -1,
): readonly string[] | undefined {
  const pin = pinByKey.get(columnKey);
  const groupKeys = currentOrder.filter((key) => pinByKey.get(key) === pin);
  const fromIndex = groupKeys.indexOf(columnKey);
  if (fromIndex < 0) return undefined;

  const toIndex = fromIndex + direction;
  if (toIndex < 0 || toIndex >= groupKeys.length) return undefined;

  const nextGroupKeys = groupKeys.slice();
  const [movedKey] = nextGroupKeys.splice(fromIndex, 1);
  if (movedKey === undefined) return undefined;
  nextGroupKeys.splice(toIndex, 0, movedKey);

  return withReorderedGroup(currentOrder, pinByKey, pin, nextGroupKeys);
}
