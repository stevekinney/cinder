<script lang="ts" module>
  export type { TimelineProps } from './timeline.types.ts';
</script>

<script lang="ts">
  import { cn } from '../../../utilities/class-names.ts';
  import type { TimelineProps } from './timeline.types.ts';

  let { class: className, children }: TimelineProps = $props();
</script>

<ol class={cn('cinder-timeline', className)}>
  {@render children()}
</ol>
