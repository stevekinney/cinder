import type { EditorView } from 'prosemirror-view';

import { acceptSuggestion } from './template-completion-acceptance.js';
import { completionKeyAction } from './template-completion-keys.js';
import {
  templateCompletionPluginKey,
  type CompletionMeta,
  type CompletionState,
} from './template-completion-state.js';

function dispatchMeta(view: EditorView, meta: CompletionMeta): void {
  view.dispatch(view.state.tr.setMeta(templateCompletionPluginKey, meta));
}

/** Whether the popup is showing rows the keyboard can act on. */
export function isCompletionPopupOpen(view: EditorView): boolean {
  const state = templateCompletionPluginKey.getState(view.state);
  return Boolean(view.editable && state?.active && state.suggestions.length > 0);
}

/**
 * Handle a keydown before any keymap sees it.
 *
 * - ArrowDown/ArrowUp move the active option and stop at the ends.
 * - Enter accepts the active option, never during IME composition.
 * - Tab dismisses without inserting and is not consumed, so the editor's own
 *   Tab binding runs next: it indents a list item or moves between table
 *   cells, and otherwise focus moves.
 * - Escape dismisses and is consumed only while the popup is open, so a
 *   second Escape reaches enclosing handlers.
 *
 * Home, End, Left, Right and text keys are never handled here.
 */
export function handleCompletionKeyDown(
  view: EditorView,
  event: KeyboardEvent,
  holdDismissalForCurrentKey: () => void = () => {},
): boolean {
  if (!isCompletionPopupOpen(view)) return false;
  if (event.isComposing || view.composing) return false;
  const state = templateCompletionPluginKey.getState(view.state);
  if (!state) return false;
  return handleOpenPopupKey(view, event, state, holdDismissalForCurrentKey);
}

function handleOpenPopupKey(
  view: EditorView,
  event: KeyboardEvent,
  state: CompletionState,
  holdDismissalForCurrentKey: () => void,
): boolean {
  const action = completionKeyAction(event, state);
  if (!action) return false;
  if (action.type === 'navigate') {
    if (action.index !== state.activeIndex) {
      dispatchMeta(view, { type: 'navigate', index: action.index });
    }
    event.preventDefault();
    return true;
  }
  if (action.type === 'accept') {
    acceptSuggestion(view, action.candidate, state);
    event.preventDefault();
    return true;
  }
  if (!action.consume) {
    // Dismiss without consuming Tab, so the editor's own Tab binding runs next
    // (it indents a list item or moves between table cells, otherwise focus
    // moves). The dismissal survives any document change that same
    // keypress makes.
    holdDismissalForCurrentKey();
    dispatchMeta(view, { type: 'dismiss' });
    return false;
  }
  dispatchMeta(view, { type: 'dismiss' });
  event.preventDefault();
  event.stopPropagation();
  return true;
}
