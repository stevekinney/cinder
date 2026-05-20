<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Grid container that arranges a set of stat tiles into a responsive multi-column layout with shared labelling.
   * @tag data-display
   * @tag dashboard
   * @useWhen Showing a row of related stat tiles such as the top metrics of a dashboard.
   * @useWhen Giving a cluster of stat entries a single accessible group label.
   * @avoidWhen Rendering exactly one metric — use stat on its own.
   * @avoidWhen Building a freeform card grid unrelated to numeric metrics — compose surface or grid-list directly.
   * @related stat
   */
  export type { StatGroupColumns, StatGroupProps, StatGroupVariant } from './stat-group.types.ts';
</script>

<script lang="ts">
  import type { StatGroupProps } from './stat-group.types.ts';
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
  }: StatGroupProps = $props();

  const groupRole = $derived(label ? 'group' : role);
  const groupAriaLabel = $derived(label || ariaLabel);
</script>

<div
  {...rest}
  role={groupRole}
  aria-label={groupAriaLabel}
  class={classNames('cinder-stat-group', customClassName)}
  data-cinder-variant={variant}
  data-cinder-columns={String(columns)}
>
  {@render children()}
</div>
