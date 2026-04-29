/**
 * Placeholder plugin for Milkdown.
 *
 * Adds the `is-editor-empty` class to the first paragraph when the editor
 * is empty, enabling CSS placeholder styling via ::before pseudo-element.
 */

import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';

const placeholderPluginKey = new PluginKey('placeholder');

/**
 * Check if the document is considered "empty" for placeholder purposes.
 * Empty means: single paragraph with no text content, or completely empty.
 */
function isDocumentEmpty(doc: import('@milkdown/kit/prose/model').Node): boolean {
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
export const placeholderPlugin = $prose(() => {
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
