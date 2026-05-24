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
const { default: LineChart } = await import('./line-chart.svelte');

afterEach(() => cleanup());

const series = [
  {
    id: 'revenue',
    label: 'Revenue',
    data: [
      { x: 'Jan', y: 120 },
      { x: 'Feb', y: 180 },
    ],
  },
  {
    id: 'signups',
    label: 'Signups',
    data: [
      { x: 'Jan', y: 40 },
      { x: 'Feb', y: 55 },
    ],
  },
];

describe('LineChart', () => {
  test('renders a semantic data table fallback with caption', () => {
    const { getByText, container } = render(LineChart, {
      label: 'Monthly revenue',
      dataTableVisibility: 'visible',
      series,
    });

    expect(getByText('Monthly revenue')).toBeTruthy();
    expect(container.querySelector('table')?.className).not.toContain('cinder-sr-only');
  });

  test('hides data table when requested', () => {
    const { container } = render(LineChart, {
      label: 'Monthly revenue',
      dataTableVisibility: 'hidden',
      series,
    });

    expect(container.querySelector('table')).toBeNull();
  });

  test('legend toggle hides and restores rendered series geometry', async () => {
    const { getByRole, container } = render(LineChart, { label: 'Monthly revenue', series });
    expect(container.querySelectorAll('[data-cinder-series="revenue"]').length).toBeGreaterThan(0);

    const button = getByRole('button', { name: 'Revenue' });
    await fireEvent.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelectorAll('[data-cinder-series="revenue"]').length).toBe(0);

    await fireEvent.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelectorAll('[data-cinder-series="revenue"]').length).toBeGreaterThan(0);
  });

  test('keyboard focus shows tooltip and escape clears it', async () => {
    const { getByRole, queryByText } = render(LineChart, { label: 'Monthly revenue', series });
    const plot = getByRole('button', { name: 'Revenue, Jan, 120' });

    await fireEvent.focus(plot);
    expect(queryByText('Jan: 120')).toBeTruthy();

    await fireEvent.keyDown(plot, { key: 'Escape' });
    expect(queryByText('Jan: 120')).toBeNull();
  });

  test('visible table follows formatted visible series state', async () => {
    const { getByRole, queryByText } = render(LineChart, {
      label: 'Monthly revenue',
      dataTableVisibility: 'visible',
      yAxis: { format: (value: string | number | Date) => `$${String(value)}` },
      series,
    });

    expect(queryByText('$120')).toBeTruthy();
    await fireEvent.click(getByRole('button', { name: 'Revenue' }));
    expect(queryByText('$120')).toBeNull();
    expect(queryByText('$40')).toBeTruthy();
  });

  test('renders formatted axis tick labels', () => {
    const { getAllByText } = render(LineChart, {
      label: 'Monthly revenue',
      xAxis: { format: (value: ChartXValue) => `Month ${String(value)}` },
      yAxis: { format: (value: ChartXValue) => `$${String(value)}` },
      series: [{ id: 'revenue', label: 'Revenue', data: [{ x: 'Jan', y: 120 }] }],
    });

    expect(getAllByText('Month Jan').length).toBeGreaterThan(0);
    expect(getAllByText('$120').length).toBeGreaterThan(0);
  });

  test('duplicate x values throw a stable developer error', () => {
    expect(() =>
      render(LineChart, {
        label: 'Bad chart',
        series: [
          {
            id: 'a',
            label: 'A',
            data: [
              { x: 'Jan', y: 1 },
              { x: 'Jan', y: 2 },
            ],
          },
        ],
      }),
    ).toThrow('rule=duplicate-x');
  });

  test('loading state renders the loading indicator and hides the SVG', () => {
    const { getByText, container } = render(LineChart, {
      label: 'Loading chart',
      loading: true,
      series,
    });

    expect(getByText('Loading chart…')).toBeTruthy();
    expect(container.querySelector('[data-cinder-loading]')).not.toBeNull();
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  test('empty state renders the default fallback when series are empty', () => {
    const { getByText, container } = render(LineChart, {
      label: 'Empty chart',
      series: [],
    });

    expect(getByText('No chart data')).toBeTruthy();
    // SVG is silenced for screen readers in the empty state — no meaningful
    // content to announce.
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  test('hiding all series reveals the empty state', async () => {
    const { getByRole, getByText, container } = render(LineChart, {
      label: 'Monthly revenue',
      series,
    });

    await fireEvent.click(getByRole('button', { name: 'Revenue' }));
    await fireEvent.click(getByRole('button', { name: 'Signups' }));

    expect(getByText('No chart data')).toBeTruthy();
    expect(container.querySelectorAll('path.cinder-line-chart__line').length).toBe(0);
  });

  test('disables keyboard targets when targets exceed maximumInteractivePoints', () => {
    const bigData = Array.from({ length: 6 }, (_, index) => ({ x: `p${index}`, y: index }));
    const { container } = render(LineChart, {
      label: 'Big chart',
      maximumInteractivePoints: 5,
      series: [{ id: 's', label: 'S', data: bigData }],
    });

    // No focusable per-point button rendered when over the threshold.
    expect(container.querySelectorAll('[role="button"][tabindex="0"]').length).toBe(0);
  });
});
