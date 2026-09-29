import type { ChartTarget } from './chart-utilities.ts';
export function makeTarget(
  id: string,
  x: number,
  y: number,
  overrides?: Partial<ChartTarget>,
): ChartTarget {
  return {
    id,
    seriesId: 'series-a',
    seriesLabel: 'Series A',
    xLabel: 'Jan',
    valueLabel: '100',
    x,
    y,
    color: 'red',
    ...overrides,
  };
}
