import { getDataGridColumnValue, type DataGridValueColumn } from './column-model.svelte.ts';
import { getCellCoordinateKey, type DataGridCellCoordinate } from './geometry.ts';

/**
 * A single cell that matched the current search query (COR-1138), addressed
 * the same way `DataGridSelectionModel` addresses a cell — `rowId` is the
 * disambiguated DOM row id (`keyedRows.rowDomId` in data-grid.svelte, not
 * necessarily `getRowId`'s raw return value), and `columnKey` is the
 * column's stable key. `rowIndex`/`columnIndex` are that cell's position in
 * the exact row/column lists `getDataGridSearchMatches` was called with —
 * sorted row order and rendered column order — so a caller can jump straight
 * to `moveActiveCell(rowIndex, columnIndex)` without re-searching either
 * list.
 */
export type DataGridSearchMatch = DataGridCellCoordinate & {
  rowIndex: number;
  columnIndex: number;
};

/**
 * One sorted, keyed row as `getDataGridSearchMatches` needs it: the row's
 * source data (read through each column's `getValue` semantics) plus its
 * disambiguated DOM row id. `data-grid.svelte`'s `sortedKeyedRows` entries
 * satisfy this structurally (they carry additional fields this type ignores).
 */
export type DataGridSearchRowEntry<TRow> = {
  row: TRow;
  rowDomId: string;
};

/**
 * Formats a cell value as the string search matches against. Mirrors
 * `formatDataGridValue` in data-grid.svelte (null/undefined → empty string,
 * `Date` → ISO string, everything else → `String(value)`) so a match is
 * found in exactly the text a user would see rendered in the cell.
 */
export function formatDataGridSearchValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  // Object's default `[object Object]` stringification is intentional here,
  // not a bug — it has to match whatever `formatDataGridValue` renders into
  // the cell (same fallback, same output) so a match is found in exactly
  // the text on screen, not a "smarter" serialization the cell doesn't show.
  // oxlint-disable-next-line typescript/no-base-to-string
  return String(value);
}

/**
 * Every cell whose formatted value case-insensitively contains `query`,
 * scanned over `rows` (sorted row order) × `columns` (rendered column
 * order) — the full lists, independent of which rows/columns are currently
 * windowed by row/column virtualization (COR-1138). An empty (or
 * whitespace-only) `query` short-circuits to `[]` before reading a single
 * cell value, which is what keeps a non-searching or just-cleared grid from
 * paying for `getValue` calls it doesn't need (COR-1136).
 */
export function getDataGridSearchMatches<TRow>(
  rows: readonly DataGridSearchRowEntry<TRow>[],
  columns: readonly DataGridValueColumn<TRow>[],
  query: string,
): DataGridSearchMatch[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return [];

  const matches: DataGridSearchMatch[] = [];
  rows.forEach((entry, rowIndex) => {
    columns.forEach((column, columnIndex) => {
      const value = getDataGridColumnValue(entry.row, column);
      const text = formatDataGridSearchValue(value).toLowerCase();
      if (text.includes(needle)) {
        matches.push({ rowId: entry.rowDomId, columnKey: column.key, rowIndex, columnIndex });
      }
    });
  });
  return matches;
}

/** Stable string key for a search match, reusing selection's coordinate-key format. */
export function getDataGridSearchMatchKey(match: DataGridSearchMatch): string {
  return getCellCoordinateKey(match);
}

/**
 * The match index to move to from `currentIndex` in `direction`, wrapping
 * around both ends (COR-1137). `undefined` when there are no matches;
 * moving from `undefined` lands on the first match going forward or the
 * last match going backward, matching how a fresh search with no prior
 * position should behave.
 */
export function getNextDataGridSearchMatchIndex(
  currentIndex: number | undefined,
  matchCount: number,
  direction: 1 | -1,
): number | undefined {
  if (matchCount === 0) return undefined;
  if (currentIndex === undefined) return direction === 1 ? 0 : matchCount - 1;
  return (currentIndex + direction + matchCount) % matchCount;
}

/**
 * The live-region text for the current search position (COR-1135), e.g.
 * "Match 3 of 12" or "No matches". `currentIndex` is `undefined` exactly
 * when nothing is the current match (no matches, or matches not yet
 * settled), in which case the count alone is reported.
 */
export function formatDataGridSearchStatus(
  currentIndex: number | undefined,
  matchCount: number,
): string {
  if (matchCount === 0) return 'No matches';
  if (currentIndex === undefined) {
    return matchCount === 1 ? '1 match' : `${matchCount} matches`;
  }
  return `Match ${currentIndex + 1} of ${matchCount}`;
}
