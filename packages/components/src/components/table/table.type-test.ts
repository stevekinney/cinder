/**
 * Compile-time regression tests for the `Table` compound-component namespace.
 * svelte-check processes this file; tsc does not (it excludes .svelte imports).
 *
 * These verify that the `Object.assign` namespace members resolve and stay
 * correctly typed WITHOUT a hand-maintained `as typeof Root & { ... }` cast.
 * If a member is renamed in the `Object.assign` literal, the assignments below
 * stop compiling — surfacing the drift as a type error instead of silently
 * keeping the old declared type.
 */
import type { Component } from 'svelte';

import TableBody from '../table-body/table-body.svelte';
import TableCell from '../table-cell/table-cell.svelte';
import TableHeaderCell from '../table-header-cell/table-header-cell.svelte';
import TableHeader from '../table-header/table-header.svelte';
import TableRow from '../table-row/table-row.svelte';
import { Table } from './index.ts';

const _body: typeof TableBody = Table.Body;
const _cell: typeof TableCell = Table.Cell;
const _header: typeof TableHeader = Table.Header;
const _headerCell: typeof TableHeaderCell = Table.HeaderCell;
const _row: typeof TableRow = Table.Row;

Table satisfies Component<never>;

void _body;
void _cell;
void _header;
void _headerCell;
void _row;
