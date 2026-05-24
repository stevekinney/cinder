import type { Snippet } from 'svelte';
/** Selection model for a Tree. */
export type TreeSelectionMode = 'none' | 'single' | 'multiple';
/** Selection behavior for multiple-selection trees. */
export type TreeSelectionBehavior = 'independent' | 'cascade';
/** Props for the Tree component. */
export type TreeProps = {
  /** Selection model. Default: 'none'. */
  selectionMode?: TreeSelectionMode;
  /** Render tree-owned checkbox indicators when selectionMode is multiple. Default: false. */
  checkboxSelection?: boolean;
  /** Select only the target item or cascade through its selectable scope. Default: 'independent'. */
  selectionBehavior?: TreeSelectionBehavior;
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
  /** Optional selection controls rendered before the role="tree" element. */
  selectionControls?: Snippet;
  /** Tree items (snippet). */
  children: Snippet;
};
