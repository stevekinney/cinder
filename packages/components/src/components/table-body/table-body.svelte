<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Body section of a table that groups data rows and establishes the body section context for nested rows.
   * @tag table
   * @tag section
   * @useWhen Wrapping the data rows of a table to distinguish them from header rows.
   * @avoidWhen Wrapping header rows — use table-header instead.
   * @related table, table-row
   */
  export type { TableBodyProps } from './table-body.types.ts';
</script>

<script lang="ts">
  import type { TableBodyProps } from './table-body.types.ts';

  import { setTableSectionContext } from '../table/table.context.ts';
  import { cn } from '../../utilities/class-names.ts';

  let { class: className, children }: TableBodyProps = $props();

  setTableSectionContext('body');
</script>

<tbody class={cn('cinder-table__body', className)}>
  {@render children()}
</tbody>
