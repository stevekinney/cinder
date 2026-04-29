/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Stat } = await import('./stat.svelte');

describe('Stat (experimental)', () => {
  test('renders the label and value', () => {
    const { container } = render(Stat, { label: 'Active runs', value: 42 });
    expect(container.querySelector('.cinder-stat__label')?.textContent?.trim()).toBe('Active runs');
    expect(container.querySelector('.cinder-stat__value')?.textContent?.trim()).toBe('42');
  });

  test('omits the delta element when no delta is provided', () => {
    const { container } = render(Stat, { label: 'X', value: 1 });
    expect(container.querySelector('.cinder-stat__delta')).toBeNull();
  });

  test('renders the delta with the trend data attribute', () => {
    const { container } = render(Stat, {
      label: 'Conversion',
      value: '3.4%',
      delta: '+0.8%',
      trend: 'up',
    });
    const delta = container.querySelector('.cinder-stat__delta');
    expect(delta?.textContent?.trim()).toBe('+0.8%');
    expect(delta?.getAttribute('data-cinder-trend')).toBe('up');
  });
});
