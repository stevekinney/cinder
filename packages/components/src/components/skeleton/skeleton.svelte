<script lang="ts" module>
  /**
   * @cinder
   * @category feedback
   * @status stable
   * @purpose Decorative placeholder block that reserves layout space while real content loads.
   * @tag feedback
   * @tag loading
   * @useWhen Reserving the rough shape of incoming content during an initial fetch to avoid layout shift.
   * @useWhen Indicating progressive load of cards, rows, or media tiles where the final shape is known.
   * @avoidWhen Indicating indeterminate background work without a known target shape — use spinner.
   * @avoidWhen Communicating that a view has no data at all — use empty-state.
   * @related spinner, empty-state, progress
   */
  export type { SkeletonProps } from './skeleton.types.ts';
</script>

<script lang="ts">
  import type { SkeletonProps } from './skeleton.types.ts';
  import { cn } from '../../utilities/class-names.ts';

  let { width, height, radius, class: className }: SkeletonProps = $props();

  const style = $derived(
    [
      width !== undefined ? `width: ${width}` : null,
      height !== undefined ? `height: ${height}` : null,
      radius !== undefined ? `border-radius: ${radius}` : null,
    ]
      .filter((part): part is string => part !== null)
      .join('; '),
  );
</script>

<div class={cn('cinder-skeleton', className)} aria-hidden="true" {style}></div>
