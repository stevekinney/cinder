import type { Snippet } from 'svelte';
/** Selection model for a Tree. */
export type TreeSelectionMode = 'none' | 'single' | 'multiple';
/** Props for the Tree component. */
export type TreeProps = {
  /** Selection model. Default: 'none'. */
  selectionMode?: TreeSelectionMode;
  /** Currently selected node ids. Bindable. */
  selectedIds?: string[];
  /** Currently expanded branch ids. Bindable. */
  expandedIds?: string[];
  /** Accessible label for the tree. One of aria-label or aria-labelledby is required. */
  'aria-label'?: string;
  'aria-labelledby'?: string;
  /** Disable typeahead. Default: false. */
  disableTypeahead?: boolean;
  /** Additional CSS class merged with `.cinder-tree`. */
  class?: string;
  /** Tree items (snippet). */
  children: Snippet;
};
