/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { setupHappyDom } from '../../test/happy-dom.ts';
import type { DonutChartDatum } from './donut-chart.types.ts';
setupHappyDom();
const { fireEvent, render } = await import('@testing-library/svelte');
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
        { label: 'Direct', value: 3 },
        { label: 'Search', value: 2 },
      ],
    });
    expect(container.querySelectorAll('path')).toHaveLength(2);
    expect(container.textContent).toContain('5');
  });
  test('renders a complete arc for a full-circle series', () => {
    const { container } = render(DonutChart, {
      label: 'Traffic',
      data: [{ label: 'Direct', value: 5 }],
    });
    const path = container.querySelector('path');
    expect(path?.getAttribute('d')).toContain('A 88 88 0 1 1');
    expect(path?.getAttribute('d')).not.toContain('NaN');
  });
  test('supports labels and click', () => {
    let clicked = -1;
    const { container } = render(DonutChart, {
      label: 'Traffic',
      data: [{ label: 'Direct', value: 3 }],
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
        { label: 'Direct', value: 3, color: '#ef4444' },
        { label: 'Search', value: 2, color: '#3b82f6' },
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
      data: [{ label: 'Direct', value: 3 }],
      onSeriesClick: (_datum: DonutChartDatum, index: number) => (clicked = index),
    });
    const series = container.querySelector('[role="button"]') as SVGGElement;
    await fireEvent.keyDown(series, { key: 'Enter' });
    expect(clicked).toBe(0);
    expect(container.querySelector('svg')?.getAttribute('role')).toBeNull();
  });

  test('does not expose zero-area series as interactive controls', async () => {
    const clicked: number[] = [];
    const { container } = render(DonutChart, {
      label: 'Traffic',
      data: [
        { label: 'Empty', value: 0 },
        { label: 'Direct', value: 3 },
        { label: 'Invalid', value: -1 },
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
      data: [{ label: 'Direct', value: 3 }],
    });
    expect(container.querySelector('.cinder-sr-only')?.textContent).toContain('Direct: 3');
  });

  test('normalizes negative values consistently across the chart and summaries', () => {
    const { container } = render(DonutChart, {
      label: 'Traffic',
      data: [
        { label: 'Direct', value: -3 },
        { label: 'Search', value: 2 },
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
        { label: 'Direct', value: 3 },
        { label: 'Search', value: Number.NaN },
        { label: 'Referral', value: Number.POSITIVE_INFINITY },
        { label: 'Email', value: Number.NEGATIVE_INFINITY },
        { label: 'Social', value: 2 },
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
});
