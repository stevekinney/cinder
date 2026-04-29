<script lang="ts" module>
  import type { Snippet } from 'svelte';

  /**
   * EXPERIMENTAL — Timeline API may change between minor versions.
   *
   * Vertical event-rail container. Render TimelineItem children inside.
   * Useful for workflow events, audit logs, run histories.
   */
  export type TimelineProps = {
    /** Additional class names merged with `.cinder-timeline`. */
    class?: string;
    /** TimelineItem children. */
    children: Snippet;
  };
</script>

<script lang="ts">
  import { cn } from '../../utilities/class-names.ts';

  let { class: className, children }: TimelineProps = $props();
</script>

<ol class={cn('cinder-timeline', className)}>
  {@render children()}
</ol>
