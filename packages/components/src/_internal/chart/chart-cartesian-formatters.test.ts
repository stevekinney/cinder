import { expect, test } from 'bun:test';
import { createCartesianModel } from './chart-cartesian-model.ts';

test('axis callbacks cannot mutate the context passed to value formatters', () => {
  const model = createCartesianModel({
    componentId: 'line-chart',
    series: [
      {
        id: 'revenue',
        label: 'Revenue',
        data: [{ x: 'January', y: 10 }],
        valueFormatter: (value, context) => `${context.seriesId}:${context.index}:${value}`,
      },
    ],
    hiddenSeriesIds: [],
    width: 500,
    height: 300,
    xAxis: {
      format(value, context) {
        context.seriesId = 'mutated';
        context.index = -1;
        return String(value);
      },
    },
  });

  expect(model.tableRows[0]?.valueLabel).toBe('revenue:0:10');
  expect(model.targets[0]?.valueLabel).toBe('revenue:0:10');
});
