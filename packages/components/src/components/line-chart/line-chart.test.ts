/// <reference lib="dom" />
import { afterAll, afterEach, describe, expect, test } from 'bun:test';

import type { ChartTarget } from '../../_internal/chart/chart-utilities.ts';
import { setupHappyDom } from '../../test/happy-dom.ts';
import type { ChartMarkContext, ChartXValue } from '../chart.types.ts';

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
const { createRawSnippet } = await import('svelte');
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
  test('renders one line per series using the resolved categorical palette', () => {
    const { container } = render(LineChart, {
      label: 'Three trends',
      series: [...series, { id: 'retention', label: 'Retention', data: [{ x: 'Jan', y: 80 }] }],
    });

    const strokes = [...container.querySelectorAll('.cinder-line-chart__line')].map((path) =>
      path.getAttribute('stroke'),
    );
    expect(strokes).toEqual([
      'var(--cinder-chart-series-1)',
      'var(--cinder-chart-series-2)',
      'var(--cinder-chart-series-3)',
    ]);
  });

  test('inherits foreground and background from a dark container by default', () => {
    const { container } = render(LineChart, { label: 'Inherited theme', series });
    container.style.color = 'white';
    container.style.background = 'black';
    const root = container.querySelector<HTMLElement>('.cinder-line-chart');

    expect(root?.style.getPropertyValue('--cinder-chart-foreground')).toBe('currentColor');
    expect(root?.style.getPropertyValue('--cinder-chart-muted')).toBe('currentColor');
    expect(root?.style.getPropertyValue('--cinder-chart-grid')).toBe('currentColor');
    expect(root?.style.getPropertyValue('--cinder-chart-background')).toBe('transparent');
  });

  test('renders a custom mark snippet instead of the default series mark', () => {
    const mark = createRawSnippet<[ChartMarkContext]>((getContext) => ({
      render: () => {
        const context = getContext();
        return `<g data-custom-mark="${context.series.id}" data-point-count="${context.points.length}"></g>`;
      },
    }));
    const { container } = render(LineChart, { label: 'Custom marks', mark, series });

    expect(container.querySelectorAll('.cinder-line-chart__line')).toHaveLength(0);
    expect(
      container.querySelector('[data-custom-mark="revenue"]')?.getAttribute('data-point-count'),
    ).toBe('2');
  });

  test('renders a semantic data table fallback with caption', () => {
    const { container } = render(LineChart, {
      label: 'Monthly revenue',
      dataTableVisibility: 'visible',
      series,
    });

    expect(container.querySelector('table caption')?.textContent).toBe('Monthly revenue');
    expect(container.querySelector('table.cinder-table')).not.toBeNull();
    expect(container.querySelector('thead.cinder-table__header')).not.toBeNull();
    expect(container.querySelector('tbody.cinder-table__body')).not.toBeNull();
    expect(container.querySelector('tr.cinder-table__row')).not.toBeNull();
    expect(container.querySelector('th.cinder-table__header-cell')).not.toBeNull();
    expect(container.querySelector('td.cinder-table__cell')).not.toBeNull();
    expect(container.querySelector('table')?.className).not.toContain('cinder-sr-only');
  });

  test('svg has an accessible title matching the label when data is present', () => {
    const { container } = render(LineChart, { label: 'Monthly revenue', series });
    const svg = container.querySelector('svg');
    const title = svg?.querySelector('title');

    expect(svg?.getAttribute('role')).toBeNull();
    expect(title).not.toBeNull();
    expect(title?.textContent).toBe('Monthly revenue');
    expect(svg?.getAttribute('aria-labelledby')).toBeTruthy();
  });

  test('svg has no title and is aria-hidden when loading', () => {
    const { container } = render(LineChart, {
      label: 'Monthly revenue',
      loading: true,
      series,
    });
    const svg = container.querySelector('svg');

    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.querySelector('title')).toBeNull();
  });

  test('svg has no title and is aria-hidden when empty', () => {
    const { container } = render(LineChart, { label: 'Monthly revenue', series: [] });
    const svg = container.querySelector('svg');

    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.querySelector('title')).toBeNull();
  });

  test('interactive focus targets are not inside an img-role element', () => {
    const { container } = render(LineChart, { label: 'Monthly revenue', series });
    const svg = container.querySelector('svg');

    // The svg must not carry role="img" — that is a leaf role that forbids
    // interactive descendants (nested-interactive axe violation).
    expect(svg?.getAttribute('role')).toBeNull();
    // The interactive buttons must still be present and focusable.
    const buttons = container.querySelectorAll('[role="button"][tabindex="0"]');
    expect(buttons.length).toBeGreaterThan(0);
  });

  test('hides data table when requested', () => {
    const { container, queryByText } = render(LineChart, {
      label: 'Monthly revenue',
      dataTableVisibility: 'hidden',
      maximumInteractivePoints: 1,
      series,
    });

    expect(container.querySelector('table')).toBeNull();
    expect(queryByText('Use the data table to inspect this chart with a keyboard.')).toBeNull();
  });

  test('legend toggle hides and restores rendered series geometry', async () => {
    const { getByRole, container } = render(LineChart, { label: 'Monthly revenue', series });
    expect(container.querySelectorAll('[data-cinder-series="revenue"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-cinder-series-id="revenue"]').length).toBeGreaterThan(
      0,
    );

    const button = getByRole('button', { name: 'Revenue' });
    await fireEvent.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelectorAll('[data-cinder-series="revenue"]').length).toBe(0);
    expect(container.querySelectorAll('[data-cinder-series-id="revenue"]').length).toBe(0);

    await fireEvent.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelectorAll('[data-cinder-series="revenue"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-cinder-series-id="revenue"]').length).toBeGreaterThan(
      0,
    );
  });

  test('legendPosition="bottom" renders the legend after the plot and toggles series visibility', async () => {
    const { container, getByRole } = render(LineChart, {
      label: 'Monthly revenue',
      legendPosition: 'bottom',
      series,
    });

    const viewport = container.querySelector('.cinder-line-chart__viewport');
    const legend = container.querySelector('.cinder-line-chart__legend');
    expect(viewport).not.toBeNull();
    expect(legend).not.toBeNull();
    // "bottom" legend renders after the chart's plot content in DOM order.
    expect(
      viewport!.compareDocumentPosition(legend!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    expect(container.querySelectorAll('[data-cinder-series="revenue"]').length).toBeGreaterThan(0);
    const button = getByRole('button', { name: 'Revenue' });
    await fireEvent.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelectorAll('[data-cinder-series="revenue"]').length).toBe(0);
  });

  test('an invalid maximumInteractivePoints throws a stable developer error', () => {
    expect(() =>
      render(LineChart, {
        label: 'Bad chart',
        maximumInteractivePoints: -1,
        series,
      }),
    ).toThrow('rule=invalid-maximum-interactive-points');
  });

  test('does not render a visual tooltip unless the tooltip prop is enabled', async () => {
    const { getByRole, queryByText } = render(LineChart, { label: 'Monthly revenue', series });
    await fireEvent.focus(getByRole('button', { name: 'Revenue, Jan, 120' }));

    expect(queryByText('Jan: 120')).toBeNull();
  });

  test('keyboard focus shows an enabled tooltip and escape clears it', async () => {
    const { getByRole, queryByText } = render(LineChart, {
      label: 'Monthly revenue',
      tooltip: true,
      series,
    });
    const plot = getByRole('button', { name: 'Revenue, Jan, 120' });

    await fireEvent.focus(plot);
    expect(queryByText('Jan: 120')).toBeTruthy();

    await fireEvent.keyDown(plot, { key: 'Escape' });
    expect(queryByText('Jan: 120')).toBeNull();
  });

  test('renders custom tooltip content with the active semantic target', async () => {
    const tooltip = createRawSnippet<[ChartTarget]>((getTarget) => ({
      render: () => `<span data-custom-tooltip>${getTarget().seriesLabel} insight</span>`,
    }));
    const { getByRole, findByText } = render(LineChart, {
      label: 'Monthly revenue',
      tooltip,
      series,
    });

    await fireEvent.focus(getByRole('button', { name: 'Revenue, Jan, 120' }));
    expect(await findByText('Revenue insight')).toBeTruthy();
  });

  test('keyboard focus renders one visual-only SVG focus-ring layer', async () => {
    const { container, getByRole } = render(LineChart, { label: 'Monthly revenue', series });
    const target = getByRole('button', { name: 'Revenue, Jan, 120' });

    await fireEvent.focus(target);
    expect(container.querySelector('.cinder-line-chart__focus-ring-layer')).toBeNull();
    await fireEvent.blur(target);
    await fireEvent.keyDown(window, { key: 'Tab' });
    await fireEvent.focus(target);

    expect(target.getAttribute('data-cinder-series-id')).toBe('revenue');
    expect(target.getAttribute('data-cinder-focus-ring-active')).toBe('true');
    const layers = container.querySelectorAll('.cinder-line-chart__focus-ring-layer');
    expect(layers.length).toBe(1);
    const layer = layers[0];
    expect(layer?.getAttribute('aria-hidden')).toBe('true');
    expect(layer?.getAttribute('tabindex')).toBeNull();
    expect(layer?.getAttribute('role')).toBeNull();
    expect(layer?.getAttribute('aria-label')).toBeNull();
    expect(layer?.querySelectorAll('.cinder-line-chart__focus-ring').length).toBeGreaterThan(0);
    expect(layer?.querySelectorAll('[tabindex], [role], [aria-label]').length).toBe(0);
  });

  test('pointer input hides a keyboard focus-ring layer without clearing the focused tooltip', async () => {
    const { container, getByRole, queryByText } = render(LineChart, {
      label: 'Monthly revenue',
      tooltip: true,
      series,
    });
    const target = getByRole('button', { name: 'Revenue, Jan, 120' });

    await fireEvent.keyDown(window, { key: 'Tab' });
    await fireEvent.focus(target);
    expect(container.querySelector('.cinder-line-chart__focus-ring-layer')).not.toBeNull();
    expect(queryByText('Jan: 120')).toBeTruthy();

    await fireEvent.pointerDown(window);

    expect(target.getAttribute('data-cinder-focus-ring-active')).toBeNull();
    expect(container.querySelector('.cinder-line-chart__focus-ring-layer')).toBeNull();
    expect(target.getAttribute('aria-describedby')).toBeTruthy();
    expect(queryByText('Jan: 120')).toBeTruthy();
  });

  test('hiding the focused series clears focus-ring and tooltip state', async () => {
    const { container, getByRole, queryByText } = render(LineChart, {
      label: 'Monthly revenue',
      tooltip: true,
      series,
    });
    const target = getByRole('button', { name: 'Revenue, Jan, 120' });

    await fireEvent.keyDown(window, { key: 'Tab' });
    await fireEvent.focus(target);
    expect(container.querySelector('.cinder-line-chart__focus-ring-layer')).not.toBeNull();

    await fireEvent.click(getByRole('button', { name: 'Revenue' }));

    expect(container.querySelectorAll('[data-cinder-series-id="revenue"]').length).toBe(0);
    expect(container.querySelector('.cinder-line-chart__focus-ring-layer')).toBeNull();
    expect(queryByText('Jan: 120')).toBeNull();
    expect(document.activeElement).not.toBe(target);
  });

  test('controlled hiddenSeriesIds clears stale focus-ring and tooltip state without a legend click', async () => {
    const { container, getByRole, queryByText, rerender } = render(LineChart, {
      label: 'Monthly revenue',
      tooltip: true,
      series,
    });
    const target = getByRole('button', { name: 'Revenue, Jan, 120' });

    await fireEvent.keyDown(window, { key: 'Tab' });
    await fireEvent.focus(target);
    expect(container.querySelector('.cinder-line-chart__focus-ring-layer')).not.toBeNull();
    expect(queryByText('Jan: 120')).toBeTruthy();

    await rerender({
      label: 'Monthly revenue',
      hiddenSeriesIds: ['revenue'],
      tooltip: true,
      series,
    });

    expect(container.querySelectorAll('[data-cinder-series-id="revenue"]').length).toBe(0);
    expect(container.querySelector('.cinder-line-chart__focus-ring-layer')).toBeNull();
    expect(queryByText('Jan: 120')).toBeNull();
    expect(document.activeElement).not.toBe(target);
  });

  test('arrow keys move DOM focus to the active target', async () => {
    const { container, getByRole, queryByText } = render(LineChart, {
      label: 'Monthly revenue',
      tooltip: true,
      series,
    });
    const firstTarget = getByRole('button', { name: 'Revenue, Jan, 120' });
    const secondTarget = getByRole('button', { name: 'Signups, Jan, 40' });

    await fireEvent.focus(firstTarget);
    expect(container.querySelector('.cinder-line-chart__focus-ring-layer')).toBeNull();
    await fireEvent.keyDown(firstTarget, { key: 'ArrowRight' });

    expect(document.activeElement).toBe(secondTarget);
    expect(secondTarget.getAttribute('data-cinder-focus-ring-active')).toBe('true');
    expect(container.querySelectorAll('.cinder-line-chart__focus-ring-layer').length).toBe(1);
    expect(secondTarget?.getAttribute('aria-describedby')).toBeTruthy();
    expect(queryByText('Jan: 40')).toBeTruthy();
  });

  test('pointer hover does not override the focused target description', async () => {
    const { container, getByRole, queryByText } = render(LineChart, {
      label: 'Monthly revenue',
      tooltip: true,
      series,
    });
    const focusedTarget = getByRole('button', { name: 'Revenue, Jan, 120' });
    const hoveredTarget = getByRole('button', { name: 'Signups, Jan, 40' });
    const hitSurface = container.querySelector('.cinder-line-chart__hit-surface');

    await fireEvent.focus(focusedTarget);
    await fireEvent.pointerMove(hitSurface!, {
      clientX: Number(hoveredTarget.getAttribute('cx')),
      clientY: Number(hoveredTarget.getAttribute('cy')),
    });
    await fireEvent.pointerLeave(hitSurface!);

    expect(focusedTarget.getAttribute('aria-describedby')).toBeTruthy();
    expect(queryByText('Jan: 120')).toBeTruthy();
    expect(queryByText('Jan: 40')).toBeNull();
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

  test('loading state renders no tabbable focus targets or plot marks even with non-empty series', () => {
    const { container } = render(LineChart, {
      label: 'Loading chart',
      loading: true,
      series,
    });

    // The svg itself is aria-hidden while loading; nothing inside it may be
    // reachable by keyboard, or a Tab press lands on a hidden focus target.
    expect(container.querySelectorAll('[role="button"][tabindex="0"]').length).toBe(0);
    expect(container.querySelectorAll('.cinder-line-chart__line').length).toBe(0);
  });

  test('non-loading, non-empty state renders plot marks', () => {
    const { container } = render(LineChart, {
      label: 'Monthly revenue',
      tooltip: true,
      series,
    });

    expect(container.querySelectorAll('.cinder-line-chart__line').length).toBeGreaterThan(0);
  });

  test('loading state clears an active tooltip', async () => {
    const { getByRole, queryByText, rerender } = render(LineChart, {
      label: 'Monthly revenue',
      tooltip: true,
      series,
    });

    await fireEvent.focus(getByRole('button', { name: 'Revenue, Jan, 120' }));
    expect(queryByText('Jan: 120')).toBeTruthy();

    await rerender({ label: 'Monthly revenue', loading: true, tooltip: true, series });
    expect(queryByText('Jan: 120')).toBeNull();
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
