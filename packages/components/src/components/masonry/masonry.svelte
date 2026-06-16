<script lang="ts" module>
  /**
   * @cinder
   * @category layout
   * @status beta
   * @purpose Pure CSS waterfall layout that packs variable-height children into balanced columns.
   * @tag layout
   * @tag masonry
   * @useWhen Displaying cards, images, or panels with uneven heights where CSS column order is acceptable.
   * @avoidWhen Items have equal heights - use grid-list instead. | grid-list
   * @avoidWhen Left-to-right row reading order matters - use grid instead. | grid
   * @related grid, grid-list
   */
  export type { MasonryProps } from './masonry.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import type { MasonryProps } from './masonry.types.ts';

  let {
    columns,
    gap,
    as = 'div',
    class: customClassName,
    children,
    ...rest
  }: MasonryProps = $props();
</script>

<svelte:element
  this={as}
  {...rest}
  class={classNames('cinder-masonry', customClassName)}
  style:--cinder-masonry-columns={columns}
  style:--cinder-masonry-gap={gap}
>
  {@render children?.()}
</svelte:element>
