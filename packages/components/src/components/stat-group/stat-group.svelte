<script lang="ts" module>
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
