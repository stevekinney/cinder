<script lang="ts" module>
  /**
   * @cinder
   * @category layout
   * @status stable
   * @purpose Vertical flex column that spaces its children with a configurable gap.
   * @tag layout
   * @tag every-layout
   * @useWhen Stacking form fields, page sections, or any vertical sequence with consistent spacing.
   * @useWhen Composing a column where each child should occupy the full available width.
   * @avoidWhen Items need to flow horizontally — use inline or cluster instead.
   * @avoidWhen Items need precise grid placement — use a CSS grid directly.
   * @avoidWhen Using `direction="column-reverse"` for visual reordering — it breaks DOM/focus order (WCAG 1.3.2, 2.4.3). Reorder the DOM instead.
   * @related inline, cluster, center, spacer
   */
  export type { StackProps, StackDirection } from './stack.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';

  import type { StackProps } from './stack.types.ts';

  let { gap, direction, as, class: customClassName, children, ...rest }: StackProps = $props();
</script>

<svelte:element
  this={as ?? 'div'}
  class={classNames('cinder-stack', customClassName)}
  style:--stack-gap={gap}
  style:--stack-direction={direction}
  {...rest}
>
  {@render children()}
</svelte:element>
