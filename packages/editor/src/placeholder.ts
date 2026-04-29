/**
 * Placeholder plugin for Milkdown.
 *
 * Adds the `is-editor-empty` class to the first paragraph when the editor
 * is empty, enabling CSS placeholder styling via ::before pseudo-element.
 */

import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

import { createLazyProsePlugin } from './milkdown-plugin-runtime.js';

const placeholderPluginKey = new PluginKey('placeholder');

/**
 * Check if the document is considered "empty" for placeholder purposes.
 * Empty means: single paragraph with no text content, or completely empty.
 */
function isDocumentEmpty(doc: ProseMirrorNode): boolean {
  // Document must have exactly one child
  if (doc.childCount !== 1) return false;

  const firstChild = doc.firstChild;
  if (!firstChild) return true;

  // First child must be a paragraph
  if (firstChild.type.name !== 'paragraph') return false;

  // Paragraph must be empty or contain only whitespace
  return firstChild.textContent.trim().length === 0;
}

/**
 * Create a Milkdown plugin that adds placeholder support.
 *
 * When the editor is empty (single empty paragraph), this adds the
 * `is-editor-empty` class to the first paragraph, allowing CSS to
 * display a placeholder via `::before` pseudo-element.
 */
export const placeholderPlugin = createLazyProsePlugin(() => {
  return new Plugin({
    key: placeholderPluginKey,
    props: {
      decorations(state) {
        const { doc } = state;

        if (!isDocumentEmpty(doc)) {
          return DecorationSet.empty;
        }

        const firstChild = doc.firstChild;
        if (!firstChild) {
          return DecorationSet.empty;
        }

        // Add the is-editor-empty class to the first paragraph
        const decoration = Decoration.node(0, firstChild.nodeSize, {
          class: 'is-editor-empty',
        });

        return DecorationSet.create(doc, [decoration]);
      },
    },
  });
});
