/**
 * Shared position-conversion utilities for template placeholder plugins.
 *
 * Both the completion plugin and the invalid-decoration plugin need to convert
 * a character offset within a block's `textContent` to an absolute ProseMirror
 * document position. This module provides a single canonical implementation so
 * the two plugins cannot diverge.
 *
 * DEP-583: Extracted from template-completion-plugin and
 * template-invalid-decoration-plugin to eliminate duplicated logic that
 * previously had divergent atom-boundary behaviour.
 */

import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model';

/**
 * Convert a text-coordinate offset within a block's `textContent` to an
 * absolute ProseMirror document position.
 *
 * Walks the block's inline children, counting only text characters (atom
 * nodes such as `hard_break` and images contribute nothing to the text
 * coordinate space, but `childOffset` already accounts for their document
 * size). The function does **not** short-circuit after finding the first
 * matching text node, so later text nodes can overwrite `result` correctly
 * when `textOffset` falls exactly on a boundary between a text node and an
 * atom.
 *
 * @param block - The block-level ProseMirror node (paragraph, heading, etc.).
 * @param blockContentStart - The absolute document position of the first
 *   character inside the block (i.e. `$from.start()` or `blockPosition + 1`).
 * @param textOffset - A character offset into `block.textContent`.
 * @returns The absolute ProseMirror position corresponding to `textOffset`.
 *
 * @internal Exported for testing only.
 */
export function textOffsetToBlockDocumentPosition(
  block: ProseMirrorNode,
  blockContentStart: number,
  textOffset: number,
): number {
  let accumulated = 0;
  let result = blockContentStart;

  block.forEach((child, childOffset) => {
    if (accumulated > textOffset) return;

    if (child.isText && child.text) {
      const localOffset = textOffset - accumulated;
      if (localOffset <= child.text.length) {
        result = blockContentStart + childOffset + localOffset;
      }
      // Always advance accumulated so subsequent text nodes get the correct
      // localOffset. The early-exit pattern (`accumulated = textOffset + 1`)
      // must NOT be used here: when textOffset falls at the exact boundary
      // between a text node and a following atom, the early exit would
      // prevent the next iteration from overwriting `result` with the
      // correct position.
      accumulated += child.text.length;
    } else if (!child.isAtom) {
      // Non-text, non-atom inline nodes (e.g., mark-wrapped spans) contribute
      // their text to `block.textContent`, so we count them here to keep
      // `accumulated` aligned with the text coordinate space. Atom nodes
      // (hard_break, images) are intentionally excluded because they
      // contribute zero text characters; `childOffset` already incorporates
      // their document-position size.
      accumulated += child.textContent.length;
    }
  });

  return result;
}
