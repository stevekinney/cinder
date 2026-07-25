import Statistic from '../statistic/statistic.svelte';
import './statistic-group.css';
import StatisticGroupRoot from './statistic-group.svelte';

/**
 * `StatisticGroup` is the parent compound component and a namespace exposing the
 * `StatisticGroup.Statistic` leaf. The leaf remains importable individually via
 * `@lostgradient/cinder/statistic`.
 */
const StatisticGroup = Object.assign(StatisticGroupRoot, {
  Statistic,
});

export default StatisticGroup;
export type {
  StatisticGroupColumns,
  StatisticGroupProps,
  StatisticGroupVariant,
} from './statistic-group.types.ts';
export { StatisticGroup };
