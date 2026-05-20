<script lang="ts" module>
  export type { TableBodyProps } from './table-body.types.ts';
</script>

<script lang="ts">
  import type { TableBodyProps } from './table-body.types.ts';
  import { setContext } from 'svelte';

  import { TABLE_SECTION_CONTEXT_KEY } from '../table/table.context.ts';
  import type { TableSectionContext } from '../table/table.types.ts';
  import { cn } from '../../utilities/class-names.ts';

  let { class: className, children }: TableBodyProps = $props();

  setContext<TableSectionContext>(TABLE_SECTION_CONTEXT_KEY, 'body');
</script>

<tbody class={cn('cinder-table__body', className)}>
  {@render children()}
</tbody>
