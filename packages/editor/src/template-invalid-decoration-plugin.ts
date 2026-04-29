/**
 * ProseMirror plugin for decorating invalid `{{…}}` template placeholder tokens.
 *
 * Scans the document on every change, parses `{{…}}` tokens from each text block,
 * validates them against the current candidate set, and applies inline decorations
 * to invalid tokens with a CSS class and a `data-placeholder-validation-reason`
 * attribute describing the failure.
 *
 * DEP-583: WYSIWYG invalid-token decoration for saved-prompt template authoring.
 */

import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

import { createLazyProsePlugin } from './milkdown-plugin-runtime.js';
import { parsePlaceholderTokens, validatePlaceholderTokens } from './template-placeholders.js';
import { textOffsetToBlockDocumentPosition } from './template-position-utilities.js';
import type { PlaceholderCandidate } from './types.js';

/** Plugin key for the template invalid decoration plugin. */
export const templateInvalidDecorationPluginKey = new PluginKey('template-invalid-decoration');

/**
 * Convert a text offset within a block node to a ProseMirror document position.
 *
 * Thin adapter over the shared `textOffsetToBlockDocumentPosition` utility.
 * The parameter name `blockPosition` refers to the absolute document position
 * of the block node itself (the value yielded by `document.descendants`).
 * Internally it is converted to `blockContentStart = blockPosition + 1` before
 * delegating to the shared walker.
 *
 * @internal Exported for testing only.
 *
 * @param block - The block-level ProseMirror node (paragraph, heading, etc.).
 * @param blockPosition - The absolute document position of the block node itself.
 * @param textOffset - A character offset into `block.textContent`.
 * @returns The absolute ProseMirror position corresponding to `textOffset`.
 */
export function textOffsetToDocumentPosition(
  block: ProseMirrorNode,
  blockPosition: number,
  textOffset: number,
): number {
  // blockPosition is the node's own position (before its opening tag).
  // blockContentStart = blockPosition + 1 is the position of the first
  // character inside the block.
  return textOffsetToBlockDocumentPosition(block, blockPosition + 1, textOffset);
}

/**
 * Build decorations for all invalid `{{…}}` tokens in the document.
 *
 * Walks every block-level node, extracts its text content, parses placeholder
 * tokens, validates them against the candidate set, and creates inline
 * decorations for each invalid token.
 *
 * @internal Exported for testing only.
 *
 * @param document - The ProseMirror document node.
 * @param candidates - Known placeholder candidates for validation.
 * @param invalidClassName - CSS class applied to invalid token decorations.
 * @returns An array of ProseMirror inline decorations.
 */
export function buildInvalidTokenDecorations(
  document: ProseMirrorNode,
  candidates: PlaceholderCandidate[],
  invalidClassName: string,
): Decoration[] {
  const decorations: Decoration[] = [];

  document.descendants((node, position) => {
    // Only process block-level nodes that contain inline content.
    if (!node.isBlock || node.isAtom || !node.inlineContent) return;

    const textContent = node.textContent;
    if (!textContent) return;

    const tokens = parsePlaceholderTokens(textContent);
    if (tokens.length === 0) return;

    const { issues } = validatePlaceholderTokens(tokens, candidates);

    for (const issue of issues) {
      const from = textOffsetToDocumentPosition(node, position, issue.token.startOffset);
      const to = textOffsetToDocumentPosition(node, position, issue.token.endOffset);

      decorations.push(
        Decoration.inline(from, to, {
          class: invalidClassName,
          'data-placeholder-validation-reason': issue.reason,
        }),
      );
    }

    // Do not descend into children — we already processed the full text content
    // of this block via textContent.
    return false;
  });

  return decorations;
}

/**
 * Internal state stored by `createTemplateInvalidDecorationPlugin` in its
 * ProseMirror plugin state field.
 */
interface DecorationPluginState {
  /** The current decoration set, mapped or rebuilt each transaction. */
  decorations: DecorationSet;
  /** JSON.stringify of the last candidate set used to build decorations. */
  candidatesKey: string;
  /** The CSS class used to build the current decorations. */
  invalidClassName: string;
}

/**
 * Create a Milkdown plugin that decorates invalid `{{…}}` template tokens.
 *
 * Caches the `DecorationSet` in plugin state and rebuilds it only when the
 * document changes or when the candidate set/class name changes. For unchanged
 * transactions the existing set is mapped through `tr.mapping` so ProseMirror
 * can update decoration positions without a full document scan.
 *
 * The factory accepts accessor functions so the candidate set and class name
 * can change at runtime without recreating the plugin.
 *
 * @param getCandidates - Returns the current set of placeholder candidates.
 * @param getInvalidClassName - Returns the CSS class for invalid tokens.
 *   Defaults to returning `'template-placeholder-invalid'`.
 * @returns A Milkdown-compatible plugin created via `$prose`.
 *
 * @example
 * ```typescript
 * const plugin = createTemplateInvalidDecorationPlugin(
 *   () => candidates,
 *   () => 'my-invalid-class',
 * );
 * ```
 */
export function createTemplateInvalidDecorationPlugin(
  getCandidates: () => PlaceholderCandidate[],
  getInvalidClassName?: () => string,
) {
  const resolveInvalidClassName = () => getInvalidClassName?.() ?? 'template-placeholder-invalid';

  return createLazyProsePlugin(() => {
    return new Plugin<DecorationPluginState>({
      key: templateInvalidDecorationPluginKey,

      state: {
        init(_config, editorState) {
          const candidates = getCandidates();
          const invalidClassName = resolveInvalidClassName();
          const candidatesKey = JSON.stringify(candidates);
          const decorationSpecs = buildInvalidTokenDecorations(
            editorState.doc,
            candidates,
            invalidClassName,
          );

          const decorations =
            decorationSpecs.length === 0
              ? DecorationSet.empty
              : DecorationSet.create(editorState.doc, decorationSpecs);

          return { decorations, candidatesKey, invalidClassName };
        },

        apply(transaction, pluginState, _oldEditorState, newEditorState) {
          const nextCandidates = getCandidates();
          const nextInvalidClassName = resolveInvalidClassName();
          const nextCandidatesKey = JSON.stringify(nextCandidates);

          const shouldRebuild =
            transaction.docChanged ||
            nextCandidatesKey !== pluginState.candidatesKey ||
            nextInvalidClassName !== pluginState.invalidClassName;

          if (shouldRebuild) {
            const decorationSpecs = buildInvalidTokenDecorations(
              newEditorState.doc,
              nextCandidates,
              nextInvalidClassName,
            );

            const decorations =
              decorationSpecs.length === 0
                ? DecorationSet.empty
                : DecorationSet.create(newEditorState.doc, decorationSpecs);

            return {
              decorations,
              candidatesKey: nextCandidatesKey,
              invalidClassName: nextInvalidClassName,
            };
          }

          // Map existing decorations through the transaction's position mapping
          // to keep them aligned when text is inserted/deleted elsewhere.
          return {
            decorations: pluginState.decorations.map(transaction.mapping, newEditorState.doc),
            candidatesKey: pluginState.candidatesKey,
            invalidClassName: pluginState.invalidClassName,
          };
        },
      },

      props: {
        decorations(state) {
          return templateInvalidDecorationPluginKey.getState(state)?.decorations ?? null;
        },
      },
    });
  });
}
