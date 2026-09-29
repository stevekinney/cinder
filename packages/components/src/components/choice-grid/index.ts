import ChoiceGridItem from '../choice-grid-item/choice-grid-item.svelte';
import './choice-grid.css';
import ChoiceGridRoot from './choice-grid.svelte';

/**
 * `ChoiceGrid` is the parent compound component. It is also a namespace whose
 * `Item` property exposes the compose-only leaf under its idiomatic name:
 * `ChoiceGrid.Item`.
 * The leaf is also a named export of `@lostgradient/cinder`.
 */
const ChoiceGrid = Object.assign(ChoiceGridRoot, {
  Item: ChoiceGridItem,
});

export default ChoiceGrid;
export type {
  ChoiceGridColumns,
  ChoiceGridContext,
  ChoiceGridItemState,
  ChoiceGridProps,
  ChoiceGridSize,
} from './choice-grid.types.ts';
export { ChoiceGrid };
