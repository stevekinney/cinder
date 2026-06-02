import TreeSelectAll from '../_tree-select-all/tree-select-all.svelte';
import TreeItem from '../tree-item/tree-item.svelte';
import './tree.css';
import TreeRoot from './tree.svelte';

/**
 * `Tree` is the parent compound component and a namespace exposing two parts:
 *   - `Tree.Item`, the compose-only leaf (also importable via `cinder/tree-item`).
 *   - `Tree.SelectAll`, the select-all/none control. It reads Tree's selection
 *     context and throws if rendered outside a Tree, so — unlike `Tree.Item` —
 *     it is namespace-only: there is no standalone `cinder/tree-select-all`
 *     import, because a standalone render is always a runtime error.
 */
const Tree = Object.assign(TreeRoot, {
  Item: TreeItem,
  SelectAll: TreeSelectAll,
});

export default Tree;
export type { TreeProps, TreeSelectionBehavior, TreeSelectionMode } from './tree.types.ts';
// Tree.SelectAll is namespace-only (no standalone cinder/tree-select-all subpath).
// Re-export its prop type here so consumers can type a Tree.SelectAll wrapper without
// reaching into the internal _tree-select-all directory.
export type { TreeSelectAllProps } from '../_tree-select-all/tree-select-all.types.ts';
export { Tree };
