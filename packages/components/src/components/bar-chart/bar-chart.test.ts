/// <reference lib="dom" />
import { afterAll, afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type { ChartXValue } from '../chart.types.ts';

setupHappyDom();

class TestResizeObserver {
  observe(): void {}
  disconnect(): void {}
}

const originalResizeObserver = globalThis.ResizeObserver;
globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;
afterAll(() => {
  globalThis.ResizeObserver = originalResizeObserver;
});

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

  test('svg has an accessible title matching the label when data is present', () => {
    const { container } = render(BarChart, {
      label: 'Revenue by month',
      data,
      categoryKey: 'month',
      series,
    });
    const svg = container.querySelector('svg');
    const title = svg?.querySelector('title');

    expect(svg?.getAttribute('role')).toBeNull();
    expect(title).not.toBeNull();
    expect(title?.textContent).toBe('Revenue by month');
    expect(svg?.getAttribute('aria-labelledby')).toBeTruthy();
  });

  test('svg has no title and is aria-hidden when loading', () => {
    const { container } = render(BarChart, {
      label: 'Revenue by month',
      loading: true,
      data,
      categoryKey: 'month',
      series,
    });
    const svg = container.querySelector('svg');

    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.querySelector('title')).toBeNull();
  });

  test('svg has no title and is aria-hidden when empty', () => {
    const { container } = render(BarChart, {
      label: 'Revenue by month',
      data: [],
      categoryKey: 'month',
      series,
    });
    const svg = container.querySelector('svg');

    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.querySelector('title')).toBeNull();
  });

  test('interactive focus targets are not inside an img-role element', () => {
    const { container } = render(BarChart, {
      label: 'Revenue by month',
      data,
      categoryKey: 'month',
      series,
    });
    const svg = container.querySelector('svg');

    // The svg must not carry role="img" — that is a leaf role that forbids
    // interactive descendants (nested-interactive axe violation).
    expect(svg?.getAttribute('role')).toBeNull();
    // The interactive buttons must still be present and focusable.
    const buttons = container.querySelectorAll('[role="button"][tabindex="0"]');
    expect(buttons.length).toBeGreaterThan(0);
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

  test('loading state clears an active tooltip', async () => {
    const { getByRole, queryByText, rerender } = render(BarChart, {
      label: 'Revenue by month',
      data,
      categoryKey: 'month',
      series,
    });

    await fireEvent.focus(getByRole('button', { name: 'Revenue, Jan, 120' }));
    expect(queryByText('Jan: 120')).toBeTruthy();

    await rerender({
      label: 'Revenue by month',
      loading: true,
      data,
      categoryKey: 'month',
      series,
    });
    expect(queryByText('Jan: 120')).toBeNull();
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

  test('arrow keys move DOM focus to the active target', async () => {
    const { getByRole, queryByText } = render(BarChart, {
      label: 'Revenue by month',
      data,
      categoryKey: 'month',
      series,
    });
    const firstTarget = getByRole('button', { name: 'Revenue, Jan, 120' });
    const secondTarget = getByRole('button', { name: 'Expansion, Jan, 30' });

    await fireEvent.focus(firstTarget);
    await fireEvent.keyDown(firstTarget, { key: 'ArrowRight' });

    expect(document.activeElement).toBe(secondTarget);
    expect(secondTarget?.getAttribute('aria-describedby')).toBeTruthy();
    expect(queryByText('Jan: 30')).toBeTruthy();
  });

  test('pointer hover does not override the focused target description', async () => {
    const { container, getByRole, queryByText } = render(BarChart, {
      label: 'Revenue by month',
      data,
      categoryKey: 'month',
      series,
    });
    const focusedTarget = getByRole('button', { name: 'Revenue, Jan, 120' });
    const hoveredTarget = getByRole('button', { name: 'Expansion, Jan, 30' });
    const hitSurface = container.querySelector('.cinder-bar-chart__hit-surface');

    await fireEvent.focus(focusedTarget);
    await fireEvent.pointerMove(hitSurface!, {
      clientX: Number(hoveredTarget.getAttribute('x')) + 6,
      clientY: Number(hoveredTarget.getAttribute('y')) + 6,
    });
    await fireEvent.pointerLeave(hitSurface!);

    expect(focusedTarget.getAttribute('aria-describedby')).toBeTruthy();
    expect(queryByText('Jan: 120')).toBeTruthy();
    expect(queryByText('Jan: 30')).toBeNull();
  });

  test('hides the data table when dataTableVisibility is "hidden"', () => {
    const { container, queryByText } = render(BarChart, {
      label: 'Hidden table',
      data,
      categoryKey: 'month',
      series,
      dataTableVisibility: 'hidden',
      maximumInteractivePoints: 1,
    });

    expect(container.querySelector('table')).toBeNull();
    expect(queryByText('Use the data table to inspect this chart with a keyboard.')).toBeNull();
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
