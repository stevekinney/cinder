<script lang="ts" module>
  import type { Snippet } from 'svelte';

  export type TableRowProps = {
    /** Additional class names merged with `.cinder-table__row`. */
    class?: string;
    /** Cell children (TableCell or TableHeaderCell). */
    children: Snippet;
  };
</script>

<script lang="ts">
  import { cn } from '../utilities/class-names.ts';

  let { class: className, children }: TableRowProps = $props();
</script>

<tr class={cn('cinder-table__row', className)}>
  {@render children()}
</tr>
