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

<!--
  The root is the query container and the grid is its child. An element is
  never its own container -- a container query resolves against the nearest
  ANCESTOR container -- so with `container-type` on the grid itself the
  collapse rules could never fire for a standalone group (CIN-499). The
  container sits on the public root rather than on an extra wrapper around it
  so that `class`, `style`, and `...rest` land on the element the queries
  measure: a consumer that constrains the group's inline size constrains
  exactly what collapses.
-->
<div
  {...rest}
  role={groupRole}
  aria-label={groupAriaLabel}
  class={classNames('cinder-statistic-group', customClassName)}
  data-cinder-variant={variant}
  data-cinder-columns={String(columns)}
>
  <div class="cinder-statistic-group__grid">
    {@render children()}
  </div>
</div>
