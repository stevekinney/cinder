/// <reference lib="dom" />
import { setupHappyDom } from '@lostgradient/testing';
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import type { DonutChartDatum } from './donut-chart.types.ts';
setupHappyDom();
const { fireEvent, render } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: DonutChart } = await import('./donut-chart.svelte');
describe('DonutChart', () => {
  test('allows a scrollable root to shrink while preserving internal chart width', () => {
    const css = readFileSync(new URL('./donut-chart.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.cinder-donut-chart--scrollable\s*\{[\s\S]*min-inline-size:\s*0/);
    expect(css).toMatch(
      /\.cinder-donut-chart--scrollable figure\s*\{[\s\S]*min-inline-size:\s*12rem/,
    );
  });
  test('renders arcs and total', () => {
    const { container } = render(DonutChart, {
      label: 'Traffic',
      data: [
        { id: 'direct', label: 'Direct', value: 3 },
        { id: 'search', label: 'Search', value: 2 },
      ],
    });
    expect(container.querySelectorAll('path')).toHaveLength(2);
    expect(container.textContent).toContain('5');
  });
  test('renders a complete arc for a full-circle series', () => {
    const { container } = render(DonutChart, {
      label: 'Traffic',
      data: [{ id: 'direct', label: 'Direct', value: 5 }],
    });
    const path = container.querySelector('path');
    expect(path?.getAttribute('d')).toContain('A 88 88 0 1 1');
    expect(path?.getAttribute('d')).not.toContain('NaN');
  });
  test('supports labels and click', () => {
    let clicked = -1;
    const { container } = render(DonutChart, {
      label: 'Traffic',
      data: [{ id: 'direct', label: 'Direct', value: 3 }],
      valueLabels: true,
      onSeriesClick: (_datum: DonutChartDatum, index: number) => (clicked = index),
    });
    expect(container.textContent).toContain('Direct');
    container.querySelector('g')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(clicked).toBe(0);
  });

  test('renders each value label with the matching series color swatch', () => {
    const { container } = render(DonutChart, {
      label: 'Traffic',
      data: [
        { id: 'direct', label: 'Direct', value: 3, color: '#ef4444' },
        { id: 'search', label: 'Search', value: 2, color: '#3b82f6' },
      ],
      valueLabels: true,
    });
    const swatches = container.querySelectorAll('.cinder-donut-chart__legend-swatch');

    expect(swatches).toHaveLength(2);
    expect(swatches[0]?.getAttribute('style')).toContain('background-color: #ef4444');
    expect(swatches[1]?.getAttribute('style')).toContain('background-color: #3b82f6');
  });
  test('activates interactive series from the keyboard', async () => {
    let clicked = -1;
    const { container } = render(DonutChart, {
      label: 'Traffic',
      data: [{ id: 'direct', label: 'Direct', value: 3 }],
      onSeriesClick: (_datum: DonutChartDatum, index: number) => (clicked = index),
    });
    const series = container.querySelector('[role="button"]') as SVGGElement;
    await fireEvent.keyDown(series, { key: 'Enter' });
    expect(clicked).toBe(0);
    expect(container.querySelector('svg')?.getAttribute('role')).toBeNull();
  });

  test('provides a visible focus indicator for keyboard-activated series', () => {
    const css = readFileSync(new URL('./donut-chart.css', import.meta.url), 'utf8');
    expect(css).toContain("g[role='button']:focus-visible .cinder-donut-chart__focus-ring-layer");
    expect(css).toContain('stroke-width: var(--cinder-ring-width)');
    expect(css).toContain('vector-effect: non-scaling-stroke');
    expect(css).toContain('@media (forced-colors: active)');
  });

  test('does not expose zero-area series as interactive controls', async () => {
    const clicked: number[] = [];
    const { container } = render(DonutChart, {
      label: 'Traffic',
      data: [
        { id: 'empty', label: 'Empty', value: 0 },
        { id: 'direct', label: 'Direct', value: 3 },
        { id: 'invalid', label: 'Invalid', value: -1 },
      ],
      onSeriesClick: (_datum: DonutChartDatum, index: number) => clicked.push(index),
    });
    const series = container.querySelectorAll('[role="button"]');

    expect(series).toHaveLength(1);
    expect(series[0]?.getAttribute('aria-label')).toBe('Direct: 3');
    expect(container.querySelectorAll('[tabindex="0"]')).toHaveLength(1);

    await fireEvent.click(container.querySelectorAll('g')[0]!);
    expect(clicked).toEqual([]);
  });

  test('provides an accessible series summary when the legend is hidden', () => {
    const { container } = render(DonutChart, {
      label: 'Traffic',
      data: [{ id: 'direct', label: 'Direct', value: 3 }],
    });
    expect(container.querySelector('.cinder-sr-only')?.textContent).toContain('Direct: 3');
  });

  test('normalizes negative values consistently across the chart and summaries', () => {
    const { container } = render(DonutChart, {
      label: 'Traffic',
      data: [
        { id: 'direct', label: 'Direct', value: -3 },
        { id: 'search', label: 'Search', value: 2 },
      ],
      valueLabels: true,
    });
    expect(container.textContent).toContain('2');
    expect(container.textContent).not.toContain('-3');
    expect(container.querySelector('.cinder-donut-chart__total')?.textContent).toBe('2');
    expect(container.querySelectorAll('path')[0]?.getAttribute('d')).not.toContain('NaN');
  });

  test('normalizes non-finite values before rendering arcs and accessible summaries', () => {
    const { container } = render(DonutChart, {
      label: 'Traffic',
      data: [
        { id: 'direct', label: 'Direct', value: 3 },
        { id: 'search', label: 'Search', value: Number.NaN },
        { id: 'referral', label: 'Referral', value: Number.POSITIVE_INFINITY },
        { id: 'email', label: 'Email', value: Number.NEGATIVE_INFINITY },
        { id: 'social', label: 'Social', value: 2 },
      ],
    });

    expect(container.querySelector('.cinder-donut-chart__total')?.textContent).toBe('5');
    expect(container.querySelector('.cinder-sr-only')?.textContent).toContain('Search: 0');
    expect(container.querySelector('.cinder-sr-only')?.textContent).toContain('Referral: 0');
    expect(container.querySelector('.cinder-sr-only')?.textContent).toContain('Email: 0');
    expect(container.querySelector('.cinder-sr-only')?.textContent).not.toMatch(/NaN|Infinity/);
    for (const path of container.querySelectorAll('path')) {
      expect(path.getAttribute('d')).not.toMatch(/NaN|Infinity/);
    }
  });

  test('keeps totals and arcs finite when finite values overflow their sum', () => {
    const { container } = render(DonutChart, {
      label: 'Traffic',
      data: [
        { id: 'direct', label: 'Direct', value: Number.MAX_VALUE },
        { id: 'search', label: 'Search', value: Number.MAX_VALUE },
      ],
    });

    expect(container.querySelector('.cinder-donut-chart__total')?.textContent).toBe(
      '3.595386269724629e+308',
    );
    for (const path of container.querySelectorAll('path')) {
      expect(path.getAttribute('d')).not.toMatch(/NaN|Infinity/);
    }
  });
});

describe('DonutChart keyboard focus identity across data updates', () => {
  function getArcs(container: HTMLElement): SVGGElement[] {
    return Array.from(container.querySelectorAll('[role="button"]'));
  }

  test('focused arc keeps its DOM element and focus across a reorder', async () => {
    const { container, rerender } = render(DonutChart, {
      label: 'Traffic',
      data: [
        { id: 'direct', label: 'Direct', value: 3 },
        { id: 'search', label: 'Search', value: 2 },
      ],
      onSeriesClick: () => {},
    });
    const searchArc = getArcs(container)[1]!;
    searchArc.focus();
    await tick();
    expect(document.activeElement).toBe(searchArc);

    // Reorder — Search now comes first. A fresh array, same ids.
    await rerender({
      label: 'Traffic',
      data: [
        { id: 'search', label: 'Search', value: 2 },
        { id: 'direct', label: 'Direct', value: 3 },
      ],
      onSeriesClick: () => {},
    });
    await tick();

    const arcsAfter = getArcs(container);
    expect(arcsAfter[0]).toBe(searchArc);
    expect(document.activeElement).toBe(searchArc);
  });

  test('Enter emits the focused datum and its current visible index exactly once after reorder', async () => {
    let clickedLabel = '';
    let clickedIndex = -1;
    let clickCount = 0;
    const { container, rerender } = render(DonutChart, {
      label: 'Traffic',
      data: [
        { id: 'direct', label: 'Direct', value: 3 },
        { id: 'search', label: 'Search', value: 2 },
      ],
      onSeriesClick: (datum: DonutChartDatum, index: number) => {
        clickedLabel = datum.label;
        clickedIndex = index;
        clickCount += 1;
      },
    });
    const searchArc = getArcs(container)[1]!;
    searchArc.focus();
    await tick();

    await rerender({
      label: 'Traffic',
      data: [
        { id: 'search', label: 'Search', value: 2 },
        { id: 'direct', label: 'Direct', value: 3 },
      ],
      onSeriesClick: (datum: DonutChartDatum, index: number) => {
        clickedLabel = datum.label;
        clickedIndex = index;
        clickCount += 1;
      },
    });
    await tick();

    // Fire on whichever element genuinely holds real DOM focus — proving the
    // *same node* moved with its datum, rather than looking a node up by its
    // new position (which would pass even if focus silently stayed behind).
    const stillFocused = document.activeElement as SVGGElement;
    expect(stillFocused).toBe(searchArc);
    await fireEvent.keyDown(stillFocused, { key: 'Enter' });

    expect(clickCount).toBe(1);
    expect(clickedLabel).toBe('Search');
    expect(clickedIndex).toBe(0);
  });

  test('a fresh cloned data array with the same ids preserves focus identity across a reorder', async () => {
    const { container, rerender } = render(DonutChart, {
      label: 'Traffic',
      data: [
        { id: 'direct', label: 'Direct', value: 3 },
        { id: 'search', label: 'Search', value: 2 },
      ],
      onSeriesClick: () => {},
    });
    const searchArc = getArcs(container)[1]!;
    searchArc.focus();
    await tick();

    // Brand-new object instances (not the same references as the original
    // props), same ids, but reordered — this is the combination the
    // acceptance criteria calls out together: identity must survive both a
    // reorder AND fresh object instances, not just one or the other.
    await rerender({
      label: 'Traffic',
      data: [
        { id: 'search', label: 'Search', value: 2 },
        { id: 'direct', label: 'Direct', value: 3 },
      ].map((datum) => ({ ...datum })),
      onSeriesClick: () => {},
    });
    await tick();

    expect(document.activeElement).toBe(searchArc);
    expect(getArcs(container)[0]).toBe(searchArc);
  });

  test('changing the label of a retained id does not transfer focus to a different datum', async () => {
    const { container, rerender } = render(DonutChart, {
      label: 'Traffic',
      data: [
        { id: 'direct', label: 'Direct', value: 3 },
        { id: 'search', label: 'Search', value: 2 },
      ],
      onSeriesClick: () => {},
    });
    const searchArc = getArcs(container)[1]!;
    searchArc.focus();
    await tick();

    await rerender({
      label: 'Traffic',
      data: [
        { id: 'direct', label: 'Direct', value: 3 },
        { id: 'search', label: 'Organic Search', value: 2 },
      ],
      onSeriesClick: () => {},
    });
    await tick();

    expect(document.activeElement).toBe(searchArc);
    expect(searchArc.getAttribute('aria-label')).toBe('Organic Search: 2');
  });

  test('a data refresh alone never activates onSeriesClick', async () => {
    let clickCount = 0;
    const { container, rerender } = render(DonutChart, {
      label: 'Traffic',
      data: [
        { id: 'direct', label: 'Direct', value: 3 },
        { id: 'search', label: 'Search', value: 2 },
      ],
      onSeriesClick: () => {
        clickCount += 1;
      },
    });
    getArcs(container)[1]!.focus();
    await tick();

    await rerender({
      label: 'Traffic',
      data: [
        { id: 'direct', label: 'Direct', value: 4 },
        { id: 'search', label: 'Search', value: 5 },
      ],
      onSeriesClick: () => {
        clickCount += 1;
      },
    });
    await tick();

    expect(clickCount).toBe(0);
  });

  test('focus moves to the next surviving interactive datum in prior order when the focused one is removed', async () => {
    const { container, rerender } = render(DonutChart, {
      label: 'Traffic',
      data: [
        { id: 'direct', label: 'Direct', value: 3 },
        { id: 'search', label: 'Search', value: 2 },
        { id: 'referral', label: 'Referral', value: 1 },
      ],
      onSeriesClick: () => {},
    });
    getArcs(container)[1]!.focus(); // Search
    await tick();

    // Search removed AND the survivors reordered so Referral does NOT land in
    // Search's old slot (index 1) — a naive "reuse whatever DOM node now sits
    // at the vacated index" implementation would keep focus on Direct here,
    // not Referral. Only genuine prior-order tracking gets this right.
    await rerender({
      label: 'Traffic',
      data: [
        { id: 'referral', label: 'Referral', value: 1 },
        { id: 'direct', label: 'Direct', value: 3 },
      ],
      onSeriesClick: () => {},
    });
    await tick();

    const referralArc = getArcs(container).find(
      (arc) => arc.getAttribute('aria-label') === 'Referral: 1',
    );
    expect(referralArc).toBeDefined();
    expect(document.activeElement).toBe(referralArc!);
  });

  test('focus moves to the previous surviving interactive datum when nothing survives after it', async () => {
    const { container, rerender } = render(DonutChart, {
      label: 'Traffic',
      data: [
        { id: 'direct', label: 'Direct', value: 3 },
        { id: 'search', label: 'Search', value: 2 },
        { id: 'referral', label: 'Referral', value: 1 },
      ],
      onSeriesClick: () => {},
    });
    getArcs(container)[2]!.focus(); // Referral (last)
    await tick();

    // Referral removed — nothing survives after it in prior order, so fall back to Search.
    await rerender({
      label: 'Traffic',
      data: [
        { id: 'direct', label: 'Direct', value: 3 },
        { id: 'search', label: 'Search', value: 2 },
      ],
      onSeriesClick: () => {},
    });
    await tick();

    const searchArc = getArcs(container).find(
      (arc) => arc.getAttribute('aria-label') === 'Search: 2',
    );
    expect(searchArc).toBeDefined();
    expect(document.activeElement).toBe(searchArc!);
  });

  test('focus moves to the noninteractive chart container when no interactive datum survives', async () => {
    const { container, rerender } = render(DonutChart, {
      label: 'Traffic',
      data: [{ id: 'direct', label: 'Direct', value: 3 }],
      onSeriesClick: () => {},
    });
    const rootElement = container.querySelector('.cinder-donut-chart') as HTMLElement;
    getArcs(container)[0]!.focus();
    await tick();

    // The only interactive datum becomes zero-area (noninteractive).
    await rerender({
      label: 'Traffic',
      data: [{ id: 'direct', label: 'Direct', value: 0 }],
      onSeriesClick: () => {},
    });
    await tick();

    expect(getArcs(container)).toHaveLength(0);
    expect(document.activeElement).toBe(rootElement);
    // Programmatically focusable, but not a tab stop.
    expect(rootElement.getAttribute('tabindex')).toBe('-1');
  });

  test('becoming noninteractive (zero area) falls back the same as removal', async () => {
    const { container, rerender } = render(DonutChart, {
      label: 'Traffic',
      data: [
        { id: 'direct', label: 'Direct', value: 3 },
        { id: 'search', label: 'Search', value: 2 },
      ],
      onSeriesClick: () => {},
    });
    getArcs(container)[1]!.focus(); // Search
    await tick();

    // Search stays in `data` but its value drops to zero — no longer interactive.
    await rerender({
      label: 'Traffic',
      data: [
        { id: 'direct', label: 'Direct', value: 3 },
        { id: 'search', label: 'Search', value: 0 },
      ],
      onSeriesClick: () => {},
    });
    await tick();

    const directArc = getArcs(container).find(
      (arc) => arc.getAttribute('aria-label') === 'Direct: 3',
    );
    expect(getArcs(container)).toHaveLength(1);
    expect(document.activeElement).toBe(directArc!);
  });
});
