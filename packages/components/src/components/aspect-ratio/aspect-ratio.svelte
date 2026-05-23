<script lang="ts" module>
  /**
   * @cinder
   * @category layout
   * @status stable
   * @purpose Generic media box that enforces a fixed aspect ratio for arbitrary embedded content using the native CSS aspect-ratio property.
   * @tag layout
   * @tag media
   * @useWhen Reserving stable space for embedded media, previews, or art-directed content before it loads.
   * @useWhen You need a generic ratio wrapper for iframe, video, canvas, or custom content rather than an image-specific primitive.
   * @avoidWhen The child already owns its sizing contract and should determine its own height naturally.
   * @avoidWhen Supporting legacy browsers that lack native aspect-ratio support.
   * @related image
   * @related card
   */
  export type {
    AspectRatioElement,
    AspectRatioOverflow,
    AspectRatioProps,
  } from './aspect-ratio.types.ts';
</script>

<script lang="ts">
  import type { AspectRatioProps } from './aspect-ratio.types.ts';
  import { classNames } from '../../utilities/class-names.ts';

  let {
    ratio = '16/9',
    overflow = 'hidden',
    as = 'div',
    class: className,
    children,
    ...rest
  }: AspectRatioProps = $props();

  const ratioValue = $derived.by(() => {
    if (typeof ratio === 'string') {
      return ratio;
    }

    if (Number.isFinite(ratio) && ratio > 0) {
      return String(ratio);
    }

    return undefined;
  });
</script>

<svelte:element
  this={as}
  {...rest}
  class={classNames('cinder-aspect-ratio', className)}
  data-cinder-overflow={overflow}
  style:aspect-ratio={ratioValue}
>
  {@render children()}
</svelte:element>
