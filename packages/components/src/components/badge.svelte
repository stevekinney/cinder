<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
  export type BadgeSize = 'xs' | 'sm' | 'md';

  export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
    variant?: BadgeVariant;
    size?: BadgeSize;
    class?: string;
    children: Snippet;
  };
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';

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
