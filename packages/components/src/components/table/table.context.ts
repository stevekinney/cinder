import { createContext } from 'svelte';

import { optionalContext } from '../../_internal/optional-context.ts';
import type {
  TableContext,
  TableHeaderSelectionContext,
  TableSectionContext,
} from './table.types.ts';

// ---------------------------------------------------------------------------
// TableContext — the root table context set by <Table>.
//
// Required by TableHeaderCell (missing provider = programmer error → throw).
// Optional in TableHeader and TableRow (they degrade gracefully without it).
// ---------------------------------------------------------------------------
const [getTableContextStrict, setTableContext] = createContext<TableContext>();

export { setTableContext };

/**
 * Strict read — throws when no `<Table>` ancestor has provided the context.
 * Use inside components that cannot function without a parent table (e.g.
 * TableHeaderCell).
 */
export const getTableContext = getTableContextStrict;

/**
 * Optional read — returns `undefined` when no `<Table>` ancestor is present.
 * Use inside components that degrade gracefully without a parent table (e.g.
 * TableHeader, TableRow).
 */
export const tryGetTableContext: () => TableContext | undefined =
  optionalContext(getTableContextStrict);

// ---------------------------------------------------------------------------
// TableSectionContext — set by <TableHeader> ('header') and <TableBody> ('body').
// Optional: a TableRow rendered directly under Table with no section is allowed
// (it warns but does not throw).
// ---------------------------------------------------------------------------
const [getTableSectionContextStrict, setTableSectionContext] = createContext<TableSectionContext>();

export { setTableSectionContext };

/**
 * Optional read — returns `undefined` when no section ancestor is present.
 */
export const tryGetTableSectionContext: () => TableSectionContext | undefined = optionalContext(
  getTableSectionContextStrict,
);

// ---------------------------------------------------------------------------
// TableHeaderSelectionContext — set by <TableHeader>.
// Optional: TableRow uses it only when a header selection context exists.
// ---------------------------------------------------------------------------
const [getTableHeaderSelectionContextStrict, setTableHeaderSelectionContext] =
  createContext<TableHeaderSelectionContext>();

export { setTableHeaderSelectionContext };

/**
 * Optional read — returns `undefined` when no TableHeader selection context is
 * present (i.e. the row is inside a body or the table is not selectable).
 */
export const tryGetTableHeaderSelectionContext: () => TableHeaderSelectionContext | undefined =
  optionalContext(getTableHeaderSelectionContextStrict);
