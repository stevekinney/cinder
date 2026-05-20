<script lang="ts" module>
  export type { TableCellProps } from './table-cell.types.ts';
</script>

<script lang="ts">
  import type { TableCellProps } from './table-cell.types.ts';
  import { cn } from '../../utilities/class-names.ts';

  let { align = 'left', class: className, children }: TableCellProps = $props();
</script>

<td class={cn('cinder-table__cell', className)} data-cinder-align={align}>
  {@render children()}
</td>
