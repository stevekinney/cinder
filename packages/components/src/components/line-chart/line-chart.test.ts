/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

class TestResizeObserver {
  observe(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;

const { fireEvent, render } = await import('@testing-library/svelte');
const { default: LineChart } = await import('./line-chart.svelte');

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
    const plot = getByRole('application', { name: 'Monthly revenue plot area' });

    await fireEvent.focus(plot);
    expect(queryByText('Jan: 120')).toBeTruthy();

    await fireEvent.keyDown(plot, { key: 'Escape' });
    expect(queryByText('Jan: 120')).toBeNull();
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
});
