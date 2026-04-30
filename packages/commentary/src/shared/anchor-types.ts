/**
 * Shared anchor types for the editor module.
 *
 * These types are extracted to break the circular dependency between
 * comments/types.ts and session/types.ts.
 *
 * @module
 */

// ============================================================================
// Anchor Type Discriminators
// ============================================================================

/**
 * Anchor type discriminator.
 *
 * - 'text': Anchored to specific text selection (default for backwards compatibility)
 * - 'document': Document-level comment with no specific text anchor
 */
export type AnchorType = 'text' | 'document';

/**
 * Anchor status indicates whether the anchor is successfully placed.
 *
 * - 'anchored': Anchor is confidently placed at the correct location
 *
 * Note: When anchor text is deleted (anchor cannot be placed), the thread is
 * automatically deleted. There is no 'orphaned' state - threads either have
 * valid anchors or they don't exist.
 */
export type AnchorStatus = 'anchored';

// ============================================================================
// TextQuoteSelector Anchor
// ============================================================================

/**
 * TextQuoteSelector-style anchor for comment persistence.
 *
 * This format survives document edits by storing context around the selection.
 * Re-anchoring algorithm:
 * 1. Try exact position first
 * 2. Search for quote with prefix/suffix context
 * 3. Mark as orphaned if not found
 *
 * Based on W3C Web Annotation Data Model TextQuoteSelector.
 * @see https://www.w3.org/TR/annotation-model/#text-quote-selector
 */
export interface TextQuoteAnchor {
  /** The exact text that was selected */
  quote: string;

  /** ~50 characters before the selection for context matching */
  prefix: string;

  /** ~50 characters after the selection for context matching */
  suffix: string;
}

// ============================================================================
// Runtime Anchor
// ============================================================================

/**
 * Runtime anchor with ProseMirror positions.
 *
 * These positions are computed at runtime and updated through
 * ProseMirror's transaction mapping (tr.mapping.map()).
 */
export interface RuntimeAnchor {
  /** Start position in ProseMirror document */
  from: number;

  /** End position in ProseMirror document */
  to: number;
}

// ============================================================================
// Complete Anchor Types
// ============================================================================

/**
 * Complete comment anchor combining persistence and runtime data.
 *
 * For document-level comments (type='document'), the quote/prefix/suffix
 * will be empty strings and from/to will be 0.
 */
export interface CommentAnchor extends TextQuoteAnchor, RuntimeAnchor {
  /**
   * Anchor type: 'text' (default) or 'document'.
   * When undefined, treated as 'text' for backwards compatibility.
   */
  type?: AnchorType | undefined;

  /** Current anchor status */
  status: AnchorStatus;

  /**
   * Original quote text when the anchor was created.
   * Preserved for history/debugging - never updated when edits occur inside the anchor.
   */
  originalQuote?: string | undefined;

  /**
   * Last known text offset (not ProseMirror position).
   * Updated on each edit, used for re-anchoring disambiguation.
   * Prevents bias toward the original position when the anchor has moved.
   */
  lastKnownOffset?: number | undefined;

  /** Optional block-level anchor (for comments on headings, code blocks, etc.) */
  blockId?: string | undefined;

  /**
   * Original position when anchor was created.
   * Stored as text offset (via proseMirrorPositionToTextOffset), not PM position.
   * Used as fallback for disambiguation when lastKnownOffset is not available.
   */
  originalPosition?:
    | {
        /** Text offset (matching doc.textBetween() semantics) */
        offset: number;
        /** Line number (1-based) */
        line: number;
        /** Column number (1-based) */
        column: number;
      }
    | undefined;
}

/**
 * Anchor data for persistence (excludes runtime positions).
 * Used when serializing review state to storage.
 */
export interface PersistedAnchor extends TextQuoteAnchor {
  /**
   * Anchor type: 'text' (default) or 'document'.
   * When undefined, treated as 'text' for backwards compatibility.
   */
  type?: AnchorType | undefined;

  status: AnchorStatus;

  /** Original quote text (optional for backwards compatibility) */
  originalQuote?: string | undefined;

  /** Last known text offset for re-anchoring disambiguation */
  lastKnownOffset?: number | undefined;

  blockId?: string | undefined;
  originalPosition?: CommentAnchor['originalPosition'] | undefined;
}
