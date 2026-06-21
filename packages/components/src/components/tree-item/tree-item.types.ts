import type { Snippet } from 'svelte';
import type { TreeItemSelectionState } from '../../_internal/tree-context.ts';

export type TreeItemRowContext = {
  expanded: boolean;
  selected: boolean;
  busy: boolean;
  level: number;
  checkboxSelection: boolean;
  selectionState: TreeItemSelectionState;
  editing: boolean;
  beginEdit: () => void;
  toggleSelection: () => void;
};

/** Props for the TreeItem component. */
export type TreeItemProps = {
  /** Stable unique id within the tree. */
  id: string;
  /** Accessible name for the item. Also used as the typeahead key. */
  label: string;
  /** When true, the item cannot be selected or actioned. Still keyboard-reachable. */
  disabled?: boolean;
  /** Render a reorder handle when the parent Tree provides onreorder. */
  draggable?: boolean;
  /**
   * Marks the node as an expandable branch. A node is a leaf unless it sets `branch`
   * or `loadChildren`; supplying a `children` snippet alone is not enough. Marking the
   * node as a branch lets the tree render the correct expand affordance and
   * `aria-expanded` state before any children exist (for example, before an async
   * `loadChildren` resolves).
   */
  branch?: boolean;
  /**
   * Async loader called the first time the item is expanded. Implies `branch=true`.
   * The loader mutates consumer-owned reactive state; it returns no data.
   * Errors are forwarded to `onloaderror` if provided, otherwise logged via
   * `console.error` with a `[cinder-tree]` prefix.
   */
  loadChildren?: (context: { id: string; signal: AbortSignal }) => void | Promise<void>;
  /** Called when `loadChildren` rejects with a non-abort error. */
  onloaderror?: (error: unknown, itemId: string) => void;
  /** Called when inline label editing commits a new label. */
  onrename?: (itemId: string, nextLabel: string) => void | Promise<void>;
  /** Explicit selectable ids controlled by this item in cascade checkbox-selection mode. */
  selectionScopeIds?: string[];
  /** Optional row content snippet override. Default renders `label`. */
  row?: Snippet<[TreeItemRowContext]>;
  /** Nested TreeItem children for branch nodes. */
  children?: Snippet;
  /** Additional CSS class merged with `.cinder-tree-item`. */
  class?: string;
};
