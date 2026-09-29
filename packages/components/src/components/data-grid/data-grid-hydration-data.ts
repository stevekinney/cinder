import type { DataGridColumnDef } from './data-grid.types.ts';

export type LogRow = {
  id: string;
  message: string;
  owner: string;
  [key: `metric${number}`]: string | number;
};

export function makeRows(count: number): LogRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `row-${index}`,
    message: `Message ${index}`,
    owner: `Owner ${index % 5}`,
  }));
}

export function makeMetricColumns(count: number): DataGridColumnDef<LogRow>[] {
  return Array.from({ length: count }, (_, index) => {
    const column: DataGridColumnDef<LogRow> = {
      key: `metric${index}`,
      header: `Metric ${index}`,
      width: 100,
      getValue: (row: LogRow) => row[`metric${index}`],
    };
    if (index === 0) column.pin = 'left';
    if (index === count - 1) column.pin = 'right';
    return column;
  });
}
