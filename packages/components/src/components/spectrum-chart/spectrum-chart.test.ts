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
const { default: SpectrumChart } = await import('./spectrum-chart.svelte');

afterEach(() => cleanup());
afterAll(() => {
  globalThis.ResizeObserver = originalResizeObserver;
});

const mockBins = [
  { label: '100 Hz', value: 0.2 },
  { label: '200 Hz', value: 0.5 },
  { label: '400 Hz', value: 0.8 },
  { label: '800 Hz', value: 0.6 },
  { label: '1.6 kHz', value: 0.3 },
  { label: '3.2 kHz', value: 0.1 },
];

describe('SpectrumChart', () => {
  test('renders a bar for each frequency bin', () => {
    const { container } = render(SpectrumChart, {
      label: 'Frequency spectrum',
      bins: mockBins,
    });

    const bars = container.querySelectorAll('.cinder-spectrum-chart__bar');
    expect(bars.length).toBe(mockBins.length);
  });

  test('renders accessible SVG title when data is present', () => {
    const { container } = render(SpectrumChart, {
      label: 'Frequency spectrum',
      bins: mockBins,
    });

    const svgTitle = container.querySelector('svg > title');
    expect(svgTitle?.textContent).toBe('Frequency spectrum');
    expect(container.querySelector('svg')?.getAttribute('aria-labelledby')).toBeTruthy();
  });

  test('SVG is aria-hidden when loading', () => {
    const { container } = render(SpectrumChart, {
      label: 'Frequency spectrum',
      loading: true,
      bins: [],
    });

    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('svg > title')).toBeNull();
  });

  test('shows loading state', () => {
    const { getByText } = render(SpectrumChart, {
      label: 'Loading spectrum',
      loading: true,
      bins: [],
    });

    expect(getByText('Loading…')).toBeTruthy();
  });

  test('shows empty state when bins array is empty', () => {
    const { getByText, container } = render(SpectrumChart, {
      label: 'Empty spectrum',
      bins: [],
    });

    expect(getByText('No spectrum data')).toBeTruthy();
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    // No plot geometry draws under the empty-state overlay — bars, grid lines,
    // and tick labels are all suppressed when there's no data (yTicks otherwise
    // returns [0], leaving a stray baseline grid line under the overlay).
    expect(container.querySelectorAll('.cinder-spectrum-chart__bar').length).toBe(0);
    expect(container.querySelectorAll('.cinder-spectrum-chart__grid-line').length).toBe(0);
    expect(container.querySelectorAll('.cinder-spectrum-chart__tick-label').length).toBe(0);
  });

  test('renders accessible data table when dataTableVisibility is visible', () => {
    const { container } = render(SpectrumChart, {
      label: 'Frequency spectrum',
      bins: mockBins,
      dataTableVisibility: 'visible',
    });

    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelector('caption')?.textContent).toBe('Frequency spectrum');
    const tableRows = container.querySelectorAll('tbody tr');
    expect(tableRows.length).toBe(mockBins.length);
  });

  test('hides data table when dataTableVisibility is hidden', () => {
    const { container } = render(SpectrumChart, {
      label: 'Frequency spectrum',
      bins: mockBins,
      dataTableVisibility: 'hidden',
    });

    expect(container.querySelector('table')).toBeNull();
  });

  test('uses screen-reader-only class by default', () => {
    const { container } = render(SpectrumChart, {
      label: 'Frequency spectrum',
      bins: mockBins,
    });

    expect(container.querySelector('table.cinder-sr-only')).not.toBeNull();
  });

  test('bin label appears in the frequency data attribute', () => {
    const { container } = render(SpectrumChart, {
      label: 'Frequency spectrum',
      bins: [{ label: '440 Hz', value: 0.5 }],
    });

    expect(container.querySelector('[data-cinder-bin="440 Hz"]')).not.toBeNull();
  });

  test('renders y-axis tick labels', () => {
    const { container } = render(SpectrumChart, {
      label: 'Frequency spectrum',
      bins: mockBins,
    });

    const tickLabels = container.querySelectorAll('.cinder-spectrum-chart__tick-label');
    expect(tickLabels.length).toBeGreaterThan(0);
  });

  test('uses custom dataTableCaption when provided', () => {
    const { container } = render(SpectrumChart, {
      label: 'Frequency spectrum',
      bins: mockBins,
      dataTableVisibility: 'visible',
      dataTableCaption: 'Audio frequency table',
    });

    expect(container.querySelector('caption')?.textContent).toBe('Audio frequency table');
  });

  test('data whose max is < 1 still reaches the top of the plot', () => {
    // Regression: bar height must scale against the real max, not Math.max(max, 1).
    const { container } = render(SpectrumChart, {
      label: 'Quiet',
      bins: [
        { label: '0', value: 0.2 },
        { label: '1', value: 0.8 },
      ],
      height: 160,
    });
    const rects = Array.from(container.querySelectorAll('.cinder-spectrum-chart__bar'));
    const heights = rects.map((r) => Number(r.getAttribute('height')));
    // The tallest bar (value 0.8 === the max) fills the full plot height (160 - 8 - 32 = 120).
    expect(Math.max(...heights)).toBeCloseTo(120, 0);
  });

  test('all-zero bins render zero-height bars', () => {
    const { container } = render(SpectrumChart, {
      label: 'Silence',
      bins: [
        { label: '0', value: 0 },
        { label: '1', value: 0 },
      ],
    });
    const rects = Array.from(container.querySelectorAll('.cinder-spectrum-chart__bar'));
    expect(rects.length).toBe(2);
    for (const rect of rects) {
      expect(Number(rect.getAttribute('height'))).toBe(0);
    }
  });

  test('negative, NaN, and Infinity bins are sanitized (no invalid geometry)', () => {
    const { container } = render(SpectrumChart, {
      label: 'Glitchy',
      bins: [
        { label: 'a', value: -5 },
        { label: 'b', value: NaN },
        { label: 'c', value: Infinity },
        { label: 'd', value: 10 },
      ],
    });
    const rects = Array.from(container.querySelectorAll('.cinder-spectrum-chart__bar'));
    for (const rect of rects) {
      const h = Number(rect.getAttribute('height'));
      const y = Number(rect.getAttribute('y'));
      expect(Number.isFinite(h)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
    }
  });

  test('duplicate bin labels render distinct rows (keyed by index)', () => {
    const { container } = render(SpectrumChart, {
      label: 'Dups',
      bins: [
        { label: '1k', value: 3 },
        { label: '1k', value: 7 },
      ],
      dataTableVisibility: 'visible',
    });
    expect(container.querySelectorAll('tbody tr').length).toBe(2);
  });

  test('the SVG exposes role="img"', () => {
    const { container } = render(SpectrumChart, { label: 'Spectrum', bins: mockBins });
    expect(container.querySelector('svg')?.getAttribute('role')).toBe('img');
  });
});
