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

  test('data table supports distinct categories with the same formatted label', () => {
    const { container } = render(BarChart, {
      label: 'Revenue by month',
      dataTableVisibility: 'visible',
      data,
      categoryKey: 'month',
      series: [{ id: 'revenue', label: 'Revenue', valueKey: 'revenue' }],
      xAxis: { format: () => 'Same period' },
    });

    const rowHeaders = [...container.querySelectorAll('tbody th[scope="row"]')];
    expect(rowHeaders.map((header) => header.textContent)).toEqual(['Same period', 'Same period']);
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
    expect(container.querySelectorAll('[data-cinder-series-id="revenue"]').length).toBeGreaterThan(
      0,
    );

    await fireEvent.click(button);

    expect(container.querySelectorAll('[data-cinder-series="revenue"]').length).toBe(0);
    expect(container.querySelectorAll('[data-cinder-series-id="revenue"]').length).toBe(0);
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

  test('keyboard focus renders one visual-only SVG focus-ring layer', async () => {
    const { container, getByRole } = render(BarChart, {
      label: 'Revenue by month',
      data,
      categoryKey: 'month',
      series,
    });
    const target = getByRole('button', { name: 'Revenue, Jan, 120' });

    await fireEvent.focus(target);
    expect(container.querySelector('.cinder-bar-chart__focus-ring-layer')).toBeNull();
    await fireEvent.blur(target);
    await fireEvent.keyDown(window, { key: 'Tab' });
    await fireEvent.focus(target);

    expect(target.getAttribute('data-cinder-series-id')).toBe('revenue');
    expect(target.getAttribute('data-cinder-focus-ring-active')).toBe('true');
    const layers = container.querySelectorAll('.cinder-bar-chart__focus-ring-layer');
    expect(layers.length).toBe(1);
    const layer = layers[0];
    expect(layer?.getAttribute('aria-hidden')).toBe('true');
    expect(layer?.getAttribute('tabindex')).toBeNull();
    expect(layer?.getAttribute('role')).toBeNull();
    expect(layer?.getAttribute('aria-label')).toBeNull();
    expect(layer?.querySelectorAll('.cinder-bar-chart__focus-ring').length).toBeGreaterThan(0);
    expect(layer?.querySelectorAll('[tabindex], [role], [aria-label]').length).toBe(0);
  });

  test('pointer input hides a keyboard focus-ring layer without clearing the focused tooltip', async () => {
    const { container, getByRole, queryByText } = render(BarChart, {
      label: 'Revenue by month',
      data,
      categoryKey: 'month',
      series,
    });
    const target = getByRole('button', { name: 'Revenue, Jan, 120' });

    await fireEvent.keyDown(window, { key: 'Tab' });
    await fireEvent.focus(target);
    expect(container.querySelector('.cinder-bar-chart__focus-ring-layer')).not.toBeNull();
    expect(queryByText('Jan: 120')).toBeTruthy();

    await fireEvent.pointerDown(window);

    expect(target.getAttribute('data-cinder-focus-ring-active')).toBeNull();
    expect(container.querySelector('.cinder-bar-chart__focus-ring-layer')).toBeNull();
    expect(target.getAttribute('aria-describedby')).toBeTruthy();
    expect(queryByText('Jan: 120')).toBeTruthy();
  });

  test('hiding the focused series clears focus-ring and tooltip state', async () => {
    const { container, getByRole, queryByText } = render(BarChart, {
      label: 'Revenue by month',
      data,
      categoryKey: 'month',
      series,
    });
    const target = getByRole('button', { name: 'Revenue, Jan, 120' });

    await fireEvent.keyDown(window, { key: 'Tab' });
    await fireEvent.focus(target);
    expect(container.querySelector('.cinder-bar-chart__focus-ring-layer')).not.toBeNull();

    await fireEvent.click(getByRole('button', { name: 'Revenue' }));

    expect(container.querySelectorAll('[data-cinder-series-id="revenue"]').length).toBe(0);
    expect(container.querySelector('.cinder-bar-chart__focus-ring-layer')).toBeNull();
    expect(queryByText('Jan: 120')).toBeNull();
    expect(document.activeElement).not.toBe(target);
  });

  test('controlled hiddenSeriesIds clears stale focus-ring and tooltip state without a legend click', async () => {
    const { container, getByRole, queryByText, rerender } = render(BarChart, {
      label: 'Revenue by month',
      data,
      categoryKey: 'month',
      series,
    });
    const target = getByRole('button', { name: 'Revenue, Jan, 120' });

    await fireEvent.keyDown(window, { key: 'Tab' });
    await fireEvent.focus(target);
    expect(container.querySelector('.cinder-bar-chart__focus-ring-layer')).not.toBeNull();
    expect(queryByText('Jan: 120')).toBeTruthy();

    await rerender({
      label: 'Revenue by month',
      data,
      categoryKey: 'month',
      hiddenSeriesIds: ['revenue'],
      series,
    });

    expect(container.querySelectorAll('[data-cinder-series-id="revenue"]').length).toBe(0);
    expect(container.querySelector('.cinder-bar-chart__focus-ring-layer')).toBeNull();
    expect(queryByText('Jan: 120')).toBeNull();
    expect(document.activeElement).not.toBe(target);
  });

  test('arrow keys move DOM focus to the active target', async () => {
    const { container, getByRole, queryByText } = render(BarChart, {
      label: 'Revenue by month',
      data,
      categoryKey: 'month',
      series,
    });
    const firstTarget = getByRole('button', { name: 'Revenue, Jan, 120' });
    const secondTarget = getByRole('button', { name: 'Expansion, Jan, 30' });

    await fireEvent.focus(firstTarget);
    expect(container.querySelector('.cinder-bar-chart__focus-ring-layer')).toBeNull();
    await fireEvent.keyDown(firstTarget, { key: 'ArrowRight' });

    expect(document.activeElement).toBe(secondTarget);
    expect(secondTarget.getAttribute('data-cinder-focus-ring-active')).toBe('true');
    expect(container.querySelectorAll('.cinder-bar-chart__focus-ring-layer').length).toBe(1);
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

  test('Enter key on a role="button" focus target activates it (ARIA button widget contract)', async () => {
    // ARIA 1.2 §6.6.3: a role="button" element must respond to Enter and Space.
    let clickCount = 0;
    const { getByRole } = render(BarChart, {
      label: 'Revenue by month',
      data,
      categoryKey: 'month',
      series,
    });
    const target = getByRole('button', { name: 'Revenue, Jan, 120' });
    target.addEventListener('click', () => {
      clickCount++;
    });

    await fireEvent.focus(target);
    await fireEvent.keyDown(target, { key: 'Enter' });

    expect(clickCount).toBe(1);
  });

  test('Space key on a role="button" focus target activates it (ARIA button widget contract)', async () => {
    let clickCount = 0;
    const { getByRole } = render(BarChart, {
      label: 'Revenue by month',
      data,
      categoryKey: 'month',
      series,
    });
    const target = getByRole('button', { name: 'Revenue, Jan, 120' });
    target.addEventListener('click', () => {
      clickCount++;
    });

    await fireEvent.focus(target);
    await fireEvent.keyDown(target, { key: ' ' });

    expect(clickCount).toBe(1);
  });

  test('hovered bar gets data-cinder-active attribute for CSS hover engagement', async () => {
    const { container, getByRole } = render(BarChart, {
      label: 'Revenue by month',
      data,
      categoryKey: 'month',
      series,
    });

    // Before hover: no bar has data-cinder-active.
    expect(container.querySelector('.cinder-bar-chart__bar[data-cinder-active]')).toBeNull();

    // Focus a target to set activeTarget via the keyboard path (no pointer move needed).
    const target = getByRole('button', { name: 'Revenue, Jan, 120' });
    await fireEvent.focus(target);

    // The Revenue Jan bar should now be data-cinder-active.
    const activeBar = container.querySelector('.cinder-bar-chart__bar[data-cinder-active]');
    expect(activeBar).not.toBeNull();
    expect(activeBar?.getAttribute('data-cinder-series')).toBe('revenue');
    expect(activeBar?.getAttribute('data-cinder-category')).toBe('Jan');

    // After blur, the active bar should clear.
    await fireEvent.blur(target);
    expect(container.querySelector('.cinder-bar-chart__bar[data-cinder-active]')).toBeNull();
  });

  test('bar-chart CSS has a rule for data-cinder-active bars', async () => {
    const cssText = await Bun.file(new URL('./bar-chart.css', import.meta.url)).text();
    expect(cssText).toContain('.cinder-bar-chart__bar[data-cinder-active]');
  });
});
