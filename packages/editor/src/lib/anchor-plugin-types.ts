/**
 * Shared types and runtime metadata guards for the editor anchor plugin.
 *
 * @module
 */

import type { AnchorUpdate, Thread } from './comments/types.js';
import type { AnchorStatus } from './shared/anchor-types.js';

// ============================================================================
// Plugin State Types
// ============================================================================

/**
 * State for a single anchor tracked by the plugin.
 */
export interface AnchorState {
  /** Thread ID this anchor belongs to */
  threadId: string;
  /** ProseMirror start position */
  from: number;
  /** ProseMirror end position */
  to: number;
  /** Current quote text at this position */
  quote: string;
  /** Original quote text (never updated) */
  originalQuote: string;
  /** Context before the quote */
  prefix: string;
  /** Context after the quote */
  suffix: string;
  /** Original position from creation */
  originalPosition?: { offset: number; line: number; column: number } | undefined;
  /** Last known text offset (updated on each edit) */
  lastKnownOffset?: number | undefined;
  /**
   * Whether the quote is currently in the document.
   *
   * `orphaned` anchors are tracked but render nothing, and are retried on every
   * later re-anchoring pass so restoring the text restores the anchor.
   */
  status: AnchorStatus;
}

/**
 * Plugin state containing all tracked anchors.
 */
export interface AnchorPluginState {
  /** Map of thread ID to anchor state */
  anchors: Map<string, AnchorState>;
  /** Flag indicating deferred re-anchoring is needed */
  needsReanchor: boolean;
  /** Thread ID currently focused in the UI */
  activeThreadId: string | null;
  /** Thread ID currently hovered in the UI */
  hoveredThreadId: string | null;
}

/**
 * Options for creating the anchor plugin.
 */
export interface AnchorPluginOptions {
  /** Called when anchor positions change */
  onAnchorsUpdate?: (updates: AnchorUpdate[]) => void;
  /**
   * @deprecated Never called. An anchor whose quote leaves the document is
   * marked `orphaned` and reported through `onAnchorsUpdate` with
   * `status: 'orphaned'` instead of being deleted, because deletion and
   * cut-and-paste are indistinguishable within the re-anchoring window
   * (cinder#1284). Removing a thread is the consumer's decision.
   */
  onAnchorDeleted?: (threadId: string) => void;
  /** Called when user clicks on an anchor decoration */
  onAnchorClick?: (threadId: string, event: MouseEvent) => void;
}

/**
 * Meta-transaction types for plugin communication.
 *
 * Note: confirm/reject are handled by ReviewEditor mutating threads + sync,
 * so we only need sync, add, and remove here.
 */
export type AnchorPluginMeta =
  | { type: 'sync'; threads: Thread[]; source: 'external' }
  | { type: 'add'; thread: Thread }
  | { type: 'remove'; threadId: string }
  | { type: 'set-active'; threadId: string | null }
  | { type: 'set-hover'; threadId: string | null };

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isAnchorPluginMeta(value: unknown): value is AnchorPluginMeta {
  if (!isObjectRecord(value)) return false;

  switch (value['type']) {
    case 'sync':
      return Array.isArray(value['threads']) && value['source'] === 'external';
    case 'add':
      return isObjectRecord(value['thread']);
    case 'remove':
      return typeof value['threadId'] === 'string';
    case 'set-active':
    case 'set-hover':
      return typeof value['threadId'] === 'string' || value['threadId'] === null;
    default:
      return false;
  }
}
