import { describe, expect, spyOn, test } from 'bun:test';

import {
  createChartGeometry,
  createHorizontalCategoryLabelLayout,
  observeChartFontLoading,
} from './chart-utilities.ts';

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
        xAxis: { tickLabelRotation: Number.NaN },
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

describe('observeChartFontLoading', () => {
  test('invokes the callback when the fonts finish loading and cleans up on teardown', async () => {
    const { promise: ready, resolve: resolveReady } = Promise.withResolvers<void>();
    const fonts = new EventTarget();
    Object.defineProperty(fonts, 'ready', { value: ready });
    const addListener = spyOn(fonts, 'addEventListener');
    const removeListener = spyOn(fonts, 'removeEventListener');
    const originalFonts = document.fonts;
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: fonts,
    });

    try {
      let calls = 0;
      const stop = observeChartFontLoading(() => {
        calls += 1;
      });

      expect(addListener).toHaveBeenCalledTimes(1);

      fonts.dispatchEvent(new Event('loadingdone'));
      expect(calls).toBe(1);

      resolveReady();
      await ready;
      // The `ready` promise resolving fires the callback a second time.
      expect(calls).toBe(2);

      stop();
      expect(removeListener).toHaveBeenCalledTimes(1);

      // After teardown, a stray callback (e.g. a delayed event) must not fire.
      fonts.dispatchEvent(new Event('loadingdone'));
      expect(calls).toBe(2);
    } finally {
      addListener.mockRestore();
      removeListener.mockRestore();
      if (originalFonts === undefined) {
        Reflect.deleteProperty(document, 'fonts');
      } else {
        Object.defineProperty(document, 'fonts', { configurable: true, value: originalFonts });
      }
    }
  });

  test('returns a no-op cleanup when document.fonts is unavailable', () => {
    const originalFonts = document.fonts;
    Object.defineProperty(document, 'fonts', { configurable: true, value: undefined });
    try {
      const stop = observeChartFontLoading(() => {
        throw new Error('must not be called when document.fonts is unavailable');
      });
      expect(() => stop()).not.toThrow();
    } finally {
      Object.defineProperty(document, 'fonts', { configurable: true, value: originalFonts });
    }
  });
});

describe('createHorizontalCategoryLabelLayout', () => {
  test('falls back to an empty label when even a single ellipsis character does not fit', () => {
    // A chartWidth this small clamps the reserved margin down to the fixed
    // outer padding regardless of label length, leaving zero width available
    // for any label content — not even a lone ellipsis character.
    const layout = createHorizontalCategoryLabelLayout(['January'], 40);

    expect(layout.marginLeft).toBe(16);
    expect(layout.labels).toEqual(['']);
  });
});
