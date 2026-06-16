import TreeExpandAll from '../_tree-expand-all/tree-expand-all.svelte';
import TreeSelectAll from '../_tree-select-all/tree-select-all.svelte';
import TreeItem from '../tree-item/tree-item.svelte';
import './tree.css';
import TreeRoot from './tree.svelte';

/**
 * `Tree` is the parent compound component and a namespace exposing two parts:
 *   - `Tree.Item`, the compose-only leaf (also importable via `@lostgradient/cinder/tree-item`).
 *   - `Tree.SelectAll`, the select-all/none control. It reads Tree's selection
 *   - `Tree.ExpandAll`, the expand/collapse control. It reads Tree's expansion
 *     context and throws if rendered outside a Tree, so — unlike `Tree.Item` —
 *     the context-only controls are namespace-only: there are no standalone
 *     `@lostgradient/cinder/tree-select-all` or `@lostgradient/cinder/tree-expand-all`
 *     imports, because standalone renders are always runtime errors.
 */
const Tree = Object.assign(TreeRoot, {
  ExpandAll: TreeExpandAll,
  Item: TreeItem,
  SelectAll: TreeSelectAll,
});

export default Tree;
export type { FlattenedTreeDataItem, TreeDataItem } from '../../_internal/tree-data.ts';
export type {
  TreeFilterPredicate,
  TreeProps,
  TreeRef,
  TreeSelectionBehavior,
  TreeSelectionMode,
  TreeVirtualizedItemRenderState,
} from './tree.types.ts';
// Tree.SelectAll is namespace-only (no standalone cinder/tree-select-all subpath).
// Re-export its prop type here so consumers can type a Tree.SelectAll wrapper without
// reaching into the internal _tree-select-all directory.
export type { TreeExpandAllProps } from '../_tree-expand-all/tree-expand-all.types.ts';
export type { TreeSelectAllProps } from '../_tree-select-all/tree-select-all.types.ts';
export { Tree };
