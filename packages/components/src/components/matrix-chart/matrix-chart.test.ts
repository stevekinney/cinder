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
const { default: MatrixChart } = await import('./matrix-chart.svelte');

afterEach(() => cleanup());
afterAll(() => {
  globalThis.ResizeObserver = originalResizeObserver;
});

const confusionData = [
  { actual: 'Cat', predicted: 'Cat', count: 50 },
  { actual: 'Cat', predicted: 'Dog', count: 5 },
  { actual: 'Dog', predicted: 'Cat', count: 3 },
  { actual: 'Dog', predicted: 'Dog', count: 42 },
];

describe('MatrixChart', () => {
  test('renders cells for all categorical combinations', () => {
    const { container } = render(MatrixChart, {
      label: 'Confusion matrix',
      data: confusionData,
      xField: 'predicted',
      yField: 'actual',
      valueField: 'count',
    });

    const cells = container.querySelectorAll('.cinder-matrix-chart__cell');
    expect(cells.length).toBe(4);
  });

  test('renders x-axis and y-axis tick labels', () => {
    const { getAllByText } = render(MatrixChart, {
      label: 'Confusion matrix',
      data: confusionData,
      xField: 'predicted',
      yField: 'actual',
      valueField: 'count',
    });

    expect(getAllByText('Cat').length).toBeGreaterThan(0);
    expect(getAllByText('Dog').length).toBeGreaterThan(0);
  });

  test('renders accessible data table when dataTableVisibility is visible', () => {
    const { container } = render(MatrixChart, {
      label: 'Confusion matrix',
      dataTableVisibility: 'visible',
      data: confusionData,
      xField: 'predicted',
      yField: 'actual',
      valueField: 'count',
    });

    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelector('table')?.className).not.toContain('cinder-sr-only');
    expect(container.querySelector('caption')?.textContent).toBe('Confusion matrix');
  });

  test('hides data table when dataTableVisibility is hidden', () => {
    const { container } = render(MatrixChart, {
      label: 'Confusion matrix',
      data: confusionData,
      xField: 'predicted',
      yField: 'actual',
      valueField: 'count',
      dataTableVisibility: 'hidden',
    });

    expect(container.querySelector('table')).toBeNull();
  });

  test('screen-reader-only data table has cinder-sr-only class', () => {
    const { container } = render(MatrixChart, {
      label: 'Confusion matrix',
      data: confusionData,
      xField: 'predicted',
      yField: 'actual',
      valueField: 'count',
      dataTableVisibility: 'screen-reader-only',
    });

    expect(container.querySelector('table.cinder-sr-only')).not.toBeNull();
  });

  test('renders accessible SVG title when data is present', () => {
    const { container } = render(MatrixChart, {
      label: 'Performance heatmap',
      data: confusionData,
      xField: 'predicted',
      yField: 'actual',
      valueField: 'count',
    });

    const svgTitle = container.querySelector('svg > title');
    expect(svgTitle?.textContent).toBe('Performance heatmap');
  });

  test('SVG is aria-hidden when loading', () => {
    const { container } = render(MatrixChart, {
      label: 'Loading chart',
      loading: true,
      data: confusionData,
      xField: 'predicted',
      yField: 'actual',
      valueField: 'count',
    });

    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    // The chart-level SVG title (direct child, for aria-labelledby) should not be present when loading
    expect(container.querySelector('svg > title')).toBeNull();
  });

  test('shows loading state text', () => {
    const { getByText } = render(MatrixChart, {
      label: 'Loading chart',
      loading: true,
      data: [],
      xField: 'predicted',
      yField: 'actual',
      valueField: 'count',
    });

    expect(getByText('Loading chart…')).toBeTruthy();
  });

  test('shows empty state when data is empty', () => {
    const { getByText, container } = render(MatrixChart, {
      label: 'Empty chart',
      data: [],
      xField: 'predicted',
      yField: 'actual',
      valueField: 'count',
    });

    expect(getByText('No chart data')).toBeTruthy();
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  test('renders sparse cells as null (no cell label)', () => {
    const sparseData = [
      { actual: 'Cat', predicted: 'Cat', count: 50 },
      // 'Cat' × 'Dog' is missing entirely
      { actual: 'Dog', predicted: 'Dog', count: 42 },
    ];
    const { container } = render(MatrixChart, {
      label: 'Sparse matrix',
      data: sparseData,
      xField: 'predicted',
      yField: 'actual',
      valueField: 'count',
      showCellLabels: true,
    });

    // Two categories × two categories = 4 cells; only 2 have data
    const cells = container.querySelectorAll('.cinder-matrix-chart__cell');
    const cellLabels = container.querySelectorAll('.cinder-matrix-chart__cell-label');
    expect(cells.length).toBe(4);
    // Only populated cells get a label
    expect(cellLabels.length).toBe(2);
  });

  test('applies correct color-scale data attribute', () => {
    const { container } = render(MatrixChart, {
      label: 'Diverging chart',
      data: confusionData,
      xField: 'predicted',
      yField: 'actual',
      valueField: 'count',
      colorScale: 'diverging',
    });

    expect(container.querySelector('[data-cinder-color-scale="diverging"]')).not.toBeNull();
  });

  test('uses custom dataTableCaption when provided', () => {
    const { container } = render(MatrixChart, {
      label: 'Confusion matrix',
      dataTableCaption: 'Custom table caption',
      dataTableVisibility: 'visible',
      data: confusionData,
      xField: 'predicted',
      yField: 'actual',
      valueField: 'count',
    });

    expect(container.querySelector('caption')?.textContent).toBe('Custom table caption');
  });

  test('renders cell tooltips via SVG title elements', () => {
    const { container } = render(MatrixChart, {
      label: 'Confusion matrix',
      data: confusionData,
      xField: 'predicted',
      yField: 'actual',
      valueField: 'count',
    });

    const cellTitles = [...container.querySelectorAll('.cinder-matrix-chart__cell title')];
    expect(cellTitles.length).toBe(4);
    // Each cell title has the format "x × y: value"
    expect(cellTitles.some((title) => title.textContent?.includes('×'))).toBe(true);
  });

  test('non-finite values render as missing cells (no NaN in fill)', () => {
    const { container } = render(MatrixChart, {
      label: 'Glitchy',
      data: [
        { x: 'a', y: 'p', v: NaN },
        { x: 'a', y: 'q', v: Infinity },
        { x: 'b', y: 'p', v: 10 },
        { x: 'b', y: 'q', v: 20 },
      ],
      xField: 'x',
      yField: 'y',
      valueField: 'v',
    });
    for (const cell of container.querySelectorAll<SVGRectElement>('.cinder-matrix-chart__cell')) {
      expect(cell.getAttribute('fill') ?? '').not.toContain('NaN');
    }
    // The two non-finite cells render with the "missing" inset surface fill.
    const fills = [...container.querySelectorAll('.cinder-matrix-chart__cell')].map((c) =>
      c.getAttribute('fill'),
    );
    expect(fills.filter((f) => f === 'var(--cinder-surface-inset)').length).toBe(2);
  });

  test('a degenerate domain (all equal values) does not divide by zero', () => {
    const { container } = render(MatrixChart, {
      label: 'Flat',
      data: [
        { x: 'a', y: 'p', v: 7 },
        { x: 'b', y: 'p', v: 7 },
      ],
      xField: 'x',
      yField: 'y',
      valueField: 'v',
    });
    for (const cell of container.querySelectorAll<SVGRectElement>('.cinder-matrix-chart__cell')) {
      const fill = cell.getAttribute('fill') ?? '';
      expect(fill).not.toContain('NaN');
      // Equal values map to the midpoint (50%).
      expect(fill).toContain('50%');
    }
  });

  test('the SVG exposes role="img"', () => {
    const { container } = render(MatrixChart, {
      label: 'Confusion matrix',
      data: confusionData,
      xField: 'predicted',
      yField: 'actual',
      valueField: 'count',
    });
    expect(container.querySelector('svg')?.getAttribute('role')).toBe('img');
  });

  test('category labels containing the delimiter do not collide', () => {
    // Regression: a flat "x::y" key would merge ("A::B","C") with ("A","B::C").
    const { container } = render(MatrixChart, {
      label: 'Delimiters',
      data: [
        { x: 'A::B', y: 'C', v: 11 },
        { x: 'A', y: 'B::C', v: 22 },
      ],
      xField: 'x',
      yField: 'y',
      valueField: 'v',
      dataTableVisibility: 'visible',
    });
    // Both distinct values must survive in the data table (no overwrite / collapse).
    const tableText = container.querySelector('table')?.textContent ?? '';
    expect(tableText).toContain('11');
    expect(tableText).toContain('22');
  });
});
