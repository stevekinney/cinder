<script lang="ts" module>
  /** Props for the Skeleton component. */
  export type SkeletonProps = {
    width?: string;
    height?: string;
    radius?: string;
    class?: string;
  };
</script>

<script lang="ts">
  import { cn } from '../utilities/class-names.ts';

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
