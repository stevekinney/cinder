import { describe, expect, spyOn, test } from 'bun:test';
import type { ChartXAxisConfiguration } from '../../components/chart.types.ts';

import {
  assertUniqueSeriesIds,
  assertValidChartNumber,
  assertValidNonNegativeInteger,
  assertValidTickCount,
  chartPalette,
  chartPaletteColor,
  chartResourceId,
  createBarModel,
  createCartesianModel,
  createChartGeometry,
  dataTableClass,
  decimatePlacedPoints,
  formatNumericValue,
  formatXValue,
  legendVisible,
  nearestTarget,
  normalizeXValue,
  resolveChartTheme,
  toggleSeriesId,
  type ChartTarget,
  type PlacedPoint,
} from './chart-utilities.ts';

describe('chartPaletteColor', () => {
  test('returns the palette color at the given index', () => {
    expect(chartPaletteColor(0)).toBe(chartPalette[0]);
    expect(chartPaletteColor(3)).toBe(chartPalette[3]);
  });

  test('wraps around the palette for indices past the end', () => {
    expect(chartPaletteColor(chartPalette.length)).toBe(chartPalette[0]);
    expect(chartPaletteColor(chartPalette.length + 2)).toBe(chartPalette[2]);
  });

  test('falls back to the first palette color for negative indices', () => {
    expect(chartPaletteColor(-1)).toBe(chartPalette[0]);
  });

  test('wraps through a chart-local palette override', () => {
    const palette = ['rebeccapurple', 'tomato'];

    expect(chartPaletteColor(0, palette)).toBe('rebeccapurple');
    expect(chartPaletteColor(3, palette)).toBe('tomato');
  });
});

describe('createChartGeometry', () => {
  test('reserves top space for matrix-style header labels', () => {
    const geometry = createChartGeometry(640, 280, {
      xTickLabels: ['A very long header'],
      yTickLabels: ['Row'],
      xTickPosition: 'top',
    });
    expect(geometry.marginTop).toBeGreaterThan(geometry.marginBottom);
  });

  test('rejects non-finite tick rotations', () => {
    expect(() =>
      createChartGeometry(640, 280, {
        xAxis: { tickLabelRotation: Number.NaN } as ChartXAxisConfiguration,
      }),
    ).toThrow('invalid-tick-label-rotation');
  });

  test('reserves endpoint side space for rotated labels', () => {
    const geometry = createChartGeometry(640, 280, {
      xTickLabels: ['2026-01-01T00:00:00.000Z'],
      xAxis: { tickLabelRotation: 45 },
    });
    expect(geometry.marginRight).toBeGreaterThan(16);
    expect(geometry.marginLeft).toBeGreaterThanOrEqual(geometry.marginRight);
  });

  test('reserves endpoint side space for wide unrotated labels', () => {
    const geometry = createChartGeometry(640, 280, {
      xTickLabels: ['2026-01-01T00:00:00.000Z'],
    });

    expect(geometry.marginRight).toBeGreaterThan(16);
    expect(geometry.marginLeft).toBeGreaterThanOrEqual(geometry.marginRight);
  });

  test('batches browser text measurement into one hidden SVG', () => {
    const measurementElement = document.createElement('figure');
    measurementElement.style.setProperty('--cinder-text-xs', '12px');
    document.body.append(measurementElement);
    const append = spyOn(measurementElement, 'append');
    try {
      createChartGeometry(640, 280, {
        xTickLabels: ['review-batch-x-1', 'review-batch-x-2'],
        yTickLabels: ['review-batch-y-1', 'review-batch-y-2'],
        xAxis: { label: 'review-batch-x-title', tickLabelRotation: 30 },
        yAxis: { label: 'review-batch-y-title' },
        measureText: true,
        measurementElement,
      });
      expect(append).toHaveBeenCalledTimes(1);

      measurementElement.style.setProperty('--cinder-text-xs', '24px');
      createChartGeometry(640, 280, {
        xTickLabels: ['review-batch-x-1', 'review-batch-x-2'],
        yTickLabels: ['review-batch-y-1', 'review-batch-y-2'],
        xAxis: { label: 'review-batch-x-title', tickLabelRotation: 30 },
        yAxis: { label: 'review-batch-y-title' },
        measureText: true,
        measurementElement,
      });
      expect(append).toHaveBeenCalledTimes(2);
    } finally {
      append.mockRestore();
      measurementElement.remove();
    }
  });

  test('bounds browser text measurement caching and evicts the oldest entry', () => {
    const measurementElement = document.createElement('figure');
    measurementElement.style.setProperty('--cinder-text-xs', '12px');
    document.body.append(measurementElement);
    const append = spyOn(measurementElement, 'append');
    const svgTextElementPrototype = globalThis.SVGTextElement.prototype;
    const originalGetBoundingBox = Object.getOwnPropertyDescriptor(
      svgTextElementPrototype,
      'getBBox',
    );
    Object.defineProperty(svgTextElementPrototype, 'getBBox', {
      configurable: true,
      value: () => ({ x: 0, y: 0, width: 10, height: 10 }),
    });
    const labels = Array.from({ length: 1_025 }, (_, index) => `cache-eviction-${index}`);

    try {
      createChartGeometry(640, 280, {
        xTickLabels: labels,
        measureText: true,
        measurementElement,
      });
      expect(append).toHaveBeenCalledTimes(1);

      createChartGeometry(640, 280, {
        xTickLabels: [labels[0]!],
        measureText: true,
        measurementElement,
      });
      expect(append).toHaveBeenCalledTimes(2);
    } finally {
      append.mockRestore();
      if (originalGetBoundingBox) {
        Object.defineProperty(svgTextElementPrototype, 'getBBox', originalGetBoundingBox);
      } else {
        Reflect.deleteProperty(svgTextElementPrototype, 'getBBox');
      }
      measurementElement.remove();
    }
  });
});

describe('chartResourceId', () => {
  test('keeps URI-escaped series IDs collision-free', () => {
    const slash = chartResourceId('chart', 'gradient', 'a/b');
    const escaped = chartResourceId('chart', 'gradient', 'a_2Fb');

    expect(slash).toBe('chart-gradient-a_x2Fb');
    expect(escaped).toBe('chart-gradient-a_u2Fb');
    expect(slash).not.toBe(escaped);
  });

  test('escapes functional-IRI characters in the chart prefix', () => {
    expect(chartResourceId('usage)', 'gradient', 'series')).toBe('usage_x29-gradient-series');
    expect(chartResourceId('usage_x29', 'gradient', 'series')).toBe('usage_ux29-gradient-series');
  });

  test('escapes tuple delimiters without collapsing distinct resource ids', () => {
    const delimiterInSeries = chartResourceId('a', 'gradient', 'b-gradient-c');
    const delimiterInPrefix = chartResourceId('a-gradient-b', 'gradient', 'c');

    expect(delimiterInSeries).toBe('a-gradient-b_dgradient_dc');
    expect(delimiterInPrefix).toBe('a_dgradient_db-gradient-c');
    expect(delimiterInSeries).not.toBe(delimiterInPrefix);
  });
});

describe('resolveChartTheme', () => {
  test('inherits currentColor and the CSS-variable palette by default', () => {
    expect(resolveChartTheme()).toEqual({
      foreground: 'currentColor',
      muted: 'currentColor',
      grid: 'currentColor',
      background: 'transparent',
      palette: [...chartPalette],
    });
  });

  test('merges a partial override without replacing omitted defaults', () => {
    expect(resolveChartTheme({ foreground: 'CanvasText', palette: ['hotpink'] })).toEqual({
      foreground: 'CanvasText',
      muted: 'currentColor',
      grid: 'currentColor',
      background: 'transparent',
      palette: ['hotpink'],
    });
  });
});

describe('normalizeXValue', () => {
  test('classifies string values', () => {
    const value = normalizeXValue('Jan');
    expect(value.kind).toBe('string');
    expect(value.key).toBe('string:Jan');
    expect(value.label).toBe('Jan');
    expect(value.comparable).toBe('Jan');
  });

  test('classifies number values', () => {
    const value = normalizeXValue(42);
    expect(value.kind).toBe('number');
    expect(value.key).toBe('number:42');
    expect(value.label).toBe('42');
    expect(value.comparable).toBe(42);
  });

  test('classifies Date values by epoch milliseconds', () => {
    const date = new Date('2025-01-15T00:00:00Z');
    const value = normalizeXValue(date);
    expect(value.kind).toBe('date');
    expect(value.comparable).toBe(date.getTime());
    expect(value.key).toBe(`date:${date.getTime()}`);
  });
});

describe('formatNumericValue', () => {
  test('uses a series-level formatter when provided', () => {
    const result = formatNumericValue(100, undefined, (value) => `series:${value}`, { index: 0 });
    expect(result).toBe('series:100');
  });

  test('falls back to the axis formatter when no series formatter exists', () => {
    const result = formatNumericValue(
      50,
      { format: (value) => `axis:${String(value)}` },
      undefined,
      { index: 0 },
    );
    expect(result).toBe('axis:50');
  });

  test('defaults to Intl.NumberFormat with the inherited locale', () => {
    // Tests run with LANG=en_US.UTF-8 so the inherited locale yields the
    // en-US grouping/decimal we can assert against.
    expect(formatNumericValue(1234.5, undefined, undefined, { index: 0 })).toBe('1,234.5');
  });
});

describe('formatXValue', () => {
  test('uses the axis formatter when provided', () => {
    const value = normalizeXValue('Jan');
    expect(formatXValue(value, { format: () => 'January' }, { index: 0 })).toBe('January');
  });

  test('falls back to the normalized label otherwise', () => {
    const value = normalizeXValue(7);
    expect(formatXValue(value, undefined, { index: 0 })).toBe('7');
  });
});

describe('assertValidChartNumber', () => {
  test('accepts positive finite numbers', () => {
    expect(() => assertValidChartNumber('demo', 'rule', 1, 'value')).not.toThrow();
    expect(() => assertValidChartNumber('demo', 'rule', 1024.5, 'value')).not.toThrow();
  });

  test('throws on zero, negative, or non-finite values', () => {
    expect(() => assertValidChartNumber('demo', 'rule', 0, 'value')).toThrow('rule=rule');
    expect(() => assertValidChartNumber('demo', 'rule', -1, 'value')).toThrow();
    expect(() => assertValidChartNumber('demo', 'rule', Number.NaN, 'value')).toThrow();
    expect(() => assertValidChartNumber('demo', 'rule', Infinity, 'value')).toThrow();
  });
});

describe('assertValidNonNegativeInteger', () => {
  test('accepts zero and positive integers', () => {
    expect(() => assertValidNonNegativeInteger('demo', 'rule', 0, 'value')).not.toThrow();
    expect(() => assertValidNonNegativeInteger('demo', 'rule', 500, 'value')).not.toThrow();
  });

  test('throws on negative or non-integer values', () => {
    expect(() => assertValidNonNegativeInteger('demo', 'rule', -1, 'value')).toThrow();
    expect(() => assertValidNonNegativeInteger('demo', 'rule', 1.5, 'value')).toThrow();
  });
});

describe('assertValidTickCount', () => {
  test('is a no-op when the axis or tickCount is missing', () => {
    expect(() => assertValidTickCount('demo')).not.toThrow();
    expect(() => assertValidTickCount('demo', {})).not.toThrow();
  });

  test('throws on zero, negative, or non-integer tickCount', () => {
    expect(() => assertValidTickCount('demo', { tickCount: 0 })).toThrow('invalid-tick-count');
    expect(() => assertValidTickCount('demo', { tickCount: -1 })).toThrow();
    expect(() => assertValidTickCount('demo', { tickCount: 1.5 })).toThrow();
  });
});

describe('assertUniqueSeriesIds', () => {
  test('passes for distinct ids', () => {
    expect(() => assertUniqueSeriesIds('demo', [{ id: 'a' }, { id: 'b' }])).not.toThrow();
  });

  test('throws on duplicates', () => {
    expect(() => assertUniqueSeriesIds('demo', [{ id: 'a' }, { id: 'a' }])).toThrow(
      'duplicate-series-id',
    );
  });
});

describe('dataTableClass', () => {
  test('maps "screen-reader-only" to the sr-only class', () => {
    expect(dataTableClass('screen-reader-only')).toBe('cinder-sr-only');
  });

  test('returns undefined for visible and hidden', () => {
    expect(dataTableClass('visible')).toBeUndefined();
    expect(dataTableClass('hidden')).toBeUndefined();
  });
});

describe('legendVisible', () => {
  test('returns true when the position is renderable and any series exist', () => {
    expect(legendVisible('top', 1)).toBe(true);
    expect(legendVisible('bottom', 4)).toBe(true);
  });

  test('returns false for "none" or zero series', () => {
    expect(legendVisible('none', 3)).toBe(false);
    expect(legendVisible('top', 0)).toBe(false);
  });
});

describe('toggleSeriesId', () => {
  test('adds a missing id', () => {
    expect(toggleSeriesId([], 'a')).toEqual(['a']);
  });

  test('removes a present id', () => {
    expect(toggleSeriesId(['a', 'b'], 'a')).toEqual(['b']);
  });

  test('returns a new array (no mutation)', () => {
    const input = ['a'];
    const output = toggleSeriesId(input, 'b');
    expect(output).not.toBe(input);
    expect(input).toEqual(['a']);
  });
});

function buildTargets(points: Array<{ x: number; y: number }>): ChartTarget[] {
  return points.map((point, index) => ({
    id: `t-${index}`,
    seriesId: 's',
    seriesLabel: 'Series',
    xLabel: `${point.x}`,
    valueLabel: `${point.y}`,
    x: point.x,
    y: point.y,
    color: 'red',
  }));
}

describe('nearestTarget', () => {
  test('returns undefined for empty targets', () => {
    expect(nearestTarget([], 10, 10)).toBeUndefined();
  });

  test('returns the only target when targets.length === 1', () => {
    const targets = buildTargets([{ x: 50, y: 50 }]);
    expect(nearestTarget(targets, 999, -999)?.id).toBe('t-0');
  });

  test('finds the closest target by x (binary search)', () => {
    const targets = buildTargets([
      { x: 0, y: 100 },
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 300, y: 100 },
    ]);
    expect(nearestTarget(targets, 95, 100)?.id).toBe('t-1');
    expect(nearestTarget(targets, 210, 100)?.id).toBe('t-2');
    expect(nearestTarget(targets, -50, 100)?.id).toBe('t-0');
    expect(nearestTarget(targets, 500, 100)?.id).toBe('t-3');
  });

  test('compares adjacent x buckets when the pointer is between them', () => {
    const targets = buildTargets([
      { x: 0, y: 100 },
      { x: 100, y: 100 },
    ]);

    expect(nearestTarget(targets, 40, 100)?.id).toBe('t-0');
    expect(nearestTarget(targets, 60, 100)?.id).toBe('t-1');
  });

  test('breaks 1-D ties using full Euclidean distance', () => {
    const targets = buildTargets([
      { x: 100, y: 0 },
      { x: 100, y: 200 },
    ]);
    // Both share x=100; closer in y wins.
    expect(nearestTarget(targets, 100, 10)?.id).toBe('t-0');
    expect(nearestTarget(targets, 100, 190)?.id).toBe('t-1');
  });

  test('compares the previous distinct x bucket when duplicate targets straddle the boundary', () => {
    const targets = buildTargets([
      { x: 0, y: 10 },
      { x: 100, y: 500 },
      { x: 100, y: 600 },
      { x: 200, y: 10 },
    ]);

    expect(nearestTarget(targets, 150, 10)?.id).toBe('t-3');
  });

  test('supports searching on the y axis for horizontal layouts', () => {
    const targets = buildTargets([
      { x: 50, y: 0 },
      { x: 50, y: 100 },
      { x: 50, y: 200 },
    ]);
    expect(nearestTarget(targets, 50, 90, 'y')?.id).toBe('t-1');
    expect(nearestTarget(targets, 50, 210, 'y')?.id).toBe('t-2');
  });

  test('compares adjacent y buckets when the pointer is between them', () => {
    const targets = buildTargets([
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ]);

    expect(nearestTarget(targets, 50, 40, 'y')?.id).toBe('t-0');
    expect(nearestTarget(targets, 50, 60, 'y')?.id).toBe('t-1');
  });
});

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

  test('rejects negative values in stacked-area mode', () => {
    expect(() =>
      createCartesianModel({
        componentId: 'area-chart',
        series: [{ id: 's', label: 'S', data: [{ x: 'Jan', y: -1 }] }],
        hiddenSeriesIds: [],
        width: 640,
        height: 280,
        stackedArea: true,
      }),
    ).toThrow('negative-stacked-area');
  });

  test('rejects duplicate x values within a series', () => {
    expect(() =>
      createCartesianModel({
        componentId: 'line-chart',
        series: [
          {
            id: 's',
            label: 'S',
            data: [
              { x: 'Jan', y: 1 },
              { x: 'Jan', y: 2 },
            ],
          },
        ],
        hiddenSeriesIds: [],
        width: 640,
        height: 280,
      }),
    ).toThrow('duplicate-x');
  });

  test('rejects mixed x domain kinds', () => {
    expect(() =>
      createCartesianModel({
        componentId: 'line-chart',
        series: [
          {
            id: 's',
            label: 'S',
            data: [
              { x: 'Jan', y: 1 },
              { x: 2, y: 2 },
            ],
          },
        ],
        hiddenSeriesIds: [],
        width: 640,
        height: 280,
      }),
    ).toThrow('mixed-x-domain-kind');
  });

  test('rejects non-finite y values', () => {
    expect(() =>
      createCartesianModel({
        componentId: 'line-chart',
        series: [{ id: 's', label: 'S', data: [{ x: 'Jan', y: Number.NaN }] }],
        hiddenSeriesIds: [],
        width: 640,
        height: 280,
      }),
    ).toThrow('non-finite-y');
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
    for (const renderedSeries of [even, odd]) {
      for (let index = 1; index < (renderedSeries?.points.length ?? 0); index++) {
        expect(
          renderedSeries?.points[index - 1]?.y === null ||
            renderedSeries?.points[index]?.y === null,
        ).toBe(true);
      }
    }
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
      } as ChartXAxisConfiguration,
      yAxis: {
        label: 'Monthly recurring revenue',
        format: () => '$10,000,000.00',
      },
    });

    expect(labelled.geometry.marginLeft).toBeGreaterThan(baseline.geometry.marginLeft);
    expect(labelled.geometry.marginBottom).toBeGreaterThan(baseline.geometry.marginBottom);
  });
});

describe('createBarModel', () => {
  test('returns an empty model for empty data', () => {
    const model = createBarModel({
      data: [],
      categoryKey: 'month',
      series: [{ id: 's', label: 'S', valueKey: 'value' }],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
      orientation: 'vertical',
      mode: 'grouped',
    });
    expect(model.empty).toBe(true);
    expect(model.bars).toHaveLength(0);
  });

  test('uses a chart-local palette while preserving the shared scene contract', () => {
    const model = createBarModel({
      data: [{ month: 'Jan', value: 9 }],
      categoryKey: 'month',
      series: [{ id: 'value', label: 'Value', valueKey: 'value' }],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
      orientation: 'vertical',
      mode: 'grouped',
      theme: { palette: ['rebeccapurple'] },
    });

    expect(model).toMatchObject({
      geometry: expect.any(Object),
      targets: expect.any(Array),
      tableRows: expect.any(Array),
      empty: false,
    });
    expect(model.bars[0]?.color).toBe('rebeccapurple');
    expect(model.theme.palette).toEqual(['rebeccapurple']);
  });

  test('expands the horizontal label margin for long category labels', () => {
    const model = createBarModel({
      data: [{ status: 'Completed', count: 9 }],
      categoryKey: 'status',
      series: [{ id: 'count', label: 'Count', valueKey: 'count' }],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
      orientation: 'horizontal',
      mode: 'grouped',
    });

    expect(model.geometry.marginLeft).toBe(87);
    expect(model.categoryTicks[0]).toMatchObject({
      label: 'Completed',
      fullLabel: 'Completed',
    });
  });

  test('reserves horizontal label space from measured text width', () => {
    const model = createBarModel({
      data: [{ status: 'WWWWWWWWWW', count: 9 }],
      categoryKey: 'status',
      series: [{ id: 'count', label: 'Count', valueKey: 'count' }],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
      orientation: 'horizontal',
      mode: 'grouped',
    });

    expect(model.geometry.marginLeft).toBe(94);
    expect(model.categoryTicks[0]?.label).toBe('WWWWWWWWWW');
  });

  test('uses browser measurements when truncating horizontal category labels', () => {
    const measurementElement = document.createElement('figure');
    measurementElement.style.setProperty('--cinder-text-xs', '12px');
    document.body.append(measurementElement);
    const svgTextElementPrototype = globalThis.SVGTextElement.prototype;
    const originalGetBoundingBox = Object.getOwnPropertyDescriptor(
      svgTextElementPrototype,
      'getBBox',
    );
    Object.defineProperty(svgTextElementPrototype, 'getBBox', {
      configurable: true,
      value(this: SVGTextElement) {
        return { x: 0, y: 0, width: (this.textContent?.length ?? 0) * 40, height: 12 };
      },
    });

    try {
      const fullLabel = 'WWWWWWWWWW';
      const model = createBarModel({
        data: [{ status: fullLabel, count: 9 }],
        categoryKey: 'status',
        series: [{ id: 'count', label: 'Count', valueKey: 'count' }],
        hiddenSeriesIds: [],
        width: 320,
        height: 280,
        orientation: 'horizontal',
        mode: 'grouped',
        measureText: true,
        measurementElement,
      });

      expect(model.categoryTicks[0]?.label).not.toBe(fullLabel);
      expect(model.categoryTicks[0]?.label.endsWith('…')).toBe(true);
    } finally {
      if (originalGetBoundingBox) {
        Object.defineProperty(svgTextElementPrototype, 'getBBox', originalGetBoundingBox);
      } else {
        Reflect.deleteProperty(svgTextElementPrototype, 'getBBox');
      }
      measurementElement.remove();
    }
  });

  test('truncates extreme horizontal labels without removing the plot', () => {
    const fullLabel = 'W'.repeat(40);
    const model = createBarModel({
      data: [{ status: fullLabel, count: 9 }],
      categoryKey: 'status',
      series: [{ id: 'count', label: 'Count', valueKey: 'count' }],
      hiddenSeriesIds: [],
      width: 320,
      height: 280,
      orientation: 'horizontal',
      mode: 'grouped',
    });

    expect(model.geometry.marginLeft).toBe(128);
    expect(model.geometry.plotWidth).toBe(
      320 - model.geometry.marginLeft - model.geometry.marginRight,
    );
    expect(model.geometry.plotWidth).toBeGreaterThan(0);
    expect(model.categoryTicks[0]?.label).not.toBe(fullLabel);
    expect(model.categoryTicks[0]?.label.endsWith('…')).toBe(true);
    expect(model.categoryTicks[0]?.fullLabel).toBe(fullLabel);
  });

  test('stacked domain reflects visible series only', () => {
    const data = [
      { month: 'Jan', a: 10, b: 100 },
      { month: 'Feb', a: 20, b: 200 },
    ];
    const series = [
      { id: 'a', label: 'A', valueKey: 'a' },
      { id: 'b', label: 'B', valueKey: 'b' },
    ];
    const allVisible = createBarModel({
      data,
      categoryKey: 'month',
      series,
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
      orientation: 'vertical',
      mode: 'stacked',
    });
    const bHidden = createBarModel({
      data,
      categoryKey: 'month',
      series,
      hiddenSeriesIds: ['b'],
      width: 640,
      height: 280,
      orientation: 'vertical',
      mode: 'stacked',
    });
    expect(allVisible.valueDomain[1]).toBeGreaterThan(bHidden.valueDomain[1]);
  });

  test('grouped domain reflects visible series only', () => {
    const data = [
      { month: 'Jan', a: 10, b: 100 },
      { month: 'Feb', a: 20, b: 200 },
    ];
    const series = [
      { id: 'a', label: 'A', valueKey: 'a' },
      { id: 'b', label: 'B', valueKey: 'b' },
    ];
    const allVisible = createBarModel({
      data,
      categoryKey: 'month',
      series,
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
      orientation: 'vertical',
      mode: 'grouped',
    });
    const bHidden = createBarModel({
      data,
      categoryKey: 'month',
      series,
      hiddenSeriesIds: ['b'],
      width: 640,
      height: 280,
      orientation: 'vertical',
      mode: 'grouped',
    });

    expect(allVisible.valueDomain[1]).toBeGreaterThan(bHidden.valueDomain[1]);
    expect(bHidden.valueDomain[1]).toBeLessThan(100);
  });

  test('throws on invalid category types', () => {
    expect(() =>
      createBarModel({
        data: [{ month: null as unknown as string, value: 1 }],
        categoryKey: 'month',
        series: [{ id: 's', label: 'S', valueKey: 'value' }],
        hiddenSeriesIds: [],
        width: 640,
        height: 280,
        orientation: 'vertical',
        mode: 'grouped',
      }),
    ).toThrow('invalid-bar-category');
  });

  test('throws when the category key is missing', () => {
    expect(() =>
      createBarModel({
        data: [{ value: 1 }],
        categoryKey: 'month',
        series: [{ id: 's', label: 'S', valueKey: 'value' }],
        hiddenSeriesIds: [],
        width: 640,
        height: 280,
        orientation: 'vertical',
        mode: 'grouped',
      }),
    ).toThrow('invalid-bar-category');
  });

  test('throws when a series value key is missing', () => {
    expect(() =>
      createBarModel({
        data: [{ month: 'Jan' }],
        categoryKey: 'month',
        series: [{ id: 's', label: 'S', valueKey: 'value' }],
        hiddenSeriesIds: [],
        width: 640,
        height: 280,
        orientation: 'vertical',
        mode: 'grouped',
      }),
    ).toThrow('missing-bar-value-key');
  });

  test('throws when a bar value is not numeric or empty', () => {
    expect(() =>
      createBarModel({
        data: [{ month: 'Jan', value: 'bad' as unknown as number }],
        categoryKey: 'month',
        series: [{ id: 's', label: 'S', valueKey: 'value' }],
        hiddenSeriesIds: [],
        width: 640,
        height: 280,
        orientation: 'vertical',
        mode: 'grouped',
      }),
    ).toThrow('invalid-bar-value');
  });

  test('throws when category values mix domain kinds', () => {
    expect(() =>
      createBarModel({
        data: [
          { month: 'Jan', value: 1 },
          { month: 2, value: 2 },
        ],
        categoryKey: 'month',
        series: [{ id: 's', label: 'S', valueKey: 'value' }],
        hiddenSeriesIds: [],
        width: 640,
        height: 280,
        orientation: 'vertical',
        mode: 'grouped',
      }),
    ).toThrow('mixed-bar-category-kind');
  });

  test('throws on duplicate categories', () => {
    expect(() =>
      createBarModel({
        data: [
          { month: 'Jan', value: 1 },
          { month: 'Jan', value: 2 },
        ],
        categoryKey: 'month',
        series: [{ id: 's', label: 'S', valueKey: 'value' }],
        hiddenSeriesIds: [],
        width: 640,
        height: 280,
        orientation: 'vertical',
        mode: 'grouped',
      }),
    ).toThrow('duplicate-category');
  });

  test('horizontal targets are sorted by y for nearestTarget', () => {
    const model = createBarModel({
      data: [
        { month: 'Jan', value: 30 },
        { month: 'Feb', value: 20 },
        { month: 'Mar', value: 10 },
      ],
      categoryKey: 'month',
      series: [{ id: 's', label: 'S', valueKey: 'value' }],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
      orientation: 'horizontal',
      mode: 'grouped',
    });
    const ys = model.targets.map((target) => target.y);
    expect(ys).toEqual([...ys].toSorted((a, b) => a - b));
  });

  test('horizontal stacked bars accumulate positive and negative offsets', () => {
    const model = createBarModel({
      data: [{ month: 'Jan', positive: 10, negative: -4 }],
      categoryKey: 'month',
      series: [
        { id: 'positive', label: 'Positive', valueKey: 'positive' },
        { id: 'negative', label: 'Negative', valueKey: 'negative' },
      ],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
      orientation: 'horizontal',
      mode: 'stacked',
    });

    const positive = model.bars.find((bar) => bar.seriesId === 'positive');
    const negative = model.bars.find((bar) => bar.seriesId === 'negative');
    expect(positive?.width).toBeGreaterThan(0);
    expect(negative?.width).toBeGreaterThan(0);
    expect(negative?.x).toBeLessThan(positive?.x ?? 0);
  });

  test('category ticks use the category band scale instead of even index spacing', () => {
    const model = createBarModel({
      data: [
        { month: 'Jan', value: 30 },
        { month: 'Feb', value: 20 },
      ],
      categoryKey: 'month',
      series: [{ id: 's', label: 'S', valueKey: 'value' }],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
      orientation: 'vertical',
      mode: 'grouped',
    });
    const [tick] = model.categoryTicks;
    const oldEvenIndexPosition = model.geometry.plotWidth / 4;

    expect(tick?.x).not.toBeCloseTo(oldEvenIndexPosition);
    expect(tick?.x).toBeGreaterThan(0);
    expect(tick?.x).toBeLessThan(model.geometry.plotWidth);
  });

  test('category ticks honor category axis formatters', () => {
    const model = createBarModel({
      data: [{ month: 'Jan', value: 30 }],
      categoryKey: 'month',
      series: [{ id: 's', label: 'S', valueKey: 'value' }],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
      orientation: 'vertical',
      mode: 'grouped',
      xAxis: { format: (value) => `Month ${String(value)}` },
    });

    expect(model.categoryTicks[0]?.label).toBe('Month Jan');
  });

  test('bar value and category formatter context uses the category index', () => {
    const model = createBarModel({
      data: [
        { month: 'Jan', value: 30 },
        { month: 'Feb', value: 20 },
      ],
      categoryKey: 'month',
      series: [
        {
          id: 'value',
          label: 'Value',
          valueKey: 'value',
          valueFormatter: (_value, context) => `value-${context.index}`,
        },
      ],
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
      orientation: 'vertical',
      mode: 'grouped',
      xAxis: { format: (_value, context) => `category-${context.index}` },
    });

    expect(model.bars.map((bar) => bar.categoryLabel)).toEqual(['category-0', 'category-1']);
    expect(model.bars.map((bar) => bar.valueLabel)).toEqual(['value-0', 'value-1']);
  });
});
