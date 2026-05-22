<script lang="ts" module>
  /**
   * @cinder
   * @category layout
   * @status stable
   * @purpose Flexible filler that pushes adjacent siblings to opposite ends of an inline or cluster.
   * @tag layout
   * @tag every-layout
   * @useWhen Separating a leading and trailing group inside an inline toolbar.
   * @useWhen Placing a button at the far end of a row without manual margin tricks.
   * @avoidWhen The container does not use flexbox — spacer relies on `flex: 1`.
   * @avoidWhen Reserving fixed empty space — set explicit margin or gap on the container instead.
   * @related stack, inline, cluster, center
   */
  export type { SpacerProps } from './spacer.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';

  import type { SpacerProps } from './spacer.types.ts';

  let { as, class: customClassName, ...rest }: SpacerProps = $props();
</script>

<svelte:element
  this={as ?? 'span'}
  class={classNames('cinder-spacer', customClassName)}
  {...rest}
  aria-hidden="true"
></svelte:element>
