<script lang="ts" module>
  /**
   * @cinder
   * @category layout
   * @status stable
   * @purpose Wrapping flex container tuned for groups of chips, badges, or buttons.
   * @tag layout
   * @tag every-layout
   * @useWhen Rendering a freely wrapping list of tags, badges, or short controls.
   * @useWhen Laying out a footer toolbar that should reflow on narrow viewports.
   * @avoidWhen Items should never wrap onto multiple lines — use inline with `wrap="nowrap"` instead.
   * @avoidWhen Items must stack vertically — use stack instead.
   * @related stack, inline, center, spacer
   */
  export type { ClusterProps } from './cluster.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';

  import type { ClusterProps } from './cluster.types.ts';

  let {
    gap,
    align,
    justify,
    as,
    class: customClassName,
    children,
    ...rest
  }: ClusterProps = $props();
</script>

<svelte:element
  this={as ?? 'div'}
  {...rest}
  class={classNames('cinder-cluster', customClassName)}
  style:--cluster-gap={gap}
  style:--cluster-align={align}
  style:--cluster-justify={justify}
>
  {@render children()}
</svelte:element>
