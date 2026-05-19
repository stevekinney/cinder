<script lang="ts" module>
  export type { BadgeProps, BadgeSize, BadgeVariant } from './badge.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';

  import type { BadgeProps } from './badge.types.ts';

  let {
    variant = 'neutral',
    size = 'md',
    class: customClassName,
    children,
    ...rest
  }: BadgeProps = $props();
</script>

<span
  class={classNames('cinder-badge', customClassName)}
  data-cinder-variant={variant}
  data-cinder-size={size}
  {...rest}
>
  {@render children()}
</span>
