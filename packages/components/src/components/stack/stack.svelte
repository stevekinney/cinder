<script lang="ts" module>
  /**
   * @cinder
   * @category layout
   * @status alpha
   * @purpose One-dimensional flex layout primitive for arranging direct children with controlled direction, spacing, alignment, and wrapping.
   * @tag layout
   * @tag stack
   * @tag flex
   * @useWhen Arranging related controls, form rows, or panel sections along one axis.
   * @useWhen You need lightweight spacing and alignment without two-dimensional grid placement.
   * @avoidWhen You need explicit rows and columns — use grid.
   * @related grid
   */
  export type { StackAlign, StackDirection, StackJustify, StackProps } from './stack.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import type { StackProps } from './stack.types.ts';

  let {
    direction = 'column',
    gap,
    align = 'stretch',
    justify = 'start',
    wrap = false,
    as = 'div',
    class: customClassName,
    children,
    ...rest
  }: StackProps = $props();
</script>

<svelte:element
  this={as}
  {...rest}
  class={classNames('cinder-stack', customClassName)}
  data-cinder-direction={direction}
  data-cinder-align={align}
  data-cinder-justify={justify}
  data-cinder-wrap={wrap ? '' : undefined}
  style:--_cinder-stack-gap={gap}
>
  {@render children?.()}
</svelte:element>
