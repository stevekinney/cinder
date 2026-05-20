import type { Snippet } from 'svelte';
/** Props for the TreeItem component. */
export type TreeItemProps = {
  /** Stable unique id within the tree. */
  id: string;
  /** Accessible name for the item. Also used as the typeahead key. */
  label: string;
  /** When true, the item cannot be selected or actioned. Still keyboard-reachable. */
  disabled?: boolean;
  /**
   * Required to make a node behave as a branch. Without `branch` or `loadChildren`,
   * the node is a leaf regardless of any `children` snippet. The children snippet's
   * presence is NOT sufficient — see tree.svelte plan for rationale.
   */
  branch?: boolean;
  /**
   * Async loader called the first time the item is expanded. Implies `branch=true`.
   * The loader mutates consumer-owned reactive state; it returns no data.
   * Errors are forwarded to `onLoadError` if provided, otherwise logged via
   * `console.error` with a `[cinder-tree]` prefix.
   */
  loadChildren?: (context: { id: string; signal: AbortSignal }) => void | Promise<void>;
  /** Called when `loadChildren` rejects with a non-abort error. */
  onLoadError?: (error: unknown, itemId: string) => void;
  /** Optional row content snippet override. Default renders `label`. */
  row?: Snippet<[{ expanded: boolean; selected: boolean; busy: boolean; level: number }]>;
  /** Nested TreeItem children for branch nodes. */
  children?: Snippet;
  /** Additional CSS class merged with `.cinder-tree-item`. */
  class?: string;
};
