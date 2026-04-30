/**
 * Keyboard navigation helpers for composite widgets that use roving tabindex.
 */

export type RovingNavigationOptions = {
  /** Return true when an item at the given index should be skipped. */
  isDisabled?: (index: number) => boolean;
  /** Whether ArrowUp and ArrowDown should move focus. */
  vertical?: boolean;
  /** Whether ArrowLeft and ArrowRight should move focus. */
  horizontal?: boolean;
};

const ROVING_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);

/** Return whether a keyboard key is handled by roving tabindex navigation. */
export function isRovingKey(key: string): boolean {
  return ROVING_KEYS.has(key);
}

function findNextIndex(
  currentIndex: number,
  length: number,
  direction: 1 | -1,
  isDisabled?: (index: number) => boolean,
): number {
  if (length === 0) return -1;

  if (!isDisabled) {
    return (currentIndex + direction + length) % length;
  }

  for (let offset = 1; offset <= length; offset += 1) {
    const candidateIndex = (currentIndex + offset * direction + length * offset) % length;
    if (!isDisabled(candidateIndex)) {
      return candidateIndex;
    }
  }

  return currentIndex;
}

function findFirstIndex(
  length: number,
  isDisabled?: (index: number) => boolean,
  currentIndex = 0,
): number {
  if (length === 0) return -1;
  if (!isDisabled) return 0;

  for (let index = 0; index < length; index += 1) {
    if (!isDisabled(index)) return index;
  }

  return currentIndex;
}

function findLastIndex(
  length: number,
  isDisabled?: (index: number) => boolean,
  currentIndex = 0,
): number {
  if (length === 0) return -1;
  if (!isDisabled) return length - 1;

  for (let index = length - 1; index >= 0; index -= 1) {
    if (!isDisabled(index)) return index;
  }

  return currentIndex;
}

/**
 * Return the index that a roving-tabindex widget should move to for a key event.
 */
export function handleRovingKeydown(
  event: KeyboardEvent,
  currentIndex: number,
  length: number,
  options: RovingNavigationOptions = {},
): number | null {
  const { isDisabled, vertical = true, horizontal = true } = options;

  if (length === 0) return null;

  switch (event.key) {
    case 'ArrowRight':
      return horizontal ? findNextIndex(currentIndex, length, 1, isDisabled) : null;
    case 'ArrowDown':
      return vertical ? findNextIndex(currentIndex, length, 1, isDisabled) : null;
    case 'ArrowLeft':
      return horizontal ? findNextIndex(currentIndex, length, -1, isDisabled) : null;
    case 'ArrowUp':
      return vertical ? findNextIndex(currentIndex, length, -1, isDisabled) : null;
    case 'Home':
      return findFirstIndex(length, isDisabled, currentIndex);
    case 'End':
      return findLastIndex(length, isDisabled, currentIndex);
    default:
      return null;
  }
}

/**
 * Return the one item index that should receive tabindex="0".
 */
export function getFocusableIndex(
  selectedIndex: number,
  length: number,
  isDisabled?: (index: number) => boolean,
): number {
  if (length === 0) return -1;
  if (selectedIndex >= 0 && selectedIndex < length) return selectedIndex;
  return findFirstIndex(length, isDisabled, 0);
}
