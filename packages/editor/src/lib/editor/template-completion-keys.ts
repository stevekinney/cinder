/**
 * The placeholder completion keyboard contract, independent of the editing
 * surface. Rich and source mode both map keys through this module.
 */

import type { PlaceholderCandidate } from '@lostgradient/markdown';

import type { CompletionState } from './template-completion-state.js';

type ModifierKeys = Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>;

function hasModifier(event: ModifierKeys): boolean {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

/** What a key does while the popup is open. */
export type CompletionKeyAction =
  | { readonly type: 'navigate'; readonly index: number }
  | { readonly type: 'accept'; readonly candidate: PlaceholderCandidate }
  /** `consume` is false for Tab, which keeps its normal behavior after dismissing. */
  | { readonly type: 'dismiss'; readonly consume: boolean };

/**
 * The action for a key pressed while the popup shows rows, or `null` when
 * the key keeps its normal editing behavior. The keyboard contract is shared
 * by every editing mode:
 *
 * - ArrowDown/ArrowUp move the active option and stop at the ends.
 * - Enter accepts the active option.
 * - Tab dismisses without inserting and is not consumed.
 * - Escape dismisses and is consumed.
 *
 * Callers rule out IME composition before asking.
 */
export function completionKeyAction(
  event: ModifierKeys & Pick<KeyboardEvent, 'key'>,
  state: Pick<CompletionState, 'suggestions' | 'activeIndex'>,
): CompletionKeyAction | null {
  const { suggestions, activeIndex } = state;
  if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !hasModifier(event)) {
    const delta = event.key === 'ArrowDown' ? 1 : -1;
    const index = Math.min(Math.max(activeIndex + delta, 0), suggestions.length - 1);
    return { type: 'navigate', index };
  }
  if (event.key === 'Enter' && !hasModifier(event)) {
    const candidate = suggestions[activeIndex];
    return candidate ? { type: 'accept', candidate } : null;
  }
  if (event.key === 'Tab') return { type: 'dismiss', consume: false };
  if (event.key === 'Escape') return { type: 'dismiss', consume: true };
  return null;
}
