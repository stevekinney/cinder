/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Meter } = await import('./meter.svelte');

describe('Meter', () => {
  test('renders an unknown verdict as a named status without fabricating numeric value attributes', () => {
    const { container } = render(Meter, {
      verdict: { level: 'unknown', label: 'Awaiting data' },
      ariaLabel: 'Service health',
    });
    const el = container.querySelector('[role="status"]');

    expect(el).not.toBeNull();
    expect(el?.querySelector('.cinder-meter__track')).not.toBeNull();
    expect(el?.querySelector('.cinder-meter__fill')).toBeNull();
    expect(el?.getAttribute('aria-valuemin')).toBeNull();
    expect(el?.getAttribute('aria-valuemax')).toBeNull();
    expect(el?.getAttribute('aria-valuenow')).toBeNull();
    expect(el?.getAttribute('data-value')).toBeNull();
    expect(el?.getAttribute('data-min')).toBeNull();
    expect(el?.getAttribute('data-max')).toBeNull();
    expect(el?.querySelector('.cinder-meter__label')?.textContent).toBe('Awaiting data');
    expect(el?.getAttribute('aria-valuetext')).toBeNull();
    expect(el?.getAttribute('aria-label')).toBe('Service health: Awaiting data');
  });

  test('uses the verdict label as both the visible label and aria-valuetext', () => {
    const { container } = render(Meter, {
      verdict: { level: 'low', label: 'Degraded' },
      ariaLabel: 'Service health',
    });
    const el = container.querySelector('[role="meter"]');

    expect(el?.querySelector('.cinder-meter__label')?.textContent).toBe('Degraded');
    expect(el?.getAttribute('aria-valuetext')).toBe('Degraded');
    expect(el?.getAttribute('data-cinder-state')).toBe('low');
    expect(el?.getAttribute('aria-valuenow')).toBe('0');
  });

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
        ?.classList.contains('cinder-meter__segment--state-high'),
    ).toBe(true);
    expect(
      container
        .querySelector('.cinder-meter__segment--band-optimum')
        ?.classList.contains('cinder-meter__segment--state-low'),
    ).toBe(true);
  });

  test('maps segment tones from low-is-better optimum', () => {
    const { container } = render(Meter, {
      value: 82,
      low: 20,
      high: 80,
      optimum: 0,
      ariaLabel: 'Latency',
    });

    expect(
      container
        .querySelector('.cinder-meter__segment--band-low')
        ?.classList.contains('cinder-meter__segment--state-optimum'),
    ).toBe(true);
    expect(
      container
        .querySelector('.cinder-meter__segment--band-optimum')
        ?.classList.contains('cinder-meter__segment--state-low'),
    ).toBe(true);
    expect(
      container
        .querySelector('.cinder-meter__segment--band-high')
        ?.classList.contains('cinder-meter__segment--state-high'),
    ).toBe(true);
  });

  test('treats optimum at high threshold as high-is-better', () => {
    const { container } = render(Meter, {
      value: 100,
      low: 20,
      high: 80,
      optimum: 80,
      ariaLabel: 'Battery level',
    });
    const el = container.querySelector('[role="meter"]');

    expect(el?.getAttribute('data-cinder-state')).toBe('optimum');
  });

  test('treats value at high boundary as optimum in high-is-better mode', () => {
    const { container } = render(Meter, {
      value: 80,
      low: 20,
      high: 80,
      optimum: 80,
      ariaLabel: 'Battery level',
    });
    const el = container.querySelector('[role="meter"]');

    expect(el?.getAttribute('data-cinder-state')).toBe('optimum');
  });

  test('reaches optimum at max edge for high-is-better when high is omitted', () => {
    const { container } = render(Meter, {
      value: 100,
      low: 30,
      optimum: 100,
      ariaLabel: 'Battery level',
    });
    const el = container.querySelector('[role="meter"]');

    expect(el?.getAttribute('data-cinder-state')).toBe('optimum');
  });

  test('reaches high at max edge for low-is-better when high is omitted', () => {
    const { container } = render(Meter, {
      value: 100,
      low: 30,
      optimum: 0,
      ariaLabel: 'Latency',
    });
    const el = container.querySelector('[role="meter"]');

    expect(el?.getAttribute('data-cinder-state')).toBe('high');
  });

  test('warns and falls back to 0..100 when min/max is an invalid range', () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    };

    try {
      render(Meter, { min: 10, max: 5, ariaLabel: 'Battery level' });
      expect(
        warnings.some((warning) => warning.includes('received an invalid range (min=10, max=5)')),
      ).toBe(true);
    } finally {
      console.warn = originalWarn;
    }
  });

  test('warns and falls back to min when value is non-finite', () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    };

    try {
      render(Meter, { value: NaN, ariaLabel: 'Battery level' });
      expect(
        warnings.some((warning) => warning.includes('received a non-finite value (NaN)')),
      ).toBe(true);
    } finally {
      console.warn = originalWarn;
    }
  });

  test('warns when value is clamped outside the [min,max] range', () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    };

    try {
      render(Meter, { value: 200, min: 0, max: 100, ariaLabel: 'Battery level' });
      expect(
        warnings.some((warning) =>
          warning.includes('value 200 is outside the [min,max] range (0..100)'),
        ),
      ).toBe(true);
    } finally {
      console.warn = originalWarn;
    }
  });

  test('warns when low threshold is non-finite', () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    };

    try {
      render(Meter, { low: NaN, ariaLabel: 'Battery level' });
      expect(
        warnings.some((warning) =>
          warning.includes('low threshold must be finite when provided. Received NaN'),
        ),
      ).toBe(true);
    } finally {
      console.warn = originalWarn;
    }
  });

  test('warns when high threshold is non-finite', () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    };

    try {
      render(Meter, { high: NaN, ariaLabel: 'Battery level' });
      expect(
        warnings.some((warning) =>
          warning.includes('high threshold must be finite when provided. Received NaN'),
        ),
      ).toBe(true);
    } finally {
      console.warn = originalWarn;
    }
  });

  test('warns when optimum threshold is non-finite', () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    };

    try {
      render(Meter, { optimum: NaN, ariaLabel: 'Battery level' });
      expect(
        warnings.some((warning) =>
          warning.includes('optimum threshold must be finite when provided. Received NaN'),
        ),
      ).toBe(true);
    } finally {
      console.warn = originalWarn;
    }
  });

  test('warns when rendered without an accessible name', () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    };

    try {
      render(Meter, { value: 50 });
      expect(
        warnings.some((warning) =>
          warning.includes(
            '[cinder/Meter] rendered without an accessible name — pass `ariaLabel` or `ariaLabelledby`.',
          ),
        ),
      ).toBe(true);
    } finally {
      console.warn = originalWarn;
    }
  });

  test('forwards native attributes to the root element', () => {
    const { container } = render(Meter, { ariaLabel: 'Battery level', 'data-testid': 'probe' });
    expect(container.querySelector('[role="meter"]')?.getAttribute('data-testid')).toBe('probe');
  });

  test('the component-owned role always wins over a forwarded role', () => {
    const { container } = render(Meter, {
      ariaLabel: 'Battery level',
      role: 'forwarded-role',
    });
    expect(container.querySelector('[data-cinder-size]')?.getAttribute('role')).toBe('meter');
  });

  test('a rest-forwarded native aria-label survives and is not clobbered by the bespoke prop default', () => {
    const { container } = render(Meter, {
      value: 40,
      // Passed as a native rest attribute, NOT via the bespoke `ariaLabel` prop.
      'aria-label': 'Storage used',
    });
    const el = container.querySelector('[role="meter"]');

    expect(el?.getAttribute('aria-label')).toBe('Storage used');
  });

  test('a rest-forwarded native aria-labelledby survives and is not clobbered by the bespoke prop default', () => {
    const { container } = render(Meter, {
      value: 40,
      'aria-labelledby': 'meter-heading',
    });
    const el = container.querySelector('[role="meter"]');

    expect(el?.getAttribute('aria-labelledby')).toBe('meter-heading');
  });

  test('a rest-forwarded native aria-label wins over the bespoke ariaLabel prop', () => {
    const { container } = render(Meter, {
      value: 40,
      ariaLabel: 'Bespoke label',
      'aria-label': 'Native label',
    });
    const el = container.querySelector('[role="meter"]');

    expect(el?.getAttribute('aria-label')).toBe('Native label');
  });

  test('falls back to the bespoke ariaLabel prop when no native aria-label is forwarded', () => {
    const { container } = render(Meter, {
      value: 40,
      ariaLabel: 'Bespoke label',
    });
    const el = container.querySelector('[role="meter"]');

    expect(el?.getAttribute('aria-label')).toBe('Bespoke label');
  });

  test('does not warn about a missing accessible name when it arrives via a forwarded native aria-label', () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    };

    try {
      render(Meter, { value: 40, 'aria-label': 'Storage used' });
      expect(
        warnings.some((warning) => warning.includes('rendered without an accessible name')),
      ).toBe(false);
    } finally {
      console.warn = originalWarn;
    }
  });
});
