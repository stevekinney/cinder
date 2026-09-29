import type { DataGridEditType } from '../data-grid.types.ts';

/**
 * Identity of an in-progress cell edit, keyed by stable row key (see
 * `keyedRows.rowKey` in data-grid.svelte) and column key rather than visual
 * row/column index. Sorting and virtualization reorder or window visual
 * indices without changing either key, so an edit in progress survives both.
 */
export type DataGridEditCellIdentity = {
  rowKey: string;
  columnKey: string;
};

export type DataGridEditCommitResult = { committed: true; value: unknown } | { committed: false };

/**
 * Resolves the Input `type` — and the value type emitted to `onCellEdit` —
 * for an editable column. An explicit `column.editType` always wins;
 * otherwise a `number` current value resolves to `'number'` and everything
 * else resolves to `'text'`.
 */
export function resolveDataGridEditType(
  editType: DataGridEditType | undefined,
  currentValue: unknown,
): DataGridEditType {
  if (editType) return editType;
  return typeof currentValue === 'number' ? 'number' : 'text';
}

/**
 * Converts a committed draft string into the value handed to `onCellEdit`.
 *
 * - `'text'` columns commit the draft string as-is.
 * - `'number'` columns commit `undefined` for an empty (or whitespace-only)
 *   draft — an intentional "cleared" value — and the parsed finite number
 *   for a numeric draft.
 * - A `'number'` draft that is neither empty nor a valid finite number
 *   (`"abc"`, `"12x"`) is rejected: `committed` is `false`, so the caller
 *   should behave like Escape and leave the original value untouched. This
 *   is what keeps a raw `NaN` from ever reaching `onCellEdit`.
 */
export function resolveDataGridEditCommitValue(
  editType: DataGridEditType,
  draft: string,
): DataGridEditCommitResult {
  if (editType !== 'number') return { committed: true, value: draft };

  const trimmed = draft.trim();
  if (trimmed === '') return { committed: true, value: undefined };

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return { committed: false };

  return { committed: true, value: parsed };
}

/**
 * Tracks at most one in-progress cell edit and its live draft value. Owned
 * by data-grid.svelte the way `DataGridSelectionModel` owns selection state.
 */
export class DataGridEditModel {
  editingCell = $state<DataGridEditCellIdentity | undefined>();
  draftValue = $state('');
  originalValue: unknown = undefined;

  begin(cell: DataGridEditCellIdentity, draft: string, originalValue: unknown): void {
    this.editingCell = cell;
    this.draftValue = draft;
    this.originalValue = originalValue;
  }

  end(): void {
    this.editingCell = undefined;
    this.draftValue = '';
    this.originalValue = undefined;
  }

  isEditing(cell: DataGridEditCellIdentity): boolean {
    return (
      this.editingCell !== undefined &&
      this.editingCell.rowKey === cell.rowKey &&
      this.editingCell.columnKey === cell.columnKey
    );
  }

  setDraft(value: string): void {
    this.draftValue = value;
  }

  /**
   * Ends the in-progress edit when its row key or column key is no longer
   * part of the current grid geometry (a row was removed, filtered out, or
   * a column was removed/hidden). Sorting and re-virtualizing alone never
   * trigger this because they don't change either key set.
   */
  reconcile(rowKeys: readonly string[], columnKeys: readonly string[]): void {
    const cell = this.editingCell;
    if (!cell) return;
    if (rowKeys.includes(cell.rowKey) && columnKeys.includes(cell.columnKey)) return;

    this.end();
  }
}
