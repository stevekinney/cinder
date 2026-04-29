<script lang="ts" module>
  import type { Snippet } from 'svelte';

  export type TableCellProps = {
    /** Visual alignment for numeric columns. */
    align?: 'left' | 'center' | 'right';
    /** Additional class names merged with `.cinder-table__cell`. */
    class?: string;
    /** Cell content. */
    children: Snippet;
  };
</script>

<script lang="ts">
  import { cn } from '../utilities/class-names.ts';

  let { align = 'left', class: className, children }: TableCellProps = $props();
</script>

<td class={cn('cinder-table__cell', className)} data-cinder-align={align}>
  {@render children()}
</td>
