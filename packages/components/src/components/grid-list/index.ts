import GridListItem from '../grid-list-item/grid-list-item.svelte';
import './grid-list.css';
import GridListRoot from './grid-list.svelte';

/**
 * `GridList` is the parent compound component and a namespace exposing the
 * compose-only `GridList.Item` leaf.
 * The leaf is also a named export of `@lostgradient/cinder`.
 */
const GridList = Object.assign(GridListRoot, {
  Item: GridListItem,
});

export default GridList;
export type { GridListProps } from './grid-list.types.ts';
export { GridList };
