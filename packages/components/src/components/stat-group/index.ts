import Stat from '../stat/stat.svelte';
import StatGroupRoot from './stat-group.svelte';

/**
 * `StatGroup` is the parent compound component and a namespace exposing the
 * `StatGroup.Stat` leaf. The leaf remains importable individually via
 * `cinder/stat`.
 */
const StatGroup = Object.assign(StatGroupRoot, {
  Stat,
});

export default StatGroup;
export type { StatGroupColumns, StatGroupProps, StatGroupVariant } from './stat-group.types.ts';
export { StatGroup };
