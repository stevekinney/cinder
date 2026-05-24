/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type { ChartXValue } from '../chart.types.ts';

setupHappyDom();

class TestResizeObserver {
  observe(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: BarChart } = await import('./bar-chart.svelte');

afterEach(() => cleanup());

const data = [
  { month: 'Jan', revenue: 120, expansion: 30 },
  { month: 'Feb', revenue: 180, expansion: 45 },
];
const series = [
  { id: 'revenue', label: 'Revenue', valueKey: 'revenue' },
  { id: 'expansion', label: 'Expansion', valueKey: 'expansion' },
];

describe('BarChart', () => {
  test('renders grouped vertical bars and a visible table', () => {
    const { container } = render(BarChart, {
      label: 'Revenue by month',
      dataTableVisibility: 'visible',
      data,
      categoryKey: 'month',
      series,
    });

    expect(container.querySelectorAll('.cinder-bar-chart__bar').length).toBe(4);
    expect(container.querySelector('[data-cinder-orientation="vertical"]')).not.toBeNull();
    expect(container.querySelector('table')?.className).not.toContain('cinder-sr-only');
  });

  test('renders horizontal stacked bars with distinct attributes', () => {
    const { container } = render(BarChart, {
      label: 'Revenue by month',
      data,
      categoryKey: 'month',
      series,
      orientation: 'horizontal',
      mode: 'stacked',
    });

    expect(container.querySelector('[data-cinder-orientation="horizontal"]')).not.toBeNull();
    expect(container.querySelector('[data-cinder-mode="stacked"]')).not.toBeNull();
  });

  test('legend toggle hides rendered bars for that series', async () => {
    const { getByRole, container } = render(BarChart, {
      label: 'Revenue by month',
      data,
      categoryKey: 'month',
      series,
    });
    const button = getByRole('button', { name: 'Revenue' });
    await fireEvent.click(button);
    expect(container.querySelectorAll('[data-cinder-series="revenue"]').length).toBe(0);
  });

  test('invalid value keys throw stable developer errors', () => {
    expect(() =>
      render(BarChart, {
        label: 'Bad chart',
        data: [{ month: 'Jan', revenue: '120' }],
        categoryKey: 'month',
        series: [{ id: 'revenue', label: 'Revenue', valueKey: 'revenue' }],
      }),
    ).toThrow('rule=invalid-bar-value');
  });

  test('loading state renders the loading indicator and hides the SVG', () => {
    const { getByText, container } = render(BarChart, {
      label: 'Loading',
      loading: true,
      data,
      categoryKey: 'month',
      series,
    });

    expect(getByText('Loading chart…')).toBeTruthy();
    expect(container.querySelector('[data-cinder-loading]')).not.toBeNull();
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  test('empty state renders the default fallback and silences the SVG', () => {
    const { getByText, container } = render(BarChart, {
      label: 'Empty',
      data: [],
      categoryKey: 'month',
      series,
    });

    expect(getByText('No chart data')).toBeTruthy();
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  test('keyboard focus shows the tooltip; Escape clears it', async () => {
    const { getByRole, queryByText } = render(BarChart, {
      label: 'Revenue by month',
      data,
      categoryKey: 'month',
      series,
    });
    const target = getByRole('button', { name: 'Revenue, Jan, 120' });

    await fireEvent.focus(target);
    expect(queryByText('Jan: 120')).toBeTruthy();

    await fireEvent.keyDown(target, { key: 'Escape' });
    expect(queryByText('Jan: 120')).toBeNull();
  });

  test('hides the data table when dataTableVisibility is "hidden"', () => {
    const { container } = render(BarChart, {
      label: 'Hidden table',
      data,
      categoryKey: 'month',
      series,
      dataTableVisibility: 'hidden',
    });

    expect(container.querySelector('table')).toBeNull();
  });

  test('renders formatted axis tick labels', () => {
    const { getAllByText } = render(BarChart, {
      label: 'Revenue by month',
      data: [{ month: 'Jan', revenue: 120 }],
      categoryKey: 'month',
      xAxis: { format: (value: ChartXValue) => `Month ${String(value)}` },
      yAxis: { format: (value: ChartXValue) => `$${String(value)}` },
      series: [{ id: 'revenue', label: 'Revenue', valueKey: 'revenue' }],
    });

    expect(getAllByText('Month Jan').length).toBeGreaterThan(0);
    expect(getAllByText('$120').length).toBeGreaterThan(0);
  });

  test('hiding all series reveals the empty state', async () => {
    const { getByRole, getByText } = render(BarChart, {
      label: 'Revenue by month',
      data,
      categoryKey: 'month',
      series,
    });
    await fireEvent.click(getByRole('button', { name: 'Revenue' }));
    await fireEvent.click(getByRole('button', { name: 'Expansion' }));
    expect(getByText('No chart data')).toBeTruthy();
  });

  test('horizontal orientation draws a horizontal crosshair through the active bar', async () => {
    const { container, getByRole } = render(BarChart, {
      label: 'Revenue by month',
      data,
      categoryKey: 'month',
      series: [{ id: 'revenue', label: 'Revenue', valueKey: 'revenue' }],
      orientation: 'horizontal',
    });
    const focusTarget = getByRole('button', { name: 'Revenue, Jan, 120' });
    await fireEvent.focus(focusTarget);

    const crosshair = container.querySelector('.cinder-bar-chart__crosshair');
    expect(crosshair).not.toBeNull();
    // A horizontal crosshair spans the x axis; y1 equals y2.
    expect(crosshair?.getAttribute('y1')).toBe(crosshair?.getAttribute('y2'));
    expect(crosshair?.getAttribute('x1')).not.toBe(crosshair?.getAttribute('x2'));
  });

  test('null values do not render zero-valued bars or table cells', () => {
    const { container } = render(BarChart, {
      label: 'Revenue by month',
      dataTableVisibility: 'visible',
      data: [{ month: 'Jan', revenue: null, expansion: 30 }],
      categoryKey: 'month',
      series,
    });
    const tableCellText = [...container.querySelectorAll('td, th')].map((cell) => cell.textContent);

    expect(container.querySelectorAll('.cinder-bar-chart__bar').length).toBe(1);
    expect(container.querySelector('table')?.textContent).toContain('30');
    expect(tableCellText).not.toContain('Revenue');
  });
});
