<script lang="ts" module>
  import type { Snippet } from 'svelte';

  export type TableBodyProps = {
    /** Additional class names merged with `.cinder-table__body`. */
    class?: string;
    /** Row children. */
    children: Snippet;
  };
</script>

<script lang="ts">
  import { setContext } from 'svelte';

  import { TABLE_SECTION_CONTEXT_KEY, type TableSectionContext } from './table.svelte';
  import { cn } from '../utilities/class-names.ts';

  let { class: className, children }: TableBodyProps = $props();

  setContext<TableSectionContext>(TABLE_SECTION_CONTEXT_KEY, 'body');
</script>

<tbody class={cn('cinder-table__body', className)}>
  {@render children()}
</tbody>
