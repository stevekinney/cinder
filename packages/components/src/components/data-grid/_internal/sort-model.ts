import type {
  DataGridColumnDef,
  DataGridSortDirection,
  DataGridSortModel,
} from '../data-grid.types.ts';
import { getDataGridColumnValue } from './column-model.svelte.ts';

const sortCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function getNextDataGridSortModel(
  currentSortModel: DataGridSortModel,
  columnKey: string,
  multiSort: boolean,
): DataGridSortModel {
  const currentItem = currentSortModel.find((item) => item.key === columnKey);
  const nextDirection = getNextSortDirection(currentItem?.direction);

  if (!multiSort) {
    return nextDirection === undefined ? [] : [{ key: columnKey, direction: nextDirection }];
  }

  const modelWithoutColumn = currentSortModel.filter((item) => item.key !== columnKey);
  if (nextDirection === undefined) return modelWithoutColumn;
  return [...modelWithoutColumn, { key: columnKey, direction: nextDirection }];
}

export function getSortedDataGridRowIndices<TRow>(
  rows: readonly TRow[],
  columns: readonly DataGridColumnDef<TRow>[],
  sortModel: DataGridSortModel,
): number[] {
  const rowIndices = rows.map((_, index) => index);
  const activeSortItems = sortModel.flatMap((item) => {
    const column = columns.find((candidate) => candidate.key === item.key);
    if (!column?.sortable) return [];
    return [{ column, direction: item.direction }];
  });

  if (activeSortItems.length === 0) return rowIndices;

  return rowIndices.toSorted((leftIndex, rightIndex) => {
    const leftRow = rows[leftIndex];
    const rightRow = rows[rightIndex];
    if (leftRow === undefined || rightRow === undefined) return leftIndex - rightIndex;

    for (const { column, direction } of activeSortItems) {
      const leftValue = getDataGridColumnValue(leftRow, column);
      const rightValue = getDataGridColumnValue(rightRow, column);
      const comparison = column.sortComparator
        ? column.sortComparator(leftValue, rightValue, leftRow, rightRow)
        : compareDataGridValues(leftValue, rightValue);

      if (comparison !== 0) {
        return direction === 'ascending' ? comparison : -comparison;
      }
    }

    return leftIndex - rightIndex;
  });
}

export function compareDataGridValues(leftValue: unknown, rightValue: unknown): number {
  if (Object.is(leftValue, rightValue)) return 0;
  if (leftValue === null || leftValue === undefined) return 1;
  if (rightValue === null || rightValue === undefined) return -1;

  const leftNumber = getComparableNumber(leftValue);
  const rightNumber = getComparableNumber(rightValue);
  if (leftNumber !== undefined && rightNumber !== undefined) {
    return leftNumber - rightNumber;
  }

  return sortCollator.compare(getComparableLabel(leftValue), getComparableLabel(rightValue));
}

function getNextSortDirection(
  currentDirection: DataGridSortDirection | undefined,
): DataGridSortDirection | undefined {
  if (currentDirection === undefined) return 'ascending';
  if (currentDirection === 'ascending') return 'descending';
  return undefined;
}

function getComparableNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  return undefined;
}

function getComparableLabel(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'symbol') return value.description ?? '';
  if (value instanceof Date) return value.toISOString();

  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return Object.prototype.toString.call(value);
  }
}
