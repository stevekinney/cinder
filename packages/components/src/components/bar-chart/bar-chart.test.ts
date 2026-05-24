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
const { default: BarChart } = await import('./bar-chart.svelte');

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
