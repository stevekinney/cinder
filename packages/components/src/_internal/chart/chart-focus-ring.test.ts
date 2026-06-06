import { describe, expect, test } from 'bun:test';

import {
  DEFAULT_CHART_FOCUS_RING_STROKE_PADDING,
  createBarFocusRingGeometry,
  createPointFocusRingGeometry,
} from './chart-focus-ring.ts';
import { createBarModel, type ChartTarget } from './chart-utilities.ts';

function target(overrides: Partial<ChartTarget> = {}): ChartTarget {
  return {
    id: 'target',
    seriesId: 'series',
    seriesLabel: 'Series',
    xLabel: 'Jan',
    valueLabel: '10',
    x: 50,
    y: 50,
    color: 'red',
    ...overrides,
  };
}

describe('createPointFocusRingGeometry', () => {
  test('keeps an in-bounds point centered with no connector', () => {
    const geometry = createPointFocusRingGeometry({
      target: target({ x: 50, y: 40 }),
      plotWidth: 120,
      plotHeight: 100,
    });

    expect(geometry?.kind).toBe('point');
    if (geometry?.kind !== 'point') throw new Error('Expected point focus-ring geometry.');
    expect(geometry.cx).toBe(50);
    expect(geometry.cy).toBe(40);
    expect(geometry.radius).toBe(10);
    expect(geometry.offsetDistance).toBe(0);
    expect(geometry.connector).toBeUndefined();
    expect(geometry.dot).toBeUndefined();
  });

  test('clamps an edge point inside the plot and keeps the visible offset within the ring', () => {
    const geometry = createPointFocusRingGeometry({
      target: target({ x: 0, y: 40 }),
      plotWidth: 120,
      plotHeight: 100,
    });

    expect(geometry?.kind).toBe('point');
    if (geometry?.kind !== 'point') throw new Error('Expected point focus-ring geometry.');
    expect(geometry.cx).toBe(DEFAULT_CHART_FOCUS_RING_STROKE_PADDING + geometry.radius);
    expect(geometry.cy).toBe(40);
    expect(geometry.targetX).toBe(DEFAULT_CHART_FOCUS_RING_STROKE_PADDING + 2.5);
    expect(geometry.targetY).toBe(40);
    expect(geometry.offsetDistance).toBeLessThanOrEqual(geometry.radius);
    expect(geometry.connector).toEqual({
      x1: geometry.targetX,
      y1: geometry.targetY,
      x2: geometry.cx,
      y2: geometry.cy,
    });
    expect(geometry.dot).toEqual({
      cx: geometry.targetX,
      cy: geometry.targetY,
      radius: 2.5,
    });
  });

  test('keeps the edge-marker dot fully inside the plot on every edge', () => {
    const cases = [
      target({ x: 0, y: 50 }),
      target({ x: 120, y: 50 }),
      target({ x: 60, y: 0 }),
      target({ x: 60, y: 100 }),
      target({ x: 0, y: 0 }),
    ];

    for (const item of cases) {
      const geometry = createPointFocusRingGeometry({
        target: item,
        plotWidth: 120,
        plotHeight: 100,
      });

      expect(geometry?.kind).toBe('point');
      if (geometry?.kind !== 'point') throw new Error('Expected point focus-ring geometry.');
      expect(geometry.dot).toBeDefined();
      expect(geometry.dot!.cx - geometry.dot!.radius).toBeGreaterThanOrEqual(
        DEFAULT_CHART_FOCUS_RING_STROKE_PADDING,
      );
      expect(geometry.dot!.cy - geometry.dot!.radius).toBeGreaterThanOrEqual(
        DEFAULT_CHART_FOCUS_RING_STROKE_PADDING,
      );
      expect(geometry.dot!.cx + geometry.dot!.radius).toBeLessThanOrEqual(
        120 - DEFAULT_CHART_FOCUS_RING_STROKE_PADDING,
      );
      expect(geometry.dot!.cy + geometry.dot!.radius).toBeLessThanOrEqual(
        100 - DEFAULT_CHART_FOCUS_RING_STROKE_PADDING,
      );
      expect(geometry.offsetDistance).toBeLessThanOrEqual(geometry.radius);
    }
  });

  test('keeps adjacent dense-edge point indicators associated with their own coordinates', () => {
    const first = createPointFocusRingGeometry({
      target: target({ id: 'first', x: 0, y: 12 }),
      plotWidth: 120,
      plotHeight: 100,
    });
    const second = createPointFocusRingGeometry({
      target: target({ id: 'second', x: 0, y: 28 }),
      plotWidth: 120,
      plotHeight: 100,
    });

    expect(first?.kind).toBe('point');
    expect(second?.kind).toBe('point');
    if (first?.kind !== 'point' || second?.kind !== 'point') {
      throw new Error('Expected point focus-ring geometry.');
    }
    expect(first.dot?.cy).toBe(first.targetY);
    expect(second.dot?.cy).toBe(second.targetY);
    expect(first.connector?.y1).toBe(first.targetY);
    expect(second.connector?.y1).toBe(second.targetY);
    expect(first.dot?.cy).not.toBe(second.dot?.cy);
  });

  test('uses the supplied stroke padding in the clamp math', () => {
    const geometry = createPointFocusRingGeometry({
      target: target({ x: 0, y: 0 }),
      plotWidth: 120,
      plotHeight: 100,
      strokePadding: 16,
    });

    expect(geometry?.kind).toBe('point');
    if (geometry?.kind !== 'point') throw new Error('Expected point focus-ring geometry.');
    expect(geometry.cx).toBe(26);
    expect(geometry.cy).toBe(26);
    expect(geometry.targetX).toBeGreaterThanOrEqual(18.5);
    expect(geometry.targetY).toBeGreaterThanOrEqual(18.5);
    expect(geometry.offsetDistance).toBeLessThanOrEqual(geometry.radius);
  });

  test('falls back to the plot frame for tiny positive plot dimensions', () => {
    const geometry = createPointFocusRingGeometry({
      target: target({ x: 1, y: 1 }),
      plotWidth: 12,
      plotHeight: 12,
    });

    expect(geometry).toEqual({ kind: 'plot-frame', x: 5, y: 5, width: 2, height: 2, radius: 0 });
  });

  test('falls back to the plot frame when the connector dot cannot fit inside the stroke padding', () => {
    const geometry = createPointFocusRingGeometry({
      target: target({ x: 0, y: 10 }),
      plotWidth: 20,
      plotHeight: 80,
    });

    expect(geometry).toEqual({ kind: 'plot-frame', x: 8, y: 8, width: 4, height: 64, radius: 0 });
  });

  test('returns null only when the plot has no positive area', () => {
    expect(
      createPointFocusRingGeometry({
        target: target(),
        plotWidth: 0,
        plotHeight: 100,
      }),
    ).toBeNull();
    expect(
      createPointFocusRingGeometry({
        target: target(),
        plotWidth: 100,
        plotHeight: 0,
      }),
    ).toBeNull();
  });
});

describe('createBarFocusRingGeometry', () => {
  test('frames a normal in-bounds bar around the target center', () => {
    const geometry = createBarFocusRingGeometry({
      target: target({ x: 60, y: 40, width: 30, height: 80 }),
      plotWidth: 140,
      plotHeight: 120,
    });

    expect(geometry).toEqual({ kind: 'bar', x: 45, y: 8, width: 30, height: 80, radius: 4 });
  });

  test('uses minimum dimensions for zero-height and zero-width bars', () => {
    const zeroHeight = createBarFocusRingGeometry({
      target: target({ x: 40, y: 80, width: 28, height: 0 }),
      plotWidth: 140,
      plotHeight: 120,
    });
    const zeroWidth = createBarFocusRingGeometry({
      target: target({ x: 40, y: 80, width: 0, height: 28 }),
      plotWidth: 140,
      plotHeight: 120,
    });

    expect(zeroHeight).toEqual({ kind: 'bar', x: 26, y: 74, width: 28, height: 12, radius: 4 });
    expect(zeroWidth).toEqual({ kind: 'bar', x: 34, y: 66, width: 12, height: 28, radius: 4 });
  });

  test('clamps bar rings inside the drawable plot area', () => {
    const geometry = createBarFocusRingGeometry({
      target: target({ x: 0, y: 0, width: 40, height: 30 }),
      plotWidth: 120,
      plotHeight: 100,
    });

    expect(geometry).toEqual({ kind: 'bar', x: 8, y: 8, width: 40, height: 30, radius: 4 });
  });

  test('shrinks to the largest drawable clipped rectangle before using the plot-frame fallback', () => {
    const geometry = createBarFocusRingGeometry({
      target: target({ x: 12, y: 12, width: 40, height: 40 }),
      plotWidth: 28,
      plotHeight: 30,
    });

    expect(geometry).toEqual({ kind: 'bar', x: 8, y: 8, width: 12, height: 14, radius: 4 });
  });

  test('falls back to the plot frame when the drawable bar rectangle cannot fit', () => {
    const geometry = createBarFocusRingGeometry({
      target: target({ x: 2, y: 2, width: 12, height: 12 }),
      plotWidth: 12,
      plotHeight: 12,
    });

    expect(geometry).toEqual({ kind: 'plot-frame', x: 5, y: 5, width: 2, height: 2, radius: 0 });
  });

  test('returns null only when the plot has no positive area', () => {
    expect(
      createBarFocusRingGeometry({
        target: target(),
        plotWidth: 0,
        plotHeight: 100,
      }),
    ).toBeNull();
    expect(
      createBarFocusRingGeometry({
        target: target(),
        plotWidth: 100,
        plotHeight: 0,
      }),
    ).toBeNull();
  });
});

describe('bar chart target geometry contract', () => {
  const data = [
    { category: 'Jan', revenue: 120, expansion: 30 },
    { category: 'Feb', revenue: 180, expansion: 45 },
  ];
  const series = [
    { id: 'revenue', label: 'Revenue', valueKey: 'revenue' },
    { id: 'expansion', label: 'Expansion', valueKey: 'expansion' },
  ];

  test.each([
    ['vertical grouped', 'vertical', 'grouped'],
    ['vertical stacked', 'vertical', 'stacked'],
    ['horizontal grouped', 'horizontal', 'grouped'],
    ['horizontal stacked', 'horizontal', 'stacked'],
  ] as const)('targets expose centered bar bounds for %s charts', (_label, orientation, mode) => {
    const model = createBarModel({
      data,
      categoryKey: 'category',
      series,
      hiddenSeriesIds: [],
      width: 640,
      height: 280,
      orientation,
      mode,
    });

    for (const targetItem of model.targets) {
      const bar = model.bars.find((candidate) => candidate.id === targetItem.id);
      expect(bar).toBeDefined();
      expect(targetItem.x).toBeCloseTo((bar?.x ?? 0) + (bar?.width ?? 0) / 2);
      expect(targetItem.y).toBeCloseTo((bar?.y ?? 0) + (bar?.height ?? 0) / 2);
      expect(targetItem.width).toBeCloseTo(bar?.width ?? 0);
      expect(targetItem.height).toBeCloseTo(bar?.height ?? 0);
    }
  });
});
