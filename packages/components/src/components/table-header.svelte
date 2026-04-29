<script lang="ts" module>
  import type { Snippet } from 'svelte';

  export type TableHeaderProps = {
    /** Additional class names merged with `.cinder-table__header`. */
    class?: string;
    /** TableRow children — typically a single header row. */
    children: Snippet;
  };
</script>

<script lang="ts">
  import { cn } from '../utilities/class-names.ts';

  let { class: className, children }: TableHeaderProps = $props();
</script>

<thead class={cn('cinder-table__header', className)}>
  {@render children()}
</thead>
