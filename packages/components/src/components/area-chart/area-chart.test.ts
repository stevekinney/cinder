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
const { default: AreaChart } = await import('./area-chart.svelte');

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
});
