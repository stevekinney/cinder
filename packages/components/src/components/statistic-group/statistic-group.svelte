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
  The outer element exists so the group can query its OWN inline size. An
  element is never its own container -- a container query resolves against the
  nearest ANCESTOR container -- so with `container-type` on the grid itself the
  collapse rules could never fire for a standalone group (CIN-499). Every
  attribute, the role, and consumer classes stay on the grid element below, so
  nothing that targets `.cinder-statistic-group` changes.
-->
<div class="cinder-statistic-group__container">
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
</div>
