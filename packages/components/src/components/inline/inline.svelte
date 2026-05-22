<script lang="ts" module>
  /**
   * @cinder
   * @category layout
   * @status stable
   * @purpose Horizontal flex row with configurable gap, wrap, and alignment.
   * @tag layout
   * @tag every-layout
   * @useWhen Laying out a row of controls, labels, or inline elements that should wrap on narrow viewports.
   * @useWhen Aligning a button and its supporting text on a single horizontal axis.
   * @avoidWhen Items must be tightly packed for chip or badge groups — use cluster instead.
   * @avoidWhen Items should always stack vertically — use stack instead.
   * @related stack, cluster, center, spacer
   */
  export type { InlineProps, InlineWrap } from './inline.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';

  import type { InlineProps } from './inline.types.ts';

  let { gap, wrap, align, as, class: customClassName, children, ...rest }: InlineProps = $props();
</script>

<svelte:element
  this={as ?? 'div'}
  class={classNames('cinder-inline', customClassName)}
  style:--inline-gap={gap}
  style:--inline-wrap={wrap}
  style:--inline-align={align}
  {...rest}
>
  {@render children()}
</svelte:element>
