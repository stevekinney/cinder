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
    expect(el?.getAttribute('aria-valuetext')).toBeNull();
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
    expect(el?.getAttribute('aria-valuetext')).toBeNull();
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

  test('omits empty-string aria name attributes', () => {
    const { container } = render(Meter, {
      value: 30,
      ariaLabel: '',
      ariaLabelledby: '',
    });
    const el = container.querySelector('[role="meter"]');

    expect(el?.getAttribute('aria-label')).toBeNull();
    expect(el?.getAttribute('aria-labelledby')).toBeNull();
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
    const lowBand = container.querySelector('.cinder-meter__segment--band-low');
    const optimumBand = container.querySelector('.cinder-meter__segment--band-optimum');
    const highBand = container.querySelector('.cinder-meter__segment--band-high');

    expect(segments).toHaveLength(3);
    expect(lowBand?.getAttribute('style')).toContain('inline-size: 30%');
    expect(optimumBand?.getAttribute('style')).toContain('inline-size: 40%');
    expect(highBand?.getAttribute('style')).toContain('inline-size: 30%');
  });

  test('does not render threshold segments when thresholds are omitted', () => {
    const { container } = render(Meter, {
      value: 40,
      min: 0,
      max: 100,
      ariaLabel: 'Quota usage',
    });
    const el = container.querySelector('[role="meter"]');
    const segments = container.querySelectorAll('.cinder-meter__segment');

    expect(segments).toHaveLength(0);
    expect(el?.getAttribute('data-cinder-state')).toBeNull();
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

  test('keeps omitted high threshold at range edge', () => {
    const { container } = render(Meter, {
      value: 90,
      low: 20,
      ariaLabel: 'Battery level',
    });
    const el = container.querySelector('[role="meter"]');

    expect(el?.getAttribute('data-cinder-state')).toBe('optimum');
  });

  test('keeps middle band distinct when optimum is below low', () => {
    const { container } = render(Meter, {
      value: 150,
      min: 0,
      max: 500,
      low: 100,
      high: 300,
      optimum: 0,
      ariaLabel: 'Latency',
    });
    const el = container.querySelector('[role="meter"]');

    expect(el?.getAttribute('data-cinder-state')).toBe('low');
  });

  test('maps segment tones from high-is-better optimum', () => {
    const { container } = render(Meter, {
      value: 82,
      low: 20,
      high: 80,
      optimum: 100,
      ariaLabel: 'Battery level',
    });

    expect(
      container
        .querySelector('.cinder-meter__segment--band-high')
        ?.classList.contains('cinder-meter__segment--state-optimum'),
    ).toBe(true);
    expect(
      container
        .querySelector('.cinder-meter__segment--band-low')
        ?.classList.contains('cinder-meter__segment--state-low'),
    ).toBe(true);
    expect(
      container
        .querySelector('.cinder-meter__segment--band-optimum')
        ?.classList.contains('cinder-meter__segment--state-high'),
    ).toBe(true);
  });
});
