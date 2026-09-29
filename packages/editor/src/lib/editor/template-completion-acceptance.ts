import type { PlaceholderCandidate } from '@lostgradient/markdown';
import { closeHistory } from '@milkdown/kit/prose/history';
import { TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

import {
  templateCompletionPluginKey,
  type CompletionMeta,
  type CompletionState,
} from './template-completion-state.js';

/**
 * Replace the whole in-progress token with one canonical `{{path}}`.
 *
 * The replacement covers the opening delimiter, any text after the caret
 * that belongs to the token and an existing closing delimiter. It keeps the
 * token run's marks, so the inserted token stays one same-mark run, places
 * the caret after it and forms its own undo step: history is closed before
 * the replacement and again after it, so neither earlier typing nor the next
 * edit joins the acceptance.
 */
export function acceptSuggestion(
  view: EditorView,
  suggestion: PlaceholderCandidate,
  completion: Pick<CompletionState, 'tokenFrom' | 'tokenTo' | 'marks'>,
): void {
  const replacementText = `{{${suggestion.path}}}`;
  const { state } = view;
  const { tokenFrom, tokenTo, marks } = completion;
  const transaction = closeHistory(state.tr)
    .replaceWith(tokenFrom, tokenTo, state.schema.text(replacementText, marks))
    .setMeta(templateCompletionPluginKey, { type: 'close' } satisfies CompletionMeta);
  transaction.setSelection(
    TextSelection.create(transaction.doc, tokenFrom + replacementText.length),
  );
  view.dispatch(transaction.scrollIntoView());
  view.dispatch(closeHistory(view.state.tr));
}
