import { describe, expect, test } from 'bun:test';

import { createCartesianModel, type CartesianChartModel } from './chart-utilities.ts';

function expectSeparatedFiniteRuns(
  series: CartesianChartModel['normalizedSeries'][number] | undefined,
) {
  for (let index = 1; index < (series?.points.length ?? 0); index++) {
    expect(series?.points[index - 1]?.y === null || series?.points[index]?.y === null).toBe(true);
  }
}

describe('createCartesianModel', () => {
  test('stacked area points accumulate visible series offsets', () => {
    const model = createCartesianModel({
      componentId: 'area-chart',
      series: [
        {
          id: 'first',
          label: 'First',
          data: [
            { x: 'Jan', y: 10 },
            { x: 'Feb', y: 20 },
          ],
        },
        {
          id: 'second',
          label: 'Second',
          data: [
            { x: 'Jan', y: 5 },
            { x: 'Feb', y: 15 },
          ],
        },
      ],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
      stackedArea: true,
    });

    const [first, second] = model.normalizedSeries;
    expect(model.yDomain[1]).toBeGreaterThan(30);
    expect(first?.points[0]?.pixelY).toBeGreaterThan(second?.points[0]?.pixelY ?? 0);
    expect(first?.areaPath).not.toBe('');
    expect(second?.areaPath).not.toBe('');
  });

  test('stacked decimation shares x positions and preserves adjacent boundaries', () => {
    const data = Array.from({ length: 2_101 }, (_, index) => ({
      x: index,
      y: index % 11 === 0 ? 20 : 2,
    }));
    const model = createCartesianModel({
      componentId: 'area-chart',
      series: [
        { id: 'base', label: 'Base', data },
        {
          id: 'top',
          label: 'Top',
          data: data.map((point) => ({ x: point.x, y: point.y / 2 })),
        },
      ],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
      stackedArea: true,
    });
    const [base, top] = model.normalizedSeries;
    const baseKeys = base?.points.map((point) => point.x.key) ?? [];
    const topKeys = top?.points.map((point) => point.x.key) ?? [];

    expect(baseKeys).toEqual(topKeys);
    expect(baseKeys.length).toBeLessThanOrEqual(2_000);
    expect(base?.points[1]?.pixelY).toBeGreaterThan(top?.points[1]?.pixelY ?? Infinity);
  });

  test('stacked decimation preserves extrema from every cumulative layer boundary', () => {
    const model = createCartesianModel({
      componentId: 'area-chart',
      series: [
        {
          id: 'redistributed',
          label: 'Redistributed',
          data: Array.from({ length: 2_101 }, (_, index) => ({
            x: index,
            y: index === 1_000 ? 100 : 0,
          })),
        },
        {
          id: 'remainder',
          label: 'Remainder',
          data: Array.from({ length: 2_101 }, (_, index) => ({
            x: index,
            y: index === 1_000 ? 0 : 100,
          })),
        },
      ],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
      stackedArea: true,
    });
    const [redistributed, remainder] = model.normalizedSeries;
    const redistributedKeys = redistributed?.points.map((point) => point.x.key) ?? [];

    expect(redistributed?.points.some((point) => point.x.raw === 1_000)).toBe(true);
    expect(remainder?.points.map((point) => point.x.key)).toEqual(redistributedKeys);
    expect(redistributedKeys.length).toBeLessThanOrEqual(2_000);
  });

  test('stacked render points exclude x values owned only by hidden series', () => {
    const model = createCartesianModel({
      componentId: 'area-chart',
      series: [
        {
          id: 'visible',
          label: 'Visible',
          data: [
            { x: 0, y: 1 },
            { x: 2, y: 2 },
          ],
        },
        { id: 'hidden', label: 'Hidden', data: [{ x: 1, y: 4 }] },
      ],
      hiddenSeriesIds: ['hidden'],
      width: 640,
      height: 280,
      stackedArea: true,
    });
    const visible = model.normalizedSeries.find((item) => item.id === 'visible');

    expect(visible?.points.map((point) => point.x.raw)).toEqual([0, 2]);
    expect(visible?.areaPath.match(/M/g)).toHaveLength(1);
  });

  test('stacked render points retain explicit null gaps from visible series', () => {
    const model = createCartesianModel({
      componentId: 'area-chart',
      series: [
        {
          id: 'visible',
          label: 'Visible',
          data: [
            { x: 0, y: 1 },
            { x: 1, y: null },
            { x: 2, y: 2 },
          ],
        },
      ],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
      stackedArea: true,
    });
    const visible = model.normalizedSeries[0];

    expect(visible?.points.map((point) => point.y)).toEqual([1, null, 2]);
    expect(visible?.areaPath.match(/M/g)).toHaveLength(2);
  });

  test('stacked decimation preserves separated null runs that share a bucket', () => {
    const gapIndices = [4_992, 4_995];
    const model = createCartesianModel({
      componentId: 'area-chart',
      series: [
        {
          id: 'visible',
          label: 'Visible',
          data: Array.from({ length: 10_000 }, (_, index) => ({
            x: index,
            y: gapIndices.includes(index) ? null : index % 2 === 0 ? 1 : 2,
          })),
        },
      ],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
      stackedArea: true,
    });
    const visible = model.normalizedSeries[0];

    expect(visible?.points.length).toBeLessThanOrEqual(2_000);
    expect(
      visible?.points.filter(
        (point) => gapIndices.includes(Number(point.x.raw)) && point.y === null,
      ),
    ).toHaveLength(2);
    expect(visible?.areaPath.match(/M/g)).toHaveLength(3);
  });

  test('gap-heavy stacked decimation stays bounded with shared synthetic breaks', () => {
    const model = createCartesianModel({
      componentId: 'area-chart',
      series: [
        {
          id: 'even',
          label: 'Even',
          data: Array.from({ length: 10_000 }, (_, index) => ({
            x: index,
            y: index % 2 === 0 ? 1 : null,
          })),
        },
        {
          id: 'odd',
          label: 'Odd',
          data: Array.from({ length: 10_000 }, (_, index) => ({
            x: index,
            y: index % 2 === 1 ? 1 : null,
          })),
        },
        {
          id: 'continuous',
          label: 'Continuous',
          data: Array.from({ length: 10_000 }, (_, index) => ({ x: index, y: 1 })),
        },
      ],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
      stackedArea: true,
    });
    const [even, odd, continuous] = model.normalizedSeries;

    expect(even?.points.length).toBeLessThanOrEqual(2_000);
    expect(odd?.points.map((point) => point.x.key)).toEqual(
      even?.points.map((point) => point.x.key),
    );
    expect(continuous?.points.map((point) => point.x.key)).toEqual(
      even?.points.map((point) => point.x.key),
    );
    expectSeparatedFiniteRuns(even);
    expectSeparatedFiniteRuns(odd);
    expect(continuous?.points.every((point) => point.y !== null)).toBe(true);
    expect(continuous?.areaPath).toContain('L');
  });

  test('gap-heavy stacked decimation preserves continuous sibling extrema', () => {
    const model = createCartesianModel({
      componentId: 'area-chart',
      series: [
        {
          id: 'gap-trigger',
          label: 'Gap trigger',
          data: Array.from({ length: 10_000 }, (_, index) => ({
            x: index,
            y: index % 2 === 0 ? 1 : null,
          })),
        },
        {
          id: 'continuous',
          label: 'Continuous',
          data: Array.from({ length: 10_000 }, (_, index) => ({
            x: index,
            y: index === 3 ? 1_000 : 1,
          })),
        },
      ],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
      stackedArea: true,
    });
    const continuous = model.normalizedSeries[1];

    expect(continuous?.points.length).toBeLessThanOrEqual(2_000);
    expect(continuous?.points.some((point) => point.x.raw === 3 && point.originalY === 1_000)).toBe(
      true,
    );
  });

  test('rechecks every stacked layer after inserting shared synthetic breaks', () => {
    const lateGapData = Array.from({ length: 10_000 }, (_, index) => ({
      x: index,
      y: index === 0 || index === 7 ? null : 1,
    }));
    const model = createCartesianModel({
      componentId: 'area-chart',
      series: [
        {
          id: 'gap-trigger',
          label: 'Gap trigger',
          data: Array.from({ length: 10_000 }, (_, index) => ({
            x: index,
            y: index % 2 === 0 ? 1 : null,
          })),
        },
        { id: 'late-gap', label: 'Late gap', data: lateGapData },
        {
          id: 'continuous',
          label: 'Continuous',
          data: Array.from({ length: 10_000 }, (_, index) => ({ x: index, y: 1 })),
        },
      ],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
      stackedArea: true,
    });
    const lateGapPoints = model.normalizedSeries[1]?.points ?? [];

    for (let index = 1; index < lateGapPoints.length; index++) {
      const previousPoint = lateGapPoints[index - 1];
      const currentPoint = lateGapPoints[index];
      if (!previousPoint || !currentPoint || previousPoint.y === null || currentPoint.y === null) {
        continue;
      }
      const previousSourceIndex = Number(previousPoint.x.raw);
      const currentSourceIndex = Number(currentPoint.x.raw);
      const omittedNull = lateGapData
        .slice(previousSourceIndex + 1, currentSourceIndex)
        .some((point) => point.y === null);
      expect(omittedNull).toBe(false);
    }
  });
});
