import GridListItem from '../grid-list-item/grid-list-item.svelte';
import GridListRoot from './grid-list.svelte';

/**
 * `GridList` is the parent compound component and a namespace exposing the
 * compose-only `GridList.Item` leaf. The leaf remains importable individually
 * via `cinder/grid-list-item`.
 */
const GridList = Object.assign(GridListRoot, {
  Item: GridListItem,
}) as typeof GridListRoot & {
  Item: typeof GridListItem;
};

export default GridList;
export type { GridListProps } from './grid-list.types.ts';
export { GridList };
