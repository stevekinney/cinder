/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Progress } = await import('./progress.svelte');

describe('Progress (bar)', () => {
  test('renders role=progressbar with min/max/now for determinate', () => {
    const { container } = render(Progress, { value: 30 });
    const el = container.querySelector('[role="progressbar"]');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('aria-valuemin')).toBe('0');
    expect(el?.getAttribute('aria-valuemax')).toBe('100');
    expect(el?.getAttribute('aria-valuenow')).toBe('30');
  });

  test('aria-valuetext defaults to "{percent}%" for determinate', () => {
    const { container } = render(Progress, { value: 42 });
    const el = container.querySelector('[role="progressbar"]');
    expect(el?.getAttribute('aria-valuetext')).toBe('42%');
  });

  test('label prop overrides aria-valuetext', () => {
    const { container } = render(Progress, { value: 50, label: 'Half-way there' });
    const el = container.querySelector('[role="progressbar"]');
    expect(el?.getAttribute('aria-valuetext')).toBe('Half-way there');
  });

  test('value clamps to [0, max]', () => {
    const { container: lo } = render(Progress, { value: -10 });
    expect(lo.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('0');
    const { container: hi } = render(Progress, { value: 200 });
    expect(hi.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('100');
  });

  test('omitting value renders indeterminate (no aria-valuenow, data-cinder-indeterminate)', () => {
    const { container } = render(Progress, {});
    const el = container.querySelector('[role="progressbar"]');
    expect(el?.getAttribute('aria-valuenow')).toBeNull();
    expect(el?.hasAttribute('data-cinder-indeterminate')).toBe(true);
  });

  test('indeterminate aria-valuetext defaults to "Loading"', () => {
    const { container } = render(Progress, {});
    const el = container.querySelector('[role="progressbar"]');
    expect(el?.getAttribute('aria-valuetext')).toBe('Loading');
  });

  test('custom max scales the percent calculation', () => {
    const { container } = render(Progress, { value: 50, max: 200 });
    const el = container.querySelector('[role="progressbar"]');
    expect(el?.getAttribute('aria-valuemax')).toBe('200');
    expect(el?.getAttribute('aria-valuenow')).toBe('50');
    expect(el?.getAttribute('aria-valuetext')).toBe('25%');
  });
});

describe('Progress (ring)', () => {
  test('variant=ring renders an svg with the progressbar role on the wrapper', () => {
    const { container } = render(Progress, { value: 60, variant: 'ring' });
    expect(container.querySelector('[role="progressbar"]')).not.toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  test('ring variant carries the same data-cinder-size attribute', () => {
    const { container } = render(Progress, { value: 60, variant: 'ring', size: 'lg' });
    const el = container.querySelector('[role="progressbar"]');
    expect(el?.getAttribute('data-cinder-size')).toBe('lg');
  });
});
