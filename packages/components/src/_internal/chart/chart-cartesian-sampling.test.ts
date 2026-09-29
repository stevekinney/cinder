import { describe, expect, test } from 'bun:test';

import {
  MAXIMUM_RENDERED_SERIES_POINTS,
  createCartesianModel,
  decimatePlacedPoints,
  decimationIndices,
  normalizeXValue,
  type PlacedPoint,
} from './chart-utilities.ts';

describe('createCartesianModel', () => {
  test('decimates rendering geometry above 2000 points without truncating semantic data', () => {
    const data = Array.from({ length: 2_501 }, (_, index) => ({ x: index, y: index % 17 }));
    const model = createCartesianModel({
      componentId: 'line-chart',
      series: [{ id: 'dense', label: 'Dense', data }],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
    });
    const renderedPoints = model.normalizedSeries[0]?.points ?? [];

    expect(renderedPoints.length).toBeLessThanOrEqual(2_000);
    expect(renderedPoints[0]?.x.raw).toBe(0);
    expect(renderedPoints.at(-1)?.x.raw).toBe(2_500);
    expect(model.targets).toHaveLength(2_501);
    expect(model.tableRows).toHaveLength(2_000);
    expect(model.xTicks).toHaveLength(8);
  });

  test('preserves every visible series in a sampled semantic table', () => {
    const denseData = Array.from({ length: 2_000 }, (_, index) => ({ x: index, y: index }));
    const model = createCartesianModel({
      componentId: 'line-chart',
      series: [
        { id: 'before', label: 'Before', data: denseData },
        { id: 'tiny', label: 'Tiny', data: [{ x: 0, y: 1 }] },
        { id: 'after', label: 'After', data: denseData },
      ],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
    });

    expect(model.tableRows).toHaveLength(2_000);
    expect(new Set(model.tableRows.map((row) => row.seriesId))).toEqual(
      new Set(['before', 'tiny', 'after']),
    );
  });

  test('caps sampled rows at one per series when the series count alone meets the row cap', () => {
    // When there are at least as many distinct series as the row cap, the
    // proportional-allocation path never runs — each series can contribute at
    // most one row, so the sampler takes the first row of each series and
    // stops, rather than trying to divide remaining capacity across series.
    const seriesCount = MAXIMUM_RENDERED_SERIES_POINTS;
    const series = Array.from({ length: seriesCount }, (_, index) => ({
      id: `series-${index}`,
      label: `Series ${index}`,
      data: [
        { x: 0, y: index },
        { x: 1, y: index + 1 },
      ],
    }));
    const model = createCartesianModel({
      componentId: 'line-chart',
      series,
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
    });

    expect(model.tableRows).toHaveLength(seriesCount);
    expect(new Set(model.tableRows.map((row) => row.seriesId)).size).toBe(seriesCount);
  });

  test('decimation preserves endpoints, separated spikes/dips, null gaps, and the bound', () => {
    const points: PlacedPoint[] = Array.from({ length: 101 }, (_, index) => ({
      seriesId: 'dense',
      seriesLabel: 'Dense',
      color: 'red',
      x: normalizeXValue(index),
      y: index === 12 ? 1_000 : index === 76 ? -1_000 : index === 50 ? null : 0,
      originalY:
        index === 50 ? null : index === 0 ? 0 : index === 12 ? 1_000 : index === 76 ? -1_000 : 0,
      index,
      pixelX: index,
      pixelY: index,
      pixelY0: 100,
    }));

    const decimated = decimatePlacedPoints(points, 20);
    const rawValues = decimated.map((point) => point.y);

    expect(decimated.length).toBeLessThanOrEqual(20);
    expect(decimated[0]?.x.raw).toBe(0);
    expect(decimated.at(-1)?.x.raw).toBe(100);
    expect(rawValues).toContain(1_000);
    expect(rawValues).toContain(-1_000);
    expect(rawValues).toContain(null);

    const model = createCartesianModel({
      componentId: 'area-chart',
      series: [
        {
          id: 'dense',
          label: 'Dense',
          data: points.map((point) => ({ x: point.x.raw, y: point.y })),
        },
      ],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
    });
    expect(model.normalizedSeries[0]?.areaPath.match(/M/g)).toHaveLength(2);
  });

  test('decimation retains a structural null when every bucket also has distinct extrema', () => {
    const gapIndex = 4_995;
    const points: PlacedPoint[] = Array.from({ length: 10_000 }, (_, index) => {
      const value = index === gapIndex ? null : index % 2 === 0 ? -1 : 1;
      return {
        seriesId: 'dense',
        seriesLabel: 'Dense',
        color: 'red',
        x: normalizeXValue(index),
        y: value,
        originalY: value,
        index,
        pixelX: index,
        pixelY: index,
        pixelY0: 100,
      };
    });

    const decimated = decimatePlacedPoints(points);

    expect(decimated.length).toBeLessThanOrEqual(2_000);
    expect(decimated.some((point) => point.x.raw === gapIndex && point.y === null)).toBe(true);
  });

  test('decimation preserves separated null runs that share a bucket', () => {
    const gapIndices = [4_992, 4_995];
    const points: PlacedPoint[] = Array.from({ length: 10_000 }, (_, index) => {
      const value = gapIndices.includes(index) ? null : index % 2 === 0 ? -1 : 1;
      return {
        seriesId: 'dense',
        seriesLabel: 'Dense',
        color: 'red',
        x: normalizeXValue(index),
        y: value,
        originalY: value,
        index,
        pixelX: index,
        pixelY: index,
        pixelY0: 100,
      };
    });

    const decimated = decimatePlacedPoints(points);

    expect(decimated.length).toBeLessThanOrEqual(2_000);
    expect(
      decimated.filter((point) => gapIndices.includes(Number(point.x.raw)) && point.y === null),
    ).toHaveLength(2);
    expect(
      decimated.some(
        (point) => Number(point.x.raw) > gapIndices[0]! && Number(point.x.raw) < gapIndices[1]!,
      ),
    ).toBe(true);
  });

  test('gap-heavy decimation remains bounded without connecting sampled finite runs', () => {
    const points: PlacedPoint[] = Array.from({ length: 100_000 }, (_, index) => {
      const value = index % 2 === 0 ? index : null;
      return {
        seriesId: 'dense',
        seriesLabel: 'Dense',
        color: 'red',
        x: normalizeXValue(index),
        y: value,
        originalY: value,
        index,
        pixelX: index,
        pixelY: index,
        pixelY0: 100,
      };
    });

    const decimated = decimatePlacedPoints(points);

    expect(decimated.length).toBeLessThanOrEqual(2_000);
    expect(decimated[0]?.x.raw).toBe(0);
    expect(decimated.filter((point) => point.y !== null)).toHaveLength(1_000);
    for (let index = 1; index < decimated.length; index++) {
      expect(decimated[index - 1]?.y === null || decimated[index]?.y === null).toBe(true);
    }
  });

  test('gap-heavy decimation re-picks the run representative when a later point has larger magnitude', () => {
    // All-finite, no nulls: the entire series is one "finite run". A tiny
    // maximumPoints (below what the extrema-bucket budget needs) forces the
    // gap-heavy path even though nothing is null, so the run's representative
    // reassignment loop actually walks multiple consecutive finite points.
    const points: PlacedPoint[] = [1, 10, 3, 2].map((value, index) => ({
      seriesId: 'dense',
      seriesLabel: 'Dense',
      color: 'red',
      x: normalizeXValue(index),
      y: value,
      originalY: value,
      index,
      pixelX: index,
      pixelY: index,
      pixelY0: 100,
    }));

    const indices = decimationIndices(points, 3);

    // The run's representative must be the largest-magnitude point (index 1,
    // value 10) — not simply the first point in the run (index 0).
    expect(indices).toEqual([1]);
  });
});
