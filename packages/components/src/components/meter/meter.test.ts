/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Meter } = await import('./meter.svelte');

describe('Meter', () => {
  test('renders role=meter with default bounds and value', () => {
    const { container } = render(Meter, { ariaLabel: 'Battery level' });
    const el = container.querySelector('[role="meter"]');

    expect(el).not.toBeNull();
    expect(el?.getAttribute('aria-valuemin')).toBe('0');
    expect(el?.getAttribute('aria-valuemax')).toBe('100');
    expect(el?.getAttribute('aria-valuenow')).toBe('0');
    expect(el?.getAttribute('aria-valuetext')).toBe('0%');
  });

  test('clamps values outside [min,max]', () => {
    const { container: low } = render(Meter, { value: -10, ariaLabel: 'Battery level' });
    expect(low.querySelector('[role="meter"]')?.getAttribute('aria-valuenow')).toBe('0');

    const { container: high } = render(Meter, { value: 200, ariaLabel: 'Battery level' });
    expect(high.querySelector('[role="meter"]')?.getAttribute('aria-valuenow')).toBe('100');
  });

  test('supports custom min/max', () => {
    const { container } = render(Meter, {
      value: 40,
      min: 20,
      max: 60,
      ariaLabel: 'Quota usage',
    });
    const el = container.querySelector('[role="meter"]');

    expect(el?.getAttribute('aria-valuemin')).toBe('20');
    expect(el?.getAttribute('aria-valuemax')).toBe('60');
    expect(el?.getAttribute('aria-valuenow')).toBe('40');
    expect(el?.getAttribute('aria-valuetext')).toBe('50%');
  });

  test('forwards accessible-name attributes', () => {
    const { container } = render(Meter, {
      value: 55,
      ariaLabelledby: 'meter-label',
    });
    const el = container.querySelector('[role="meter"]');

    expect(el?.getAttribute('aria-labelledby')).toBe('meter-label');
    expect(el?.getAttribute('aria-label')).toBeNull();
  });

  test('supports ariaValueText override', () => {
    const { container } = render(Meter, {
      value: 50,
      ariaLabel: 'Battery level',
      ariaValueText: '50% (6 hours remaining)',
    });
    const el = container.querySelector('[role="meter"]');

    expect(el?.getAttribute('aria-valuetext')).toBe('50% (6 hours remaining)');
  });

  test('exposes data value range attributes for styling', () => {
    const { container } = render(Meter, {
      value: 25,
      min: 0,
      max: 50,
      ariaLabel: 'Memory pressure',
    });
    const el = container.querySelector('[role="meter"]');

    expect(el?.getAttribute('data-value')).toBe('25');
    expect(el?.getAttribute('data-min')).toBe('0');
    expect(el?.getAttribute('data-max')).toBe('50');
  });

  test('renders low/optimum/high segments', () => {
    const { container } = render(Meter, {
      value: 40,
      min: 0,
      max: 100,
      low: 30,
      high: 70,
      ariaLabel: 'Quota usage',
    });
    const segments = container.querySelectorAll('.cinder-meter__segment');

    expect(segments).toHaveLength(3);
  });

  test('computes optimum state by default for middle values', () => {
    const { container } = render(Meter, {
      value: 50,
      low: 25,
      high: 75,
      ariaLabel: 'Battery level',
    });
    const el = container.querySelector('[role="meter"]');

    expect(el?.getAttribute('data-cinder-state')).toBe('optimum');
  });

  test('computes high state when value is above the high boundary', () => {
    const { container } = render(Meter, {
      value: 90,
      low: 30,
      high: 70,
      ariaLabel: 'CPU usage',
    });
    const el = container.querySelector('[role="meter"]');

    expect(el?.getAttribute('data-cinder-state')).toBe('high');
  });
});
