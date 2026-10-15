/**
 * The ProseMirror-bound half of template completion: the plugin key and the
 * transaction-driven state step.
 *
 * These live apart from `template-completion-state.ts` so that the pure
 * completion model, which source mode also runs, can be imported without
 * evaluating ProseMirror (COR-1322).
 */

import { parsePlaceholderTokens } from '@lostgradient/markdown';
import type { EditorState, Transaction } from 'prosemirror-state';
import { PluginKey } from 'prosemirror-state';

import { locateTokenQuery, type DetectedTokenQuery } from './template-completion-query.js';
import {
  advanceCompletionState,
  isCompletionMeta,
  type CompletionState,
} from './template-completion-state.js';
import type { PlaceholderCompletionSource } from './template-placeholder-configuration.js';
import { findRunBeforeCaret } from './template-placeholder-runs.js';

/**
 * Find the placeholder token being typed at the caret.
 *
 * The token must lie in one eligible same-mark run (see
 * `template-placeholder-runs.ts`) and the selection must be collapsed; the
 * range follows {@link locateTokenQuery}.
 */
export function detectTokenQuery(state: EditorState): DetectedTokenQuery | null {
  const found = findRunBeforeCaret(state);
  if (!found) return null;
  const { run, offset } = found;
  const located = locateTokenQuery(run.text, offset, parsePlaceholderTokens(run.text));
  if (!located) return null;
  return {
    query: located.query,
    tokenFrom: run.from + located.from,
    tokenTo: run.from + located.to,
    cursorPos: state.selection.from,
    marks: run.marks,
  };
}

export const templateCompletionPluginKey = new PluginKey<CompletionState>('template-completion');

/**
 * Compute the next completion state for a ProseMirror transaction; see
 * {@link advanceCompletionState}.
 */
export function computeCompletionState(
  previousState: CompletionState,
  transaction: Transaction,
  editorState: EditorState,
  configuration: PlaceholderCompletionSource | undefined,
  configurationChanged = false,
  keepDismissal = false,
): CompletionState {
  const rawMeta: unknown = transaction.getMeta(templateCompletionPluginKey);
  return advanceCompletionState(previousState, configuration, {
    meta: isCompletionMeta(rawMeta) ? rawMeta : undefined,
    documentChanged: transaction.docChanged,
    configurationChanged,
    keepDismissal,
    detect: () => detectTokenQuery(editorState),
  });
}
