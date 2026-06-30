import { describe, expect, test } from 'bun:test';

import {
  assertUniqueSeriesIds,
  assertValidChartNumber,
  assertValidNonNegativeInteger,
  assertValidTickCount,
  chartPalette,
  chartPaletteColor,
  createBarModel,
  createCartesianModel,
  dataTableClass,
  formatNumericValue,
  formatXValue,
  legendVisible,
  nearestTarget,
  normalizeXValue,
  toggleSeriesId,
  type ChartTarget,
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
    }
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
