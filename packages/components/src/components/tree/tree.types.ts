import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { FlattenedTreeDataItem, TreeDataItem } from '../../_internal/tree-data.ts';
import type { TreeReorderTarget } from '../../_internal/tree-drag-controller.svelte.ts';
/** Selection model for a Tree. */
export type TreeSelectionMode = 'none' | 'single' | 'multiple';
/** Selection behavior for multiple-selection trees. */
export type TreeSelectionBehavior = 'independent' | 'cascade';
/** Predicate used by Tree filtering to decide whether an item matches the query. */
export type TreeFilterPredicate = (label: string, id: string, query: string) => boolean;
/** Programmatic Tree handle exposed through `bind:ref`. */
export type TreeRef = {
  /** Expand every currently discoverable static branch. */
  expandAll: () => Promise<void>;
  /** Collapse every expanded branch with a single expandedIds update. */
  collapseAll: () => void;
  /** Expand only the currently visible static branch level. */
  expandOneLevel: () => void;
  /** Focus a visible registered item by id. Unknown or hidden ids are ignored. */
  focusItem: (id: string) => void;
  /** Expand registered ancestors for an item, then focus it if it is visible. */
  expandToItem: (id: string) => Promise<void>;
  /** Scroll a registered row into view. Unknown ids are ignored. */
  scrollToRow: (id: string, options?: ScrollIntoViewOptions) => void;
};
/** Data passed to a virtualized Tree row snippet. */
export type TreeVirtualizedItemRenderState = {
  item: FlattenedTreeDataItem;
  expanded: boolean;
  selected: boolean;
  focused: boolean;
};
type TreeSharedProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  | 'children'
  | 'class'
  | 'role'
  | 'tabindex'
  | 'aria-label'
  | 'aria-labelledby'
  | 'aria-multiselectable'
> & {
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
  /** Typed programmatic handle. Use `bind:ref` to receive it. */
  ref?: TreeRef | undefined;
  /** Estimated row height for virtualized Tree rows. Default: 36. */
  virtualizationEstimatedRowHeight?: number;
  /** Extra rows rendered before and after the viewport. Default: 4. */
  virtualizationOverscan?: number;
  /** Block size for the virtualized scroll viewport. Default: '20rem'. */
  virtualizationHeight?: number | string;
  /** Optional custom virtualized row renderer. */
  virtualizedItem?: Snippet<[TreeVirtualizedItemRenderState]>;
  /** Accessible label for the tree. One of aria-label or aria-labelledby is required. */
  'aria-label'?: string;
  /** The `id` of a visible element whose text serves as the accessible label for the tree. One of `aria-label` or `aria-labelledby` is required. */
  'aria-labelledby'?: string;
  /** Disable typeahead. Default: false. */
  disableTypeahead?: boolean;
  /** Controlled filter query. When provided, matching is driven by this value. */
  filterValue?: string;
  /** Fires whenever the built-in search input changes the filter query. */
  onFilterChange?: (value: string) => void;
  /** Placeholder and accessible label for the built-in search input. Default: 'Search tree'. */
  filterPlaceholder?: string;
  /** Render the built-in search input before the role="tree" element. Default: false. */
  showSearch?: boolean;
  /** Custom filter predicate. Default: case-insensitive label substring matching. */
  filterPredicate?: TreeFilterPredicate;
  /** Called when a draggable item is dropped before, after, or into another tree item. */
  onReorder?: (draggedId: string, target: TreeReorderTarget) => void;
  /** Additional CSS class merged with `.cinder-tree`. */
  class?: string;
  /** Optional selection controls rendered before the role="tree" element. */
  selectionControls?: Snippet;
};

type TreeSnippetProps = {
  /** Tree items (snippet). Required when virtualized is false or omitted; mutually exclusive with items. */
  children: Snippet;
  /** Use the data-driven virtualized render path for large trees. Default: false. */
  virtualized?: false | undefined;
  /** Data-driven Tree items. Required when virtualized is true; mutually exclusive with children. */
  items?: never;
};

type TreeVirtualizedProps = {
  /** Use the data-driven virtualized render path for large trees. */
  virtualized: true;
  /** Data-driven Tree items. Required when virtualized is true; mutually exclusive with children. */
  items: readonly TreeDataItem[];
  /** Virtualized trees render from `items` rather than snippet children. */
  children?: never;
};

/** Props for the Tree component. */
export type TreeProps = TreeSharedProps & (TreeSnippetProps | TreeVirtualizedProps);
