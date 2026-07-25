<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Grid container that arranges a set of statistic tiles into a responsive multi-column layout with shared labelling.
   * @tag data-display
   * @tag dashboard
   * @useWhen Showing a row of related statistic tiles such as the top metrics of a dashboard.
   * @useWhen Giving a cluster of statistic entries a single accessible group label.
   * @avoidWhen Rendering exactly one metric — use statistic on its own.
   * @avoidWhen Building a freeform card grid unrelated to numeric metrics — compose surface or grid-list directly.
   * @related statistic
   */
  export type {
    StatisticGroupColumns,
    StatisticGroupProps,
    StatisticGroupVariant,
  } from './statistic-group.types.ts';
</script>

<script lang="ts">
  import type { StatisticGroupProps } from './statistic-group.types.ts';
  import { classNames } from '../../utilities/class-names.ts';

  let {
    columns = 'auto',
    variant = 'default',
    children,
    class: customClassName,
    label,
    role,
    'aria-label': ariaLabel,
    ...rest
  }: StatisticGroupProps = $props();

  const groupRole = $derived(label ? 'group' : role);
  const groupAriaLabel = $derived(label || ariaLabel);
</script>

<div
  {...rest}
  role={groupRole}
  aria-label={groupAriaLabel}
  class={classNames('cinder-statistic-group', customClassName)}
  data-cinder-variant={variant}
  data-cinder-columns={String(columns)}
>
  {@render children()}
</div>
