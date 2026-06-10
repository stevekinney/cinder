/// <reference lib="dom" />
import { afterAll, afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

class TestResizeObserver {
  observe(): void {}
  disconnect(): void {}
}

// Capture the original so it can be restored — overwriting globalThis without
// restoring leaks the stub into any later test file that relies on the real one.
const originalResizeObserver = globalThis.ResizeObserver;
globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;

const { cleanup, render } = await import('@testing-library/svelte');
const { default: Waveform } = await import('./waveform.svelte');

afterEach(() => cleanup());
afterAll(() => {
  globalThis.ResizeObserver = originalResizeObserver;
});

// A small sine-wave-like mock dataset
const sineData = Array.from({ length: 64 }, (_, index) => Math.sin((index / 64) * Math.PI * 4));

describe('Waveform', () => {
  test('renders an SVG with an accessible title when data is present', () => {
    const { container } = render(Waveform, {
      label: 'Sine wave',
      data: sineData,
    });

    const svgTitle = container.querySelector('svg > title');
    expect(svgTitle?.textContent).toBe('Sine wave');
    expect(container.querySelector('svg')?.getAttribute('aria-labelledby')).toBeTruthy();
  });

  test('renders a path in path render mode', () => {
    const { container } = render(Waveform, {
      label: 'Sine wave',
      data: sineData,
      renderMode: 'path',
    });

    expect(container.querySelector('.cinder-waveform__path')).not.toBeNull();
    expect(container.querySelector('.cinder-waveform__bar')).toBeNull();
  });

  test('renders bars in bars render mode', () => {
    const { container } = render(Waveform, {
      label: 'Sine wave',
      data: sineData,
      renderMode: 'bars',
    });

    expect(container.querySelector('.cinder-waveform__bar')).not.toBeNull();
    expect(container.querySelector('.cinder-waveform__path')).toBeNull();
    expect(container.querySelectorAll('.cinder-waveform__bar').length).toBe(sineData.length);
  });

  test('renders baseline line', () => {
    const { container } = render(Waveform, {
      label: 'Sine wave',
      data: sineData,
    });

    expect(container.querySelector('.cinder-waveform__baseline')).not.toBeNull();
  });

  test('shows empty state when data array is empty', () => {
    const { getByText, container } = render(Waveform, {
      label: 'Empty waveform',
      data: [],
    });

    expect(getByText('No waveform data')).toBeTruthy();
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('svg > title')).toBeNull();
  });

  test('shows loading state when loading is true', () => {
    const { getByText, container } = render(Waveform, {
      label: 'Loading waveform',
      loading: true,
      data: [],
    });

    expect(getByText('Loading…')).toBeTruthy();
    expect(container.querySelector('[data-cinder-loading]')).not.toBeNull();
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  test('renders accessible data table when dataTableVisibility is visible', () => {
    const { container } = render(Waveform, {
      label: 'Sine wave',
      data: sineData,
      dataTableVisibility: 'visible',
    });

    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelector('table')?.className).not.toContain('cinder-sr-only');
    // Caption starts with the label; for sampled data it also reports the count.
    expect(container.querySelector('caption')?.textContent).toContain('Sine wave');
  });

  test('hides data table when dataTableVisibility is hidden', () => {
    const { container } = render(Waveform, {
      label: 'Sine wave',
      data: sineData,
      dataTableVisibility: 'hidden',
    });

    expect(container.querySelector('table')).toBeNull();
  });

  test('uses screen-reader-only class by default', () => {
    const { container } = render(Waveform, {
      label: 'Sine wave',
      data: sineData,
    });

    expect(container.querySelector('table.cinder-sr-only')).not.toBeNull();
  });

  test('clamps samples outside [-1, 1] range', () => {
    const { container } = render(Waveform, {
      label: 'Clamped waveform',
      data: [2, -3, 0.5],
      renderMode: 'path',
    });

    // Path should render without errors
    const path = container.querySelector('.cinder-waveform__path');
    expect(path).not.toBeNull();
    expect(path?.getAttribute('d')).toBeTruthy();
  });

  test('applies render-mode data attribute', () => {
    const { container } = render(Waveform, {
      label: 'Bars waveform',
      data: sineData,
      renderMode: 'bars',
    });

    expect(container.querySelector('[data-cinder-render-mode="bars"]')).not.toBeNull();
  });

  test('uses custom dataTableCaption when provided', () => {
    const { container } = render(Waveform, {
      label: 'Sine wave',
      data: sineData,
      dataTableVisibility: 'visible',
      dataTableCaption: 'Custom caption',
    });

    expect(container.querySelector('caption')?.textContent).toContain('Custom caption');
  });

  test('caption reports sampling when the table is truncated', () => {
    const { container } = render(Waveform, {
      label: 'Long signal',
      data: Array.from({ length: 200 }, (_, index) => Math.sin(index / 5)),
      dataTableVisibility: 'visible',
    });
    // 200 samples > 20-row limit, so the caption discloses the sampling.
    expect(container.querySelector('caption')?.textContent).toContain('of 200 samples shown');
  });

  test('non-finite samples collapse to the baseline (no NaN in the path)', () => {
    const { container } = render(Waveform, {
      label: 'Glitchy',
      data: [0, NaN, 0.5, Infinity, -0.5],
    });
    const path = container.querySelector('.cinder-waveform__path')?.getAttribute('d') ?? '';
    expect(path).not.toContain('NaN');
    expect(path.length).toBeGreaterThan(0);
  });

  test('a single sample renders a visible centered tick (not NaN)', () => {
    const { container } = render(Waveform, { label: 'One', data: [0.5] });
    const path = container.querySelector('.cinder-waveform__path')?.getAttribute('d') ?? '';
    expect(path).not.toContain('NaN');
    expect(path).toContain('M');
  });

  test('all-zero data in bars mode renders zero-height bars (silence ≠ signal)', () => {
    const { container } = render(Waveform, {
      label: 'Silence',
      data: [0, 0, 0, 0],
      renderMode: 'bars',
    });
    const rects = Array.from(container.querySelectorAll('.cinder-waveform__bar'));
    expect(rects.length).toBeGreaterThan(0);
    for (const rect of rects) {
      expect(rect.getAttribute('height')).toBe('0');
    }
  });

  test('a buffer far larger than the render cap is envelope-downsampled to a bounded bar count', () => {
    // 50k samples must NOT produce 50k <rect>s — clamping is folded into the
    // downsampling pass so the full buffer is never materialized for rendering.
    const big = Array.from({ length: 50_000 }, (_, index) => Math.sin(index / 50));
    const { container } = render(Waveform, {
      label: 'Large buffer',
      data: big,
      renderMode: 'bars',
    });
    const rects = container.querySelectorAll('.cinder-waveform__bar');
    expect(rects.length).toBeLessThanOrEqual(2000);
    expect(rects.length).toBeGreaterThan(0);
  });
});
