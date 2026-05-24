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
const { default: AreaChart } = await import('./area-chart.svelte');

afterEach(() => cleanup());

const series = [
  {
    id: 'usage',
    label: 'Usage',
    data: [
      { x: 'Jan', y: 30 },
      { x: 'Feb', y: 45 },
    ],
  },
  {
    id: 'storage',
    label: 'Storage',
    data: [
      { x: 'Jan', y: 15 },
      { x: 'Feb', y: 24 },
    ],
  },
];

describe('AreaChart', () => {
  test('renders area geometry and a screen-reader table by default', () => {
    const { container } = render(AreaChart, { label: 'Usage trend', series });

    expect(container.querySelector('.cinder-area-chart__area')).not.toBeNull();
    expect(container.querySelector('table')?.className).toContain('cinder-sr-only');
  });

  test('stacked mode marks the chart mode', () => {
    const { container } = render(AreaChart, { label: 'Usage trend', mode: 'stacked', series });
    expect(container.querySelector('[data-cinder-mode="stacked"]')).not.toBeNull();
  });

  test('stacked mode draws upper series from cumulative offsets', () => {
    const { container } = render(AreaChart, { label: 'Usage trend', mode: 'stacked', series });
    const paths = [...container.querySelectorAll('.cinder-area-chart__area')].map((path) =>
      path.getAttribute('d'),
    );

    expect(paths[0]).not.toBe(paths[1]);
    expect(paths[1]).toContain('Z');
  });

  test('stacked mode rejects negative values', () => {
    expect(() =>
      render(AreaChart, {
        label: 'Bad chart',
        mode: 'stacked',
        series: [{ id: 'a', label: 'A', data: [{ x: 'Jan', y: -1 }] }],
      }),
    ).toThrow('rule=negative-stacked-area');
  });

  test('legend toggle hides area geometry', async () => {
    const { getByRole, container } = render(AreaChart, { label: 'Usage trend', series });
    const button = getByRole('button', { name: 'Usage' });
    await fireEvent.click(button);
    expect(container.querySelectorAll('[data-cinder-series="usage"]').length).toBe(0);
  });

  test('loading state renders the loading indicator and hides the SVG', () => {
    const { getByText, container } = render(AreaChart, {
      label: 'Loading',
      loading: true,
      series,
    });

    expect(getByText('Loading chart…')).toBeTruthy();
    expect(container.querySelector('[data-cinder-loading]')).not.toBeNull();
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  test('loading state clears an active tooltip', async () => {
    const { getByRole, queryByText, rerender } = render(AreaChart, {
      label: 'Usage trend',
      series,
    });

    await fireEvent.focus(getByRole('button', { name: 'Usage, Jan, 30' }));
    expect(queryByText('Jan: 30')).toBeTruthy();

    await rerender({ label: 'Usage trend', loading: true, series });
    expect(queryByText('Jan: 30')).toBeNull();
  });

  test('empty state renders the default fallback and silences the SVG', () => {
    const { getByText, container } = render(AreaChart, {
      label: 'Empty',
      series: [],
    });

    expect(getByText('No chart data')).toBeTruthy();
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  test('keyboard focus shows the tooltip; Escape clears it', async () => {
    const { getByRole, queryByText } = render(AreaChart, { label: 'Usage trend', series });
    const target = getByRole('button', { name: 'Usage, Jan, 30' });

    await fireEvent.focus(target);
    expect(queryByText('Jan: 30')).toBeTruthy();

    await fireEvent.keyDown(target, { key: 'Escape' });
    expect(queryByText('Jan: 30')).toBeNull();
  });

  test('renders formatted axis tick labels', () => {
    const { getAllByText } = render(AreaChart, {
      label: 'Usage trend',
      xAxis: { format: (value: ChartXValue) => `Month ${String(value)}` },
      yAxis: { format: (value: ChartXValue) => `${String(value)} GB` },
      series: [{ id: 'usage', label: 'Usage', data: [{ x: 'Jan', y: 30 }] }],
    });

    expect(getAllByText('Month Jan').length).toBeGreaterThan(0);
    expect(getAllByText('30 GB').length).toBeGreaterThan(0);
  });

  test('hides the data table when dataTableVisibility is "hidden"', () => {
    const { container, queryByText } = render(AreaChart, {
      label: 'Hidden table',
      series,
      dataTableVisibility: 'hidden',
      maximumInteractivePoints: 1,
    });

    expect(container.querySelector('table')).toBeNull();
    expect(queryByText('Use the data table to inspect this chart with a keyboard.')).toBeNull();
  });

  test('hiding all series reveals the empty state', async () => {
    const { getByRole, getByText } = render(AreaChart, { label: 'Usage trend', series });
    await fireEvent.click(getByRole('button', { name: 'Usage' }));
    await fireEvent.click(getByRole('button', { name: 'Storage' }));
    expect(getByText('No chart data')).toBeTruthy();
  });
});
