/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Sparkbar } = await import('./sparkbar.svelte');

describe('Sparkbar', () => {
  test('renders a labeled meter with fractional values by default', () => {
    const { container } = render(Sparkbar, {
      value: 0.31,
      label: 'Draft weekly changelog',
      trailing: '$0.31',
    });

    const el = container.querySelector('[role="meter"]');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('aria-label')).toBe('Draft weekly changelog, 31%');
    expect(el?.getAttribute('aria-valuemin')).toBe('0');
    expect(el?.getAttribute('aria-valuemax')).toBe('1');
    expect(el?.getAttribute('aria-valuenow')).toBe('0.31');
    expect(el?.getAttribute('aria-valuetext')).toBe('31%');
    expect(el?.textContent).toContain('Draft weekly changelog');
    expect(el?.textContent).toContain('$0.31');
  });

  test('clamps values to the configured range', () => {
    const { container } = render(Sparkbar, {
      value: 12,
      max: 10,
      label: 'Token budget',
    });

    const el = container.querySelector('[role="meter"]');
    expect(el?.getAttribute('aria-valuemax')).toBe('10');
    expect(el?.getAttribute('aria-valuenow')).toBe('10');
    expect(el?.getAttribute('aria-valuetext')).toBe('100%');
  });

  test('forwards size, variant, class, and accessible name override', () => {
    const { container } = render(Sparkbar, {
      value: 2,
      max: 8,
      label: 'Cost',
      size: 'lg',
      variant: 'warning',
      ariaLabel: 'Session cost usage',
      class: 'custom-sparkbar',
    });

    const el = container.querySelector('[role="meter"]');
    expect(el?.classList.contains('custom-sparkbar')).toBe(true);
    expect(el?.getAttribute('data-cinder-size')).toBe('lg');
    expect(el?.getAttribute('data-cinder-variant')).toBe('warning');
    expect(el?.getAttribute('aria-label')).toBe('Session cost usage');
  });
});
