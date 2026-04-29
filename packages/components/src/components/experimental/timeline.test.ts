/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Wrapper } = await import('../../test/fixtures/timeline-fixture.svelte');

const items = [
  { id: '1', title: 'Created', time: '10:00', status: 'info' as const, body: 'Workflow started' },
  { id: '2', title: 'Step', time: '10:05', status: 'success' as const, body: 'Step ran' },
];

describe('Timeline (experimental)', () => {
  test('renders an ordered list with one item per entry', () => {
    const { container } = render(Wrapper, { items });
    expect(container.querySelector('ol.cinder-timeline')).not.toBeNull();
    const lis = container.querySelectorAll('li.cinder-timeline-item');
    expect(lis.length).toBe(2);
  });

  test('items carry the status data attribute', () => {
    const { container } = render(Wrapper, { items });
    const lis = Array.from(container.querySelectorAll('li.cinder-timeline-item'));
    expect(lis[0]?.getAttribute('data-cinder-status')).toBe('info');
    expect(lis[1]?.getAttribute('data-cinder-status')).toBe('success');
  });

  test('items render time and title in the header', () => {
    const { container } = render(Wrapper, { items });
    const titles = Array.from(container.querySelectorAll('.cinder-timeline-item__title'));
    expect(titles.map((t) => t.textContent?.trim())).toEqual(['Created', 'Step']);
    const times = Array.from(container.querySelectorAll('.cinder-timeline-item__time'));
    expect(times.map((t) => t.textContent?.trim())).toEqual(['10:00', '10:05']);
  });
});
