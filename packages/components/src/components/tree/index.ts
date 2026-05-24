import TreeItem from '../tree-item/tree-item.svelte';
import TreeRoot from './tree.svelte';

/**
 * `Tree` is the parent compound component and a namespace exposing the
 * compose-only `Tree.Item` leaf. The leaf remains importable individually via
 * `cinder/tree-item`.
 */
const Tree = Object.assign(TreeRoot, {
  Item: TreeItem,
}) as typeof TreeRoot & {
  Item: typeof TreeItem;
};

export default Tree;
export type { TreeProps, TreeSelectionBehavior, TreeSelectionMode } from './tree.types.ts';
export { Tree };
