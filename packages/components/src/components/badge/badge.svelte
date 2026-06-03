<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Compact non-interactive label that annotates an adjacent element with a short status, count, or category.
   * @tag label
   * @tag indicator
   * @useWhen Annotating a value with a short status word like "new" or "beta".
   * @useWhen Displaying a numeric count next to an icon or title.
   * @avoidWhen The label must be interactive or removable — use chip instead.
   * @avoidWhen Showing only a colored dot for presence — use status-dot instead.
   * @related chip, status-dot
   */
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
  {@render children?.()}
</span>
