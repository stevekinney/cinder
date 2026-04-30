/**
 * Editor anchoring utilities for creating and detecting anchor positions.
 *
 * These utilities are extracted from ReviewEditor to enable reuse across
 * different editor components and features. They work with ProseMirror
 * documents to create TextQuoteSelector-style anchors.
 *
 * @module
 */

import { proseMirrorPositionToTextOffset, textOffsetToLineColumn } from '@cinder/editor';
import type { Node } from '@milkdown/prose/model';
import type { EditorView } from '@milkdown/prose/view';
import type { CommentAnchor } from './comments/types.js';
import { ANCHOR_CONTEXT_LENGTH } from './comments/types.js';

/**
 * Generate a stable block ID from node type and content.
 *
 * Creates a deterministic identifier for a block-level node by combining
 * the node type with a hash of the first 50 characters of its content.
 * This ID survives document edits as long as the block type and initial
 * content remain the same.
 *
 * @param nodeType - The ProseMirror node type name (e.g., 'heading', 'paragraph')
 * @param textContent - The text content of the node
 * @returns A stable block ID in the format `{nodeType}-{hash}`
 *
 * @example
 * ```typescript
 * const blockId = generateBlockId('heading', 'Introduction to Anchoring');
 * // Returns something like 'heading-abc123'
 * ```
 */
export function generateBlockId(nodeType: string, textContent: string): string {
  // Simple hash function for short strings
  const contentPrefix = textContent.slice(0, 50);
  let hash = 0;
  for (let i = 0; i < contentPrefix.length; i++) {
    const character = contentPrefix.charCodeAt(i);
    hash = (hash << 5) - hash + character;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `${nodeType}-${Math.abs(hash).toString(36)}`;
}

/**
 * Detect if a selection spans an entire block node.
 *
 * Checks whether the selection boundaries (from, to) exactly match
 * the content boundaries of a block-level node at depth 1 (direct
 * children of the document root). This is useful for determining
 * if a comment should be anchored to an entire block rather than
 * just the selected text.
 *
 * @param document - The ProseMirror document node
 * @param from - Start position of the selection
 * @param to - End position of the selection
 * @returns The block ID if selection spans entire block, undefined otherwise
 *
 * @example
 * ```typescript
 * const view = editor.getView();
 * const { from, to } = view.state.selection;
 * const blockId = detectBlockLevelAnchor(view.state.doc, from, to);
 *
 * if (blockId) {
 *   // Selection covers an entire block (heading, paragraph, etc.)
 *   console.log('Block-level selection:', blockId);
 * } else {
 *   // Partial text selection within a block
 *   console.log('Text selection');
 * }
 * ```
 */
export function detectBlockLevelAnchor(
  document: Node,
  from: number,
  to: number,
): string | undefined {
  // Resolve positions to find the containing nodes
  const resolvedFrom = document.resolve(from);
  const resolvedTo = document.resolve(to);

  // Check if we're selecting an entire block at depth 1 (direct children of doc)
  // This catches headings, paragraphs, code blocks, etc.
  if (resolvedFrom.depth >= 1 && resolvedTo.depth >= 1) {
    // Find the block-level parent
    const parentDepth = 1;
    const fromParent = resolvedFrom.node(parentDepth);
    const toParent = resolvedTo.node(parentDepth);

    // If selection is within the same block node
    if (fromParent === toParent) {
      // Check if selection covers the entire block's content
      const parentStart = resolvedFrom.start(parentDepth);
      const parentEnd = resolvedFrom.end(parentDepth);

      if (from === parentStart && to === parentEnd) {
        // Selection covers the entire block
        const nodeType = fromParent.type.name;
        const textContent = fromParent.textContent;
        return generateBlockId(nodeType, textContent);
      }
    }
  }

  return undefined;
}

/**
 * Build a CommentAnchor from a ProseMirror selection range.
 *
 * Creates a complete anchor object with all the data needed for both
 * runtime positioning (ProseMirror positions) and persistence
 * (TextQuoteSelector-style quote/prefix/suffix).
 *
 * The anchor includes:
 * - ProseMirror positions (from, to)
 * - Selected text (quote)
 * - Context for re-anchoring (prefix, suffix)
 * - Original position data for disambiguation
 * - Block ID if selection spans entire block
 *
 * @param view - The ProseMirror EditorView
 * @param from - Start position of the selection
 * @param to - End position of the selection
 * @returns A complete CommentAnchor ready for use or persistence
 *
 * @example
 * ```typescript
 * const view = editor.getView();
 * const { from, to } = view.state.selection;
 *
 * if (from !== to) {
 *   const anchor = buildAnchorFromSelection(view, from, to);
 *   // Use anchor for thread creation
 *   onthreadcreate?.({ anchor, body: comment, authorId: userId });
 * }
 * ```
 */
export function buildAnchorFromSelection(
  view: EditorView,
  from: number,
  to: number,
): CommentAnchor {
  const { doc } = view.state;

  // Extract text directly from ProseMirror document
  const selectedText = doc.textBetween(from, to, '\n');

  // Get surrounding context (prefix/suffix) from the document
  const prefixStart = Math.max(0, from - ANCHOR_CONTEXT_LENGTH);
  const suffixEnd = Math.min(doc.content.size, to + ANCHOR_CONTEXT_LENGTH);

  const prefix = doc.textBetween(prefixStart, from, '\n');
  const suffix = doc.textBetween(to, suffixEnd, '\n');

  // Calculate text offset for originalPosition (used for disambiguation)
  const textOffset = proseMirrorPositionToTextOffset(doc, from);

  // Compute line/column from the document text
  const originalPosition = textOffsetToLineColumn(doc, textOffset);

  // Check if this is a block-level selection
  const blockId = detectBlockLevelAnchor(doc, from, to);

  const anchor: CommentAnchor = {
    from,
    to,
    quote: selectedText,
    prefix,
    suffix,
    status: 'anchored',
    originalQuote: selectedText,
    lastKnownOffset: textOffset,
    originalPosition,
  };

  if (blockId !== undefined) {
    anchor.blockId = blockId;
  }

  return anchor;
}
