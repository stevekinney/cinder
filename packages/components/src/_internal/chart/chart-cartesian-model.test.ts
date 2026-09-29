import { describe, expect, test } from 'bun:test';

import { createCartesianModel } from './chart-utilities.ts';

describe('createCartesianModel', () => {
  test('produces an empty model for empty series', () => {
    const model = createCartesianModel({
      componentId: 'line-chart',
      series: [],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
    });
    expect(model.empty).toBe(true);
    expect(model.targets).toHaveLength(0);
    expect(model.xTicks).toHaveLength(0);
  });

  test('uses a non-zero y-domain when no visible y values exist', () => {
    const model = createCartesianModel({
      componentId: 'line-chart',
      series: [
        {
          id: 's',
          label: 'S',
          data: [
            { x: 'Jan', y: null },
            { x: 'Feb', y: undefined },
          ],
        },
      ],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
    });
    expect(model.yDomain).toEqual([-1, 1]);
    for (const tick of model.yTicks) {
      const y =
        model.geometry.plotHeight -
        ((tick - model.yDomain[0]) / (model.yDomain[1] - model.yDomain[0])) *
          model.geometry.plotHeight;
      expect(Number.isFinite(y)).toBe(true);
    }
  });

  test('uses a non-zero y-domain when every series is hidden', () => {
    const model = createCartesianModel({
      componentId: 'area-chart',
      series: [
        {
          id: 's',
          label: 'S',
          data: [
            { x: 'Jan', y: 10 },
            { x: 'Feb', y: 20 },
          ],
        },
      ],
      hiddenSeriesIds: ['s'],
      width: 640,
      height: 280,
      stackedArea: true,
    });
    expect(model.yDomain).toEqual([-1, 1]);
    for (const tick of model.yTicks) {
      const y =
        model.geometry.plotHeight -
        ((tick - model.yDomain[0]) / (model.yDomain[1] - model.yDomain[0])) *
          model.geometry.plotHeight;
      expect(Number.isFinite(y)).toBe(true);
    }
  });

  test('surfaces pixel coordinates on placed points', () => {
    const model = createCartesianModel({
      componentId: 'line-chart',
      series: [
        {
          id: 's',
          label: 'S',
          data: [
            { x: 'Jan', y: 10 },
            { x: 'Feb', y: 20 },
          ],
        },
      ],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
    });
    const [first] = model.normalizedSeries;
    expect(first).toBeDefined();
    expect(first?.points.length).toBe(2);
    for (const point of first?.points ?? []) {
      expect(Number.isFinite(point.pixelX)).toBe(true);
      expect(Number.isFinite(point.pixelY)).toBe(true);
      expect(point.pixelY0).toBe(model.geometry.plotHeight);
    }
  });

  test('places unstacked area baselines at the zero line for mixed-sign data', () => {
    const model = createCartesianModel({
      componentId: 'area-chart',
      series: [
        {
          id: 'change',
          label: 'Change',
          data: [
            { x: 'loss', y: -5 },
            { x: 'gain', y: 5 },
          ],
        },
      ],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
    });
    const expectedZero =
      model.geometry.plotHeight -
      ((0 - model.yDomain[0]) / (model.yDomain[1] - model.yDomain[0])) * model.geometry.plotHeight;

    for (const point of model.normalizedSeries[0]?.points ?? []) {
      expect(point.pixelY0).toBeCloseTo(expectedZero);
    }
    expect(expectedZero).toBeGreaterThan(0);
    expect(expectedZero).toBeLessThan(model.geometry.plotHeight);
  });

  test('creates stable paths for a single-point series', () => {
    const model = createCartesianModel({
      componentId: 'area-chart',
      series: [
        {
          id: 'visits',
          label: 'Visits',
          data: [{ x: 'Jan', y: 10 }],
        },
      ],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
    });
    const [series] = model.normalizedSeries;
    expect(series?.path).toStartWith('M');
    expect(series?.areaPath).toContain('Z');
  });

  test('keeps string-domain points in insertion order (no NaN sort)', () => {
    const model = createCartesianModel({
      componentId: 'line-chart',
      series: [
        {
          id: 's',
          label: 'S',
          data: [
            { x: 'Mar', y: 30 },
            { x: 'Jan', y: 10 },
            { x: 'Feb', y: 20 },
          ],
        },
      ],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
    });
    const [first] = model.normalizedSeries;
    const labels = first?.points.map((point) => point.x.label);
    expect(labels).toEqual(['Mar', 'Jan', 'Feb']);
  });

  test('targets are sorted by x (binary-search precondition)', () => {
    const model = createCartesianModel({
      componentId: 'line-chart',
      series: [
        {
          id: 's',
          label: 'S',
          data: [
            { x: 100, y: 1 },
            { x: 0, y: 2 },
            { x: 50, y: 3 },
          ],
        },
      ],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
    });
    const xs = model.targets.map((target) => target.x);
    expect(xs).toEqual([...xs].toSorted((a, b) => a - b));
  });

  test('hidden series do not contribute to the y-domain', () => {
    const modelAll = createCartesianModel({
      componentId: 'line-chart',
      series: [
        { id: 'small', label: 'Small', data: [{ x: 'Jan', y: 5 }] },
        { id: 'huge', label: 'Huge', data: [{ x: 'Jan', y: 1_000_000 }] },
      ],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
    });
    const modelHidden = createCartesianModel({
      componentId: 'line-chart',
      series: [
        { id: 'small', label: 'Small', data: [{ x: 'Jan', y: 5 }] },
        { id: 'huge', label: 'Huge', data: [{ x: 'Jan', y: 1_000_000 }] },
      ],
      hiddenSeriesIds: ['huge'],
      width: 640,
      height: 280,
    });
    expect(modelAll.yDomain[1]).toBeGreaterThan(modelHidden.yDomain[1]);
  });

  test('returns the shared scene contract and internal mark descriptors', () => {
    const model = createCartesianModel({
      componentId: 'line-chart',
      series: [{ id: 'usage', label: 'Usage', data: [{ x: 'Jan', y: 10 }] }],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
    });

    expect(model).toMatchObject({
      geometry: expect.any(Object),
      targets: expect.any(Array),
      tableRows: expect.any(Array),
      empty: false,
    });
    expect(model.marks).toEqual([
      {
        seriesId: 'usage',
        descriptors: [
          { type: 'line', data: [{ x: 'Jan', y: 10 }] },
          { type: 'point', data: [{ x: 'Jan', y: 10 }] },
        ],
      },
    ]);
  });

  test('keeps target identity stable when only a value changes', () => {
    const options = {
      componentId: 'line-chart' as const,
      hiddenSeriesIds: [] as string[],
      width: 640,
      height: 280,
    };
    const before = createCartesianModel({
      ...options,
      series: [
        {
          id: 'usage',
          label: 'Usage',
          data: [
            { x: 'Jan', y: 10 },
            { x: 'Feb', y: 20 },
          ],
        },
      ],
    });
    const after = createCartesianModel({
      ...options,
      series: [
        {
          id: 'usage',
          label: 'Usage',
          data: [
            { x: 'Jan', y: 15 },
            { x: 'Feb', y: 20 },
          ],
        },
      ],
    });

    expect(after.targets[0]?.id).toBe(before.targets[0]?.id);
    expect(after.targets[0]?.valueLabel).toBe('15');
    expect(after.targets[0]?.y).not.toBe(before.targets[0]?.y);
  });
});
