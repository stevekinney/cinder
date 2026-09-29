/** Milkdown plugin for inline autocomplete of `{{…}}` template tokens. */

import { Plugin } from 'prosemirror-state';

import { createLazyProsePlugin, type LazyProsePlugin } from './milkdown-plugin-runtime.js';
import { handleCompletionKeyDown } from './template-completion-keyboard.js';
import {
  computeCompletionState,
  INACTIVE_STATE,
  templateCompletionPluginKey,
  type CompletionState,
} from './template-completion-state.js';
import {
  createCompletionView,
  type TemplateCompletionViewOptions,
} from './template-completion-view.js';
import {
  placeholderConfigurationChange,
  readPlaceholderConfiguration,
} from './template-placeholder-configuration-plugin.js';

export type TemplateCompletionPluginOptions = TemplateCompletionViewOptions;

/**
 * Create the completion plugin. It reads the active configuration from the
 * placeholder configuration plugin, so it does nothing until completion is
 * configured and follows every configuration replacement.
 */
export function createTemplateCompletionPlugin(
  options: TemplateCompletionPluginOptions = {},
): LazyProsePlugin {
  // Set while a dismissing key is still being handled, so the document change
  // that same key makes (Tab indenting a list item) does not reopen completion.
  // Keymaps run synchronously inside the keydown dispatch, before the microtask.
  let holdingDismissal = false;
  const holdDismissalForCurrentKey = () => {
    holdingDismissal = true;
    queueMicrotask(() => {
      holdingDismissal = false;
    });
  };
  return createLazyProsePlugin(
    () =>
      new Plugin<CompletionState>({
        key: templateCompletionPluginKey,
        state: {
          init: () => INACTIVE_STATE,
          apply(transaction, previousState, oldEditorState, newEditorState) {
            const change = placeholderConfigurationChange(transaction);
            const configuration = change ?? readPlaceholderConfiguration(oldEditorState);
            return computeCompletionState(
              previousState,
              transaction,
              newEditorState,
              configuration.completion,
              change !== undefined,
              holdingDismissal,
            );
          },
        },
        // A DOM keydown handler runs before every keymap's handleKeyDown, so an
        // open popup gets Escape and the arrow keys first.
        props: {
          handleDOMEvents: {
            keydown: (view, event) =>
              handleCompletionKeyDown(view, event, holdDismissalForCurrentKey),
          },
        },
        view: (editorView) => createCompletionView(editorView, options),
      }),
  );
}
