/**
 * ProseMirror plugin for decorating invalid `{{…}}` template placeholder tokens.
 *
 * Scans each eligible same-mark text run (see `template-placeholder-runs.ts`),
 * validates its tokens against the active configuration's candidates, and
 * decorates each invalid token with a CSS class and a
 * `data-placeholder-validation-reason` attribute naming the diagnostic code:
 * `malformed_token`, `invalid_path_format`, `blocked_path` or
 * `unknown_placeholder`.
 *
 * DEP-583: WYSIWYG invalid-token decoration for saved-prompt template authoring.
 */

import type { PlaceholderCandidate } from '@lostgradient/markdown';
import { parsePlaceholderTokens, validatePlaceholderTokens } from '@lostgradient/markdown';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

import { createLazyProsePlugin, type LazyProsePlugin } from './milkdown-plugin-runtime.js';
import {
  placeholderConfigurationChange,
  readPlaceholderConfiguration,
} from './template-placeholder-configuration-plugin.js';
import type {
  PlaceholderDecorationSource,
  ResolvedPlaceholderConfiguration,
} from './template-placeholder-configuration.js';
import { forEachPlaceholderRun } from './template-placeholder-runs.js';

/** Plugin key for the template invalid decoration plugin. */
export const templateInvalidDecorationPluginKey = new PluginKey<DecorationPluginState>(
  'template-invalid-decoration',
);

/**
 * Build decorations for every invalid `{{…}}` token in the document.
 *
 * Tokens are parsed per eligible run, so a token never spans a node or mark
 * boundary, and code blocks and inline code are never scanned.
 *
 * @internal Exported for testing only.
 */
export function buildInvalidTokenDecorations(
  document: ProseMirrorNode,
  candidates: readonly PlaceholderCandidate[],
  invalidClassName: string,
): Decoration[] {
  const decorations: Decoration[] = [];
  forEachPlaceholderRun(document, (run) => {
    const tokens = parsePlaceholderTokens(run.text);
    if (tokens.length === 0) return;
    for (const issue of validatePlaceholderTokens(tokens, candidates)) {
      const { location } = issue;
      if (location.kind !== 'token') continue;
      decorations.push(
        Decoration.inline(run.from + location.startOffset, run.from + location.endOffset, {
          class: invalidClassName,
          'data-placeholder-validation-reason': issue.code,
        }),
      );
    }
  });
  return decorations;
}

/** State kept by the decoration plugin. */
interface DecorationPluginState {
  decorations: DecorationSet;
  source: PlaceholderDecorationSource | undefined;
}

function buildState(
  document: ProseMirrorNode,
  source: PlaceholderDecorationSource | undefined,
): DecorationPluginState {
  if (!source) return { decorations: DecorationSet.empty, source };
  const specs = buildInvalidTokenDecorations(document, source.candidates, source.invalidClassName);
  return {
    decorations: specs.length === 0 ? DecorationSet.empty : DecorationSet.create(document, specs),
    source,
  };
}

/**
 * Create the plugin that decorates invalid tokens.
 *
 * It follows the placeholder configuration plugin: with no decoration
 * configured it scans nothing, and a configuration replacement rebuilds the
 * decorations without touching the document. Other transactions rebuild only
 * when the document changes and otherwise map the existing decorations.
 *
 * @param initial - The configuration installed when the editor is created.
 */
export function createTemplateInvalidDecorationPlugin(
  initial: ResolvedPlaceholderConfiguration,
): LazyProsePlugin {
  return createLazyProsePlugin(
    () =>
      new Plugin<DecorationPluginState>({
        key: templateInvalidDecorationPluginKey,
        state: {
          init: (_config, editorState) => buildState(editorState.doc, initial.decoration),
          apply(transaction, pluginState, oldEditorState, newEditorState) {
            const change = placeholderConfigurationChange(transaction);
            const source = (change ?? readPlaceholderConfiguration(oldEditorState)).decoration;
            if (transaction.docChanged || source !== pluginState.source) {
              return buildState(newEditorState.doc, source);
            }
            return {
              decorations: pluginState.decorations.map(transaction.mapping, newEditorState.doc),
              source,
            };
          },
        },
        props: {
          decorations(state) {
            return templateInvalidDecorationPluginKey.getState(state)?.decorations ?? null;
          },
        },
      }),
  );
}
