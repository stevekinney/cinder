import { describe, expect, test } from 'bun:test';

import { createBarModel } from './chart-utilities.ts';

describe('createBarModel', () => {
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
