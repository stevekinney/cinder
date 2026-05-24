import TableBody from '../table-body/table-body.svelte';
import TableCell from '../table-cell/table-cell.svelte';
import TableHeaderCell from '../table-header-cell/table-header-cell.svelte';
import TableHeader from '../table-header/table-header.svelte';
import TableRow from '../table-row/table-row.svelte';
import TableRoot from './table.svelte';

/**
 * `Table` is the parent compound component and a namespace exposing the
 * compose-only leaves: `Table.Body`, `Table.Cell`, `Table.Header`,
 * `Table.HeaderCell`, and `Table.Row`. The leaves remain importable individually
 * via `cinder/table-body`, `cinder/table-cell`, etc.
 */
const Table = Object.assign(TableRoot, {
  Body: TableBody,
  Cell: TableCell,
  Header: TableHeader,
  HeaderCell: TableHeaderCell,
  Row: TableRow,
}) as typeof TableRoot & {
  Body: typeof TableBody;
  Cell: typeof TableCell;
  Header: typeof TableHeader;
  HeaderCell: typeof TableHeaderCell;
  Row: typeof TableRow;
};

export default Table;
export {
  TABLE_CONTEXT_KEY,
  TABLE_HEADER_SELECTION_CONTEXT_KEY,
  TABLE_SECTION_CONTEXT_KEY,
} from './table.context.ts';
export type {
  SortDirection,
  TableContext,
  TableDensity,
  TableHeaderSelectionContext,
  TableProps,
  TableSectionContext,
  TableSort,
} from './table.types.ts';
export { Table };
