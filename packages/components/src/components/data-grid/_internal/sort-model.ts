import type { DataGridSortDirection, DataGridSortModel } from '../data-grid.types.ts';
import { getDataGridColumnValue, type DataGridValueColumn } from './column-model.svelte.ts';

const sortCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function getNextDataGridSortModel(
  currentSortModel: DataGridSortModel,
  columnKey: string,
  multiSort: boolean,
): DataGridSortModel {
  const currentIndex = currentSortModel.findIndex((item) => item.key === columnKey);
  const currentItem = currentIndex >= 0 ? currentSortModel[currentIndex] : undefined;
  const nextDirection = getNextSortDirection(currentItem?.direction);

  if (!multiSort) {
    return nextDirection === undefined ? [] : [{ key: columnKey, direction: nextDirection }];
  }

  if (currentIndex < 0) return [...currentSortModel, { key: columnKey, direction: 'ascending' }];
  if (nextDirection === undefined) return currentSortModel.filter((item) => item.key !== columnKey);
  return currentSortModel.map((item, index) =>
    index === currentIndex ? { key: columnKey, direction: nextDirection } : item,
  );
}

export function getActiveDataGridSortModel<TRow>(
  columns: readonly DataGridValueColumn<TRow>[],
  sortModel: DataGridSortModel,
): DataGridSortModel {
  return sortModel.filter((item) =>
    columns.some((column) => column.sortable && column.key === item.key),
  );
}

export function getSortedDataGridRowIndices<TRow>(
  rows: readonly TRow[],
  columns: readonly DataGridValueColumn<TRow>[],
  sortModel: DataGridSortModel,
): number[] {
  const rowIndices = rows.map((_, index) => index);
  const activeSortItems = getActiveDataGridSortModel(columns, sortModel).flatMap((item) => {
    const column = columns.find((candidate) => candidate.key === item.key);
    return column === undefined ? [] : [{ column, direction: item.direction }];
  });

  if (activeSortItems.length === 0) return rowIndices;

  const sortedRowIndices = rowIndices.slice();
  sortedRowIndices.sort((leftIndex, rightIndex) => {
    const leftRow = rows[leftIndex];
    const rightRow = rows[rightIndex];
    if (leftRow === undefined || rightRow === undefined) return leftIndex - rightIndex;

    for (const { column, direction } of activeSortItems) {
      const leftValue = getDataGridColumnValue(leftRow, column);
      const rightValue = getDataGridColumnValue(rightRow, column);
      if (isNullishSortValue(leftValue) || isNullishSortValue(rightValue)) {
        const comparison = compareDataGridValues(leftValue, rightValue, direction);
        if (comparison !== 0) return comparison;
        continue;
      }
      const comparison = column.sortComparator
        ? column.sortComparator(leftValue, rightValue, leftRow, rightRow)
        : compareDataGridValues(leftValue, rightValue, direction);

      if (comparison !== 0) {
        return column.sortComparator && direction === 'descending' ? -comparison : comparison;
      }
    }

    return leftIndex - rightIndex;
  });
  return sortedRowIndices;
}

export function compareDataGridValues(
  leftValue: unknown,
  rightValue: unknown,
  direction: DataGridSortDirection = 'ascending',
): number {
  if (Object.is(leftValue, rightValue)) return 0;
  const leftValueIsNullish = isNullishSortValue(leftValue);
  const rightValueIsNullish = isNullishSortValue(rightValue);
  if (leftValueIsNullish && rightValueIsNullish) return 0;
  if (leftValueIsNullish) return 1;
  if (rightValueIsNullish) return -1;

  const leftNumber = getComparableNumber(leftValue);
  const rightNumber = getComparableNumber(rightValue);
  if (leftNumber !== undefined && rightNumber !== undefined) {
    return direction === 'ascending' ? leftNumber - rightNumber : rightNumber - leftNumber;
  }

  const comparison = sortCollator.compare(
    getComparableLabel(leftValue),
    getComparableLabel(rightValue),
  );
  return direction === 'ascending' ? comparison : -comparison;
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
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : undefined;
  }
  return undefined;
}

function getComparableLabel(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'symbol') return value.description ?? '';
  if (value instanceof Date) return value.toISOString();
  return Object.prototype.toString.call(value);
}

function isNullishSortValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (value instanceof Date && !Number.isFinite(value.getTime()))
  );
}
