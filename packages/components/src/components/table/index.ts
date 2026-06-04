import TableBody from '../table-body/table-body.svelte';
import TableCell from '../table-cell/table-cell.svelte';
import TableHeaderCell from '../table-header-cell/table-header-cell.svelte';
import TableHeader from '../table-header/table-header.svelte';
import TableRow from '../table-row/table-row.svelte';
import './table.css';
import TableRoot from './table.svelte';

/**
 * `Table` is the parent compound component and a namespace exposing the
 * compose-only leaves: `Table.Body`, `Table.Cell`, `Table.Header`,
 * `Table.HeaderCell`, and `Table.Row`. The leaves remain importable individually
 * via `@lostgradient/cinder/table-body`, `@lostgradient/cinder/table-cell`, etc.
 */
const Table = Object.assign(TableRoot, {
  Body: TableBody,
  Cell: TableCell,
  Header: TableHeader,
  HeaderCell: TableHeaderCell,
  Row: TableRow,
});

export default Table;
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
