import { describe, expect, test } from 'bun:test';

import { createCartesianModel } from './chart-utilities.ts';

describe('createCartesianModel', () => {
  test('places x ticks at scaled positions for numeric domains', () => {
    const model = createCartesianModel({
      componentId: 'line-chart',
      series: [
        {
          id: 's',
          label: 'S',
          data: [
            { x: 0, y: 1 },
            { x: 10, y: 2 },
            { x: 100, y: 3 },
          ],
        },
      ],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
    });
    expect(model.xTicks).toHaveLength(3);
    // Numeric domain [0, 100] mapped to plotWidth; tick at x=10 sits at 10% of
    // the plot width, not at 50% (which is where evenly-spaced labels would land).
    const [first, middle, last] = model.xTicks;
    expect(first?.x).toBeCloseTo(0);
    expect(last?.x).toBeCloseTo(model.geometry.plotWidth);
    expect(middle?.x).toBeCloseTo(model.geometry.plotWidth * 0.1);
  });

  test('renders exactly one x tick when tickCount is 1', () => {
    const model = createCartesianModel({
      componentId: 'line-chart',
      series: [
        {
          id: 's',
          label: 'S',
          data: [
            { x: 'Jan', y: 1 },
            { x: 'Feb', y: 2 },
          ],
        },
      ],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
      xAxis: { tickCount: 1 },
    });

    expect(model.xTicks).toHaveLength(1);
    expect(model.xTicks[0]?.label).toBe('Jan');
  });

  test('uses series value formatters for cartesian table rows and targets', () => {
    const model = createCartesianModel({
      componentId: 'line-chart',
      series: [
        {
          id: 's',
          label: 'S',
          valueFormatter: (value, context) => `${context.seriesId}:${value}`,
          data: [{ x: 'Jan', y: 5 }],
        },
      ],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
    });

    expect(model.tableRows[0]?.valueLabel).toBe('s:5');
    expect(model.targets[0]?.valueLabel).toBe('s:5');
  });

  test('samples x ticks when tickCount is smaller than the domain length', () => {
    const model = createCartesianModel({
      componentId: 'line-chart',
      series: [
        {
          id: 's',
          label: 'S',
          data: [
            { x: 'Jan', y: 1 },
            { x: 'Feb', y: 2 },
            { x: 'Mar', y: 3 },
            { x: 'Apr', y: 4 },
          ],
        },
      ],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
      xAxis: { tickCount: 3 },
    });

    expect(model.xTicks.map((tick) => tick.label)).toEqual(['Jan', 'Mar', 'Apr']);
  });

  test('passes sampled source indices to x-axis formatters', () => {
    const model = createCartesianModel({
      componentId: 'line-chart',
      series: [
        {
          id: 'sampled',
          label: 'Sampled',
          data: Array.from({ length: 10 }, (_, index) => ({ x: index, y: index })),
        },
      ],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
      xAxis: { format: (_value, context) => String(context.index) },
    });

    expect(model.xTicks.map((tick) => tick.label)).toEqual([
      '0',
      '1',
      '3',
      '4',
      '5',
      '6',
      '8',
      '9',
    ]);
  });

  test('derives margins from formatted tick labels, rotation, and axis titles', () => {
    const baseline = createCartesianModel({
      componentId: 'line-chart',
      series: [{ id: 'usage', label: 'Usage', data: [{ x: 'Jan', y: 10 }] }],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
    });
    const labelled = createCartesianModel({
      componentId: 'line-chart',
      series: [{ id: 'usage', label: 'Usage', data: [{ x: 'January 2026', y: 10 }] }],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
      xAxis: {
        label: 'Reporting period',
        tickLabelRotation: -45,
      },
      yAxis: {
        label: 'Monthly recurring revenue',
        format: () => '$10,000,000.00',
      },
    });

    expect(labelled.geometry.marginLeft).toBeGreaterThan(baseline.geometry.marginLeft);
    expect(labelled.geometry.marginBottom).toBeGreaterThan(baseline.geometry.marginBottom);
  });
});
