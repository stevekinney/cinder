import BentoCell from '../bento-cell/bento-cell.svelte';
import './bento-grid.css';
import BentoGridRoot from './bento-grid.svelte';

const BentoGrid = Object.assign(BentoGridRoot, {
  Cell: BentoCell,
});

export default BentoGrid;
export type { BentoCellProps } from '../bento-cell/bento-cell.types.ts';
export type { BentoGridColumns, BentoGridProps } from './bento-grid.types.ts';
export { BentoGrid };
