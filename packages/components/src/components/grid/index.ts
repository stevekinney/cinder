import GridItem from '../grid-item/grid-item.svelte';
import './grid.css';
import GridRoot from './grid.svelte';

/**
 * `Grid` is the parent compound component and a namespace exposing the optional
 * placement leaf as `Grid.Item`. The leaf remains importable individually from
 * `@lostgradient/cinder/grid-item`.
 */
const Grid = Object.assign(GridRoot, {
  Item: GridItem,
});

export default Grid;
export type { GridItemProps } from '../grid-item/grid-item.types.ts';
export type { GridColumns, GridProps } from './grid.types.ts';
export { Grid };
