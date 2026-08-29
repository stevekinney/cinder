/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { setupHappyDom } from '../../test/happy-dom.ts';
import type { DonutChartDatum } from './donut-chart.types.ts';
setupHappyDom();
const { fireEvent, render } = await import('@testing-library/svelte');
const { default: DonutChart } = await import('./donut-chart.svelte');
describe('DonutChart', () => {
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
  });
});
