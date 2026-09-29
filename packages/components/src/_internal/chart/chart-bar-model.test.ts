import { describe, expect, test } from 'bun:test';

import { createBarModel } from './chart-utilities.ts';

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
        data: [{ month: null, value: 1 }],
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
        data: [{ month: 'Jan', value: 'bad' }],
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
});
