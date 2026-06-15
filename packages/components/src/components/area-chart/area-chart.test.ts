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
    expect(container.querySelectorAll('[data-cinder-series-id="usage"]').length).toBeGreaterThan(0);

    await fireEvent.click(button);

    expect(container.querySelectorAll('[data-cinder-series="usage"]').length).toBe(0);
    expect(container.querySelectorAll('[data-cinder-series-id="usage"]').length).toBe(0);
  });

  test('svg has an accessible title matching the label when data is present', () => {
    const { container } = render(AreaChart, { label: 'Usage trend', series });
    const svg = container.querySelector('svg');
    const title = svg?.querySelector('title');

    expect(svg?.getAttribute('role')).toBeNull();
    expect(title).not.toBeNull();
    expect(title?.textContent).toBe('Usage trend');
    expect(svg?.getAttribute('aria-labelledby')).toBeTruthy();
  });

  test('svg has no title and is aria-hidden when loading', () => {
    const { container } = render(AreaChart, { label: 'Usage trend', loading: true, series });
    const svg = container.querySelector('svg');

    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.querySelector('title')).toBeNull();
  });

  test('svg has no title and is aria-hidden when empty', () => {
    const { container } = render(AreaChart, { label: 'Usage trend', series: [] });
    const svg = container.querySelector('svg');

    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.querySelector('title')).toBeNull();
  });

  test('interactive focus targets are not inside an img-role element', () => {
    const { container } = render(AreaChart, { label: 'Usage trend', series });
    const svg = container.querySelector('svg');

    // The svg must not carry role="img" — that is a leaf role that forbids
    // interactive descendants (nested-interactive axe violation).
    expect(svg?.getAttribute('role')).toBeNull();
    // The interactive buttons must still be present and focusable.
    const buttons = container.querySelectorAll('[role="button"][tabindex="0"]');
    expect(buttons.length).toBeGreaterThan(0);
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

  test('keyboard focus renders one visual-only SVG focus-ring layer', async () => {
    const { container, getByRole } = render(AreaChart, { label: 'Usage trend', series });
    const target = getByRole('button', { name: 'Usage, Jan, 30' });

    await fireEvent.focus(target);
    expect(container.querySelector('.cinder-area-chart__focus-ring-layer')).toBeNull();
    await fireEvent.blur(target);
    await fireEvent.keyDown(window, { key: 'Tab' });
    await fireEvent.focus(target);

    expect(target.getAttribute('data-cinder-series-id')).toBe('usage');
    expect(target.getAttribute('data-cinder-focus-ring-active')).toBe('true');
    const layers = container.querySelectorAll('.cinder-area-chart__focus-ring-layer');
    expect(layers.length).toBe(1);
    const layer = layers[0];
    expect(layer?.getAttribute('aria-hidden')).toBe('true');
    expect(layer?.getAttribute('tabindex')).toBeNull();
    expect(layer?.getAttribute('role')).toBeNull();
    expect(layer?.getAttribute('aria-label')).toBeNull();
    expect(layer?.querySelectorAll('.cinder-area-chart__focus-ring').length).toBeGreaterThan(0);
    expect(layer?.querySelectorAll('[tabindex], [role], [aria-label]').length).toBe(0);
  });

  test('pointer input hides a keyboard focus-ring layer without clearing the focused tooltip', async () => {
    const { container, getByRole, queryByText } = render(AreaChart, {
      label: 'Usage trend',
      series,
    });
    const target = getByRole('button', { name: 'Usage, Jan, 30' });

    await fireEvent.keyDown(window, { key: 'Tab' });
    await fireEvent.focus(target);
    expect(container.querySelector('.cinder-area-chart__focus-ring-layer')).not.toBeNull();
    expect(queryByText('Jan: 30')).toBeTruthy();

    await fireEvent.pointerDown(window);

    expect(target.getAttribute('data-cinder-focus-ring-active')).toBeNull();
    expect(container.querySelector('.cinder-area-chart__focus-ring-layer')).toBeNull();
    expect(target.getAttribute('aria-describedby')).toBeTruthy();
    expect(queryByText('Jan: 30')).toBeTruthy();
  });

  test('hiding the focused series clears focus-ring and tooltip state', async () => {
    const { container, getByRole, queryByText } = render(AreaChart, {
      label: 'Usage trend',
      series,
    });
    const target = getByRole('button', { name: 'Usage, Jan, 30' });

    await fireEvent.keyDown(window, { key: 'Tab' });
    await fireEvent.focus(target);
    expect(container.querySelector('.cinder-area-chart__focus-ring-layer')).not.toBeNull();

    await fireEvent.click(getByRole('button', { name: 'Usage' }));

    expect(container.querySelectorAll('[data-cinder-series-id="usage"]').length).toBe(0);
    expect(container.querySelector('.cinder-area-chart__focus-ring-layer')).toBeNull();
    expect(queryByText('Jan: 30')).toBeNull();
    expect(document.activeElement).not.toBe(target);
  });

  test('controlled hiddenSeriesIds clears stale focus-ring and tooltip state without a legend click', async () => {
    const { container, getByRole, queryByText, rerender } = render(AreaChart, {
      label: 'Usage trend',
      series,
    });
    const target = getByRole('button', { name: 'Usage, Jan, 30' });

    await fireEvent.keyDown(window, { key: 'Tab' });
    await fireEvent.focus(target);
    expect(container.querySelector('.cinder-area-chart__focus-ring-layer')).not.toBeNull();
    expect(queryByText('Jan: 30')).toBeTruthy();

    await rerender({ label: 'Usage trend', hiddenSeriesIds: ['usage'], series });

    expect(container.querySelectorAll('[data-cinder-series-id="usage"]').length).toBe(0);
    expect(container.querySelector('.cinder-area-chart__focus-ring-layer')).toBeNull();
    expect(queryByText('Jan: 30')).toBeNull();
    expect(document.activeElement).not.toBe(target);
  });

  test('arrow keys move DOM focus to the active target', async () => {
    const { container, getByRole, queryByText } = render(AreaChart, {
      label: 'Usage trend',
      series,
    });
    const firstTarget = getByRole('button', { name: 'Usage, Jan, 30' });
    const secondTarget = getByRole('button', { name: 'Storage, Jan, 15' });

    await fireEvent.focus(firstTarget);
    expect(container.querySelector('.cinder-area-chart__focus-ring-layer')).toBeNull();
    await fireEvent.keyDown(firstTarget, { key: 'ArrowRight' });

    expect(document.activeElement).toBe(secondTarget);
    expect(secondTarget.getAttribute('data-cinder-focus-ring-active')).toBe('true');
    expect(container.querySelectorAll('.cinder-area-chart__focus-ring-layer').length).toBe(1);
    expect(secondTarget?.getAttribute('aria-describedby')).toBeTruthy();
    expect(queryByText('Jan: 15')).toBeTruthy();
  });

  test('pointer hover does not override the focused target description', async () => {
    const { container, getByRole, queryByText } = render(AreaChart, {
      label: 'Usage trend',
      series,
    });
    const focusedTarget = getByRole('button', { name: 'Usage, Jan, 30' });
    const hoveredTarget = getByRole('button', { name: 'Storage, Jan, 15' });
    const hitSurface = container.querySelector('.cinder-area-chart__hit-surface');

    await fireEvent.focus(focusedTarget);
    await fireEvent.pointerMove(hitSurface!, {
      clientX: Number(hoveredTarget.getAttribute('cx')),
      clientY: Number(hoveredTarget.getAttribute('cy')),
    });
    await fireEvent.pointerLeave(hitSurface!);

    expect(focusedTarget.getAttribute('aria-describedby')).toBeTruthy();
    expect(queryByText('Jan: 30')).toBeTruthy();
    expect(queryByText('Jan: 15')).toBeNull();
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

  test('Enter key on a role="button" focus target activates it (ARIA button widget contract)', async () => {
    // ARIA 1.2 §6.6.3: a role="button" element must respond to Enter and Space
    // by dispatching a click. This test verifies Enter triggers the same click
    // event that pointer interaction would, keeping the keyboard-accessible path parity.
    let clickCount = 0;
    const { getByRole } = render(AreaChart, { label: 'Usage trend', series });
    const target = getByRole('button', { name: 'Usage, Jan, 30' });
    target.addEventListener('click', () => {
      clickCount++;
    });

    await fireEvent.focus(target);
    await fireEvent.keyDown(target, { key: 'Enter' });

    expect(clickCount).toBe(1);
  });

  test('Space key on a role="button" focus target activates it (ARIA button widget contract)', async () => {
    let clickCount = 0;
    const { getByRole } = render(AreaChart, { label: 'Usage trend', series });
    const target = getByRole('button', { name: 'Usage, Jan, 30' });
    target.addEventListener('click', () => {
      clickCount++;
    });

    await fireEvent.focus(target);
    await fireEvent.keyDown(target, { key: ' ' });

    expect(clickCount).toBe(1);
  });
});
