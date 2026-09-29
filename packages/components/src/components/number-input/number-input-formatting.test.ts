import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, test } from 'bun:test';
import { blur, cleanupNumberInput, focus, getInput, type } from './number-input-test-helpers.ts';
import NumberInput from './number-input.svelte';
afterEach(cleanupNumberInput);

describe('Locale formatting', () => {
  test('en-US: 1234.5 → "1,234.5"', () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', value: 1234.5, locale: 'en-US' },
    });
    expect(getInput(container).value).toBe('1,234.5');
  });

  test('de-DE: 1234.5 → "1.234,5"', () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', value: 1234.5, locale: 'de-DE' },
    });
    expect(getInput(container).value).toBe('1.234,5');
  });

  test('de-DE round-trip: paste "1.234,5" parses to 1234.5', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'de-DE', onValueChange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '1.234,5');
    await blur(input);
    expect(calls).toEqual([1234.5]);
  });

  test('Strict grouping rejection (en-US): "1,2,3.4" → null', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'en-US', onValueChange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '1,2,3.4');
    await blur(input);
    expect(calls).toEqual([null]);
  });

  test('Malformed inputs commit null', async () => {
    for (const bad of ['12abc', '1.2.3', '$--5']) {
      const calls: Array<number | null> = [];
      const { container, unmount } = render(NumberInput, {
        props: { id: 'n', locale: 'en-US', onValueChange: (v: number | null) => calls.push(v) },
      });
      const input = getInput(container);
      await focus(input);
      await type(input, bad);
      await blur(input);
      expect(calls).toEqual([null]);
      unmount();
    }
  });

  test('Grouped + accepted: "+1,234" (en-US) → 1234', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'en-US', onValueChange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '+1,234');
    await blur(input);
    expect(calls).toEqual([1234]);
  });
});

describe('Currency and percent formats', () => {
  test('currency: USD format', async () => {
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        value: 12.5,
        locale: 'en-US',
        format: { style: 'currency', currency: 'USD' },
      },
    });
    const input = getInput(container);
    expect(input.value).toBe('$12.50');
    await focus(input);
    expect(input.value).toBe('12.5');
  });

  test('percent: round-trip', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        value: 0.5,
        locale: 'en-US',
        format: { style: 'percent' },
        onValueChange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    expect(input.value).toBe('50%');
    await focus(input);
    expect(input.value).toBe('50');
    await type(input, '75');
    await blur(input);
    expect(calls).toEqual([0.75]);
    expect(input.value).toBe('75%');
  });

  test('percent: focus avoids precision artifacts', async () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', value: 0.29, locale: 'en-US', format: { style: 'percent' } },
    });
    const input = getInput(container);
    await focus(input);
    expect(input.value).toBe('29');
  });

  test('percent step is canonical', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        value: 0.5,
        step: 0.01,
        locale: 'en-US',
        format: { style: 'percent' },
        onValueChange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await focus(input);
    await fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(calls[0]).toBeCloseTo(0.51, 10);
  });
});

describe('Locale parser coverage in component', () => {
  test('fr-FR narrow-NBSP grouping round-trip', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'fr-FR', onValueChange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    // Use the locale's own formatted output so we get the actual narrow NBSP.
    const formatted = new Intl.NumberFormat('fr-FR').format(1234.5);
    await type(input, formatted);
    await blur(input);
    expect(calls).toEqual([1234.5]);
  });

  test('ar-EG localized digits round-trip', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'ar-EG', onValueChange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    const formatted = new Intl.NumberFormat('ar-EG').format(1234);
    await type(input, formatted);
    await blur(input);
    expect(calls).toEqual([1234]);
  });

  test('hi-IN secondary grouping accepted', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'hi-IN', onValueChange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '12,34,567');
    await blur(input);
    expect(calls).toEqual([1234567]);
  });

  test('compact notation format: edit buffer shows plain number, not "1.2K"', async () => {
    // Regression: buildEditDisplay did not clear `notation`, so format={notation:'compact'}
    // rendered "1.2K" in the edit buffer. The parser's affix probes use 0 and -1 (too small
    // for "K"/"M" suffixes), so "1.2K" was never stripped and was rejected as malformed on blur.
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        locale: 'en-US',
        value: 1200,
        format: { notation: 'compact' },
        onValueChange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await focus(input);
    // Edit buffer must show the plain numeric form, not the compact abbreviation.
    expect(input.value).toBe('1200');
    await blur(input);
    // Blur commit of the unmodified edit buffer should not produce a malformed error.
    expect(calls).toEqual([1200]);
  });
});
