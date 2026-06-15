import type { HTMLAttributes } from 'svelte/elements';
/** Layout variant for the statistics display: `default` shows full markup, `compact` trims it. */
export type DiffStatisticsVariant = 'default' | 'compact';
/**
 * Opt the compact-variant pills into the shared toolbar height
 * (`--cinder-control-height-sm`) so they line up with sibling Button
 * (size="sm") and SegmentedControl (density="toolbar") in editor toolbars.
 * Only meaningful when `variant="compact"`.
 */
export type DiffStatisticsDensity = 'toolbar';
export type DiffStatisticsProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  /** Number of added lines. */
  added: number;
  /** Number of removed lines. */
  removed: number;
  /** Number of modified lines. */
  modified: number;
  /**
   * Layout variant. `default` shows full statistic markup; `compact` trims it
   * for tight surfaces. Distinct from `density`, which adjusts control height.
   */
  variant?: DiffStatisticsVariant;
  /**
   * Toolbar density opt-in (compact variant only). When set, pills snap to
   * the shared `--cinder-control-height-sm` tier.
   */
  density?: DiffStatisticsDensity;
  /** Hide statistics with a zero value. */
  hideZero?: boolean;
  /** Additional class names merged with `.cinder-diff-statistics`. */
  class?: string;
};
