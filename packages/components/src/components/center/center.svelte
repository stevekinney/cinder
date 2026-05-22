<script lang="ts" module>
  /**
   * @cinder
   * @category layout
   * @status stable
   * @purpose Horizontally centered block that caps its inline size at a content-width token.
   * @tag layout
   * @tag every-layout
   * @useWhen Centering a column of prose, a form, or a card stack inside a wider viewport.
   * @useWhen Constraining a reading width so long lines do not stretch across the screen.
   * @avoidWhen The element must fill the viewport edge to edge — render the children directly without center.
   * @avoidWhen Items need to be distributed horizontally within the centered block — compose center with stack or inline inside.
   * @related stack, inline, cluster, spacer
   */
  export type { CenterProps } from './center.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';

  import type { CenterProps } from './center.types.ts';

  let {
    maxWidth,
    minHeight,
    intrinsic = false,
    as,
    class: customClassName,
    children,
    ...rest
  }: CenterProps = $props();
</script>

<svelte:element
  this={as ?? 'div'}
  {...rest}
  class={classNames('cinder-center', customClassName)}
  data-cinder-intrinsic={intrinsic ? 'true' : undefined}
  style:--center-max-width={maxWidth}
  style:--center-min-height={minHeight}
>
  {@render children()}
</svelte:element>
