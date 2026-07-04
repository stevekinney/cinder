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
    expect(el?.getAttribute('aria-valuetext')).toBe('$0.31');
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
    expect(el?.getAttribute('aria-valuetext')).toBeNull();
  });

  test('omits value text for blank trailing values', () => {
    const { container } = render(Sparkbar, {
      value: 4,
      max: 8,
      label: 'Token budget',
      trailing: '   ',
    });

    const el = container.querySelector('[role="meter"]');
    expect(el?.getAttribute('aria-valuetext')).toBeNull();
    expect(container.querySelector('.cinder-sparkbar__trailing')).toBeNull();
  });

  test('uses explicit accessible value text ahead of trailing text', () => {
    const { container } = render(Sparkbar, {
      value: 4,
      max: 8,
      label: 'Token budget',
      trailing: '4k / 8k',
      ariaValueText: '4,000 of 8,000 tokens',
    });

    const el = container.querySelector('[role="meter"]');
    expect(el?.getAttribute('aria-valuetext')).toBe('4,000 of 8,000 tokens');
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

  test('keeps computed meter semantics authoritative', () => {
    const { container } = render(Sparkbar, {
      value: 3,
      max: 10,
      label: 'Usage',
      ariaLabel: '   ',
      role: 'presentation',
      'aria-valuenow': 99,
      'aria-valuemax': 99,
    });

    const el = container.querySelector('[role="meter"]');
    expect(el?.getAttribute('aria-label')).toBe('Usage, 30%');
    expect(el?.getAttribute('aria-valuenow')).toBe('3');
    expect(el?.getAttribute('aria-valuemax')).toBe('10');
  });
});
