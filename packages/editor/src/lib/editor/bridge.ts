/**
 * Bridge between ProseMirror positions and text offsets.
 *
 * This module provides position mapping utilities needed for:
 * - DEP-39: Comment anchoring (map selection to persistable positions)
 * - DEP-43: Suggested edits (map stored positions back to editor)
 *
 * The bridge maintains the invariant that positions can round-trip
 * between ProseMirror and text offset coordinate systems.
 *
 * Key insight: ProseMirror positions include structural characters
 * (node boundaries), while text offsets (from doc.textBetween()) only
 * count text content plus block separators ('\n' between blocks).
 */

import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model';
import type { EditorSelection, SourcePosition } from './types.js';

// ============================================================================
// Text Offset <-> ProseMirror Position Mapping
// ============================================================================

/**
 * Bidirectional map between text offsets and ProseMirror positions.
 */
interface PositionOffsetMap {
  /** Map from text offset to ProseMirror position */
  textToPm: Map<number, number>;
  /** Map from ProseMirror position to text offset */
  pmToText: Map<number, number>;
}

/**
 * WeakMap cache for offset maps, keyed by document instance.
 * Automatically garbage collected when document is no longer referenced.
 */
const offsetMapCache = new WeakMap<ProseMirrorNode, PositionOffsetMap>();

/**
 * Build bidirectional offset map matching doc.textBetween() semantics.
 *
 * textBetween inserts blockSeparator (default '\n') between block nodes.
 * This function mirrors that behavior exactly by walking the document
 * and tracking when we transition between blocks.
 *
 * Key insight: textBetween adds separator BETWEEN consecutive block content,
 * not at every block boundary. We track this by noting when we exit one
 * block's text content and enter another's.
 *
 * @param doc - ProseMirror document node
 * @returns Cached bidirectional position map
 */
export function buildTextToProseMirrorPositionMap(doc: ProseMirrorNode): PositionOffsetMap {
  const cached = offsetMapCache.get(doc);
  if (cached) return cached;

  const textToPm = new Map<number, number>();
  const pmToText = new Map<number, number>();
  let textOffset = 0;
  let hasEmittedContent = false;

  /**
   * Walk document in order, tracking block boundaries.
   *
   * Key insight: doc.textBetween() adds separators between TEXT BLOCKS
   * (paragraph, heading, code_block), not wrapper blocks (list, blockquote,
   * list_item). Using isTextblock instead of isBlock ensures we only add
   * separators where textBetween would.
   */
  function walk(node: ProseMirrorNode, pos: number) {
    // For text blocks (not wrapper blocks), add separator
    // before their content if we've already emitted content
    // isTextblock = true for paragraph, heading, code_block
    // isTextblock = false for bullet_list, list_item, blockquote
    if (node.isTextblock && hasEmittedContent && pos > 0) {
      // This is where textBetween would insert '\n'
      textToPm.set(textOffset, pos);
      pmToText.set(pos, textOffset);
      textOffset += 1;
    }

    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i++) {
        textToPm.set(textOffset + i, pos + i);
        pmToText.set(pos + i, textOffset + i);
      }
      textOffset += node.text.length;
      // Map the exclusive end position (for slice semantics)
      // This ensures textOffsetToProseMirrorPosition works for end-of-quote offsets
      textToPm.set(textOffset, pos + node.text.length);
      pmToText.set(pos + node.text.length, textOffset);
      hasEmittedContent = true;
    } else if (node.isLeaf && !node.isText) {
      // Atom nodes (images, hard breaks, etc.)
      // textBetween uses leafText spec or empty string
      const leafText =
        (node.type.spec.leafText as ((node: ProseMirrorNode) => string) | undefined)?.(node) ?? '';
      if (leafText.length > 0) {
        for (let i = 0; i < leafText.length; i++) {
          textToPm.set(textOffset + i, pos);
          pmToText.set(pos, textOffset + i);
        }
        textOffset += leafText.length;
        // Map the exclusive end position for leaf nodes too
        textToPm.set(textOffset, pos + 1);
        pmToText.set(pos + 1, textOffset);
        hasEmittedContent = true;
      }
    }

    // Recurse into children
    // Each node's content starts 1 position after the node's start
    // But for inline content within textblocks, children don't add extra positions
    if (node.isTextblock) {
      // For textblocks (paragraph, heading, code_block), content starts at pos + 1
      const childPos = pos + 1;
      node.forEach((child, offset) => {
        walk(child, childPos + offset);
      });
    } else if (!node.isLeaf) {
      // For container blocks (doc, list, blockquote, list_item), content starts at pos + 1
      const childPos = pos + 1;
      node.forEach((child, offset) => {
        walk(child, childPos + offset);
      });
    }
  }

  // Start walking from doc's children
  // Doc's content starts at position 0 (doc has no opening token in positions)
  const docChildPos = 0;
  doc.forEach((child, offset) => {
    walk(child, docChildPos + offset);
  });

  const map = { textToPm, pmToText };
  offsetMapCache.set(doc, map);
  return map;
}

/**
 * Convert a text offset (from doc.textBetween()) to a ProseMirror position.
 *
 * @param doc - ProseMirror document node
 * @param offset - Text offset (0-based)
 * @returns ProseMirror position or null if offset not found
 */
export function textOffsetToProseMirrorPosition(
  doc: ProseMirrorNode,
  offset: number,
): number | null {
  const map = buildTextToProseMirrorPositionMap(doc);
  return map.textToPm.get(offset) ?? null;
}

/**
 * Convert a ProseMirror position to a text offset (as from doc.textBetween()).
 *
 * @param doc - ProseMirror document node
 * @param pos - ProseMirror position
 * @returns Text offset or 0 if position not found
 */
export function proseMirrorPositionToTextOffset(doc: ProseMirrorNode, pos: number): number {
  const map = buildTextToProseMirrorPositionMap(doc);
  return map.pmToText.get(pos) ?? 0;
}

/**
 * Compute line and column from a text offset within the document text.
 *
 * Unlike mapPosToSource (which maps to markdown source positions), this function
 * computes line/column within the document's text content (doc.textBetween semantics).
 * This is useful for originalPosition storage where we want coordinates that match
 * the text offset coordinate system.
 *
 * @param doc - ProseMirror document node
 * @param textOffset - Text offset (0-based, from doc.textBetween)
 * @returns SourcePosition with offset, line, and column
 */
export function textOffsetToLineColumn(doc: ProseMirrorNode, textOffset: number): SourcePosition {
  // Extract full document text using textBetween semantics
  const docText = doc.textBetween(0, doc.content.size, '\n');

  // Count lines and columns within the document text
  let line = 1;
  let column = 1;

  const clampedOffset = Math.max(0, Math.min(textOffset, docText.length));

  for (let i = 0; i < clampedOffset; i++) {
    if (docText[i] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
  }

  return {
    offset: clampedOffset,
    line,
    column,
  };
}

// ============================================================================
// Markdown Source Position Mapping (Legacy)
// ============================================================================

/**
 * Map a ProseMirror position to an mdast source position.
 *
 * This enables persisting selection/anchor positions in a format
 * that survives editor remounts and document changes.
 *
 * @param pmPos - ProseMirror document position
 * @param markdown - Current markdown content
 * @returns Source position or null if mapping fails
 *
 * @remarks
 * This direct mapping is used when the current markdown string is the only
 * available source of truth. Use the ProseMirror document helpers above when
 * mapping from an instantiated editor document.
 */
export function mapPosToSource(pmPos: number, markdown: string): SourcePosition | null {
  if (pmPos < 0 || pmPos > markdown.length) {
    return null;
  }

  // Count lines and columns from the markdown string
  let line = 1;
  let column = 1;

  for (let i = 0; i < pmPos && i < markdown.length; i++) {
    if (markdown[i] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
  }

  return {
    line,
    column,
    offset: pmPos,
  };
}

/**
 * Map an mdast source position to a ProseMirror position.
 *
 * This enables jumping to stored positions (comments, suggestions)
 * when the editor loads.
 *
 * @param sourcePos - mdast source position
 * @param markdown - Current markdown content
 * @returns ProseMirror position or null if mapping fails
 *
 * @remarks
 * This direct mapping is used when a stored markdown offset is available. Use
 * the ProseMirror document helpers above when translating through an
 * instantiated editor document.
 */
export function mapSourceToPos(sourcePos: SourcePosition, markdown: string): number | null {
  if (sourcePos.offset !== undefined && sourcePos.offset >= 0) {
    return Math.min(sourcePos.offset, markdown.length);
  }

  // Fall back to line/column calculation
  let offset = 0;
  let currentLine = 1;

  for (let i = 0; i < markdown.length; i++) {
    if (currentLine === sourcePos.line) {
      // Found the line, add column offset
      return Math.min(offset + sourcePos.column - 1, markdown.length);
    }

    if (markdown[i] === '\n') {
      currentLine++;
    }
    offset++;
  }

  // Line not found
  return null;
}

/**
 * Enrich an editor selection with source position information.
 *
 * @param selection - Editor selection state
 * @param markdown - Current markdown content
 * @returns Selection with sourcePosition field populated
 */
export function enrichSelectionWithSource(
  selection: EditorSelection,
  markdown: string,
): EditorSelection {
  return {
    ...selection,
    sourcePosition: mapPosToSource(selection.from, markdown),
  };
}
