import { requiredInstance } from '@lostgradient/testing';
import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, test } from 'bun:test';
import { tick } from 'svelte';
import {
  blur,
  cleanupNumberInput,
  focus,
  getIncrement,
  getInput,
  type,
} from './number-input-test-helpers.ts';
import NumberInput from './number-input.svelte';
afterEach(cleanupNumberInput);

describe('Clamping and snapping', () => {
  test('blur clamps to max', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        max: 10,
        locale: 'en-US',
        onValueChange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '999');
    await blur(input);
    expect(calls).toEqual([10]);
  });

  test('blur clamps to min', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        min: 0,
        locale: 'en-US',
        onValueChange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '-999');
    await blur(input);
    expect(calls).toEqual([0]);
  });

  test('blur snaps to step only when step provided', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        step: 0.5,
        locale: 'en-US',
        onValueChange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '1.3');
    await blur(input);
    expect(calls).toEqual([1.5]);
  });

  test('default-step does NOT snap', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'en-US', onValueChange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '1234.5');
    await blur(input);
    expect(calls).toEqual([1234.5]);
  });

  test('snap-then-clamp ordering: clamp wins', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        min: 0,
        max: 1,
        step: 0.6,
        locale: 'en-US',
        onValueChange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '0.9');
    await blur(input);
    expect(calls).toEqual([1]);
  });

  test('snap origin respects min', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        min: 0.1,
        step: 0.2,
        locale: 'en-US',
        onValueChange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '0.4');
    await blur(input);
    expect(calls).toEqual([0.5]);
  });

  test('roundToPrecision removes float artifacts', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        step: 0.1,
        locale: 'en-US',
        onValueChange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '0.3');
    await blur(input);
    expect(calls[0]).toBe(0.3);
    expect(Object.is(calls[0], 0.3)).toBe(true);
  });

  test('invalid step (0, -5, NaN, Infinity) falls back to increment=1', async () => {
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const calls: Array<number | null> = [];
      const { container, unmount } = render(NumberInput, {
        props: {
          id: 'n',
          value: 1,
          step: bad,
          locale: 'en-US',
          onValueChange: (v: number | null) => calls.push(v),
        },
      });
      getIncrement(container).click();
      expect(calls).toEqual([2]);
      unmount();
    }
  });

  test('exponential step precision', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        step: 1e-7,
        locale: 'en-US',
        onValueChange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '0.0000003');
    await blur(input);
    expect(calls[0]).toBeCloseTo(0.0000003, 10);
  });
});

describe('reset source does not snap value to step precision', () => {
  test('form reset restores value verbatim even when step would round it', async () => {
    // Regression: commitFromNumber with 'reset' source fell through to the
    // else-if(snapStep !== null) branch, silently rounding value.
    // e.g. value=0.15, step=0.1 → reset produced 0.2 instead of 0.15.
    const form = document.createElement('form');
    document.body.appendChild(form);
    const mount = document.createElement('div');
    form.appendChild(mount);
    render(NumberInput, {
      target: mount,
      props: { id: 'n', name: 'q', value: 0.15, step: 0.1, locale: 'en-US' },
    });
    const input = requiredInstance(mount.querySelector('#n'), HTMLInputElement);
    // Change value away from default.
    await focus(input);
    await type(input, '0.5');
    await blur(input);
    await tick();
    // Reset the form — value should return to 0.15 verbatim, not 0.2.
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await tick();
    expect(input.value).toBe('0.15');
  });
});

describe('delta rounding preserves base-value precision', () => {
  test('ArrowUp with integer step does not clip fractional base value', async () => {
    // Regression: delta branch rounded to step precision, so value=0.5 + step=1
    // produced 2 (rounded to 0 decimal places) instead of 1.5.
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        value: 0.5,
        step: 1,
        locale: 'en-US',
        onValueChange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(calls[0]).toBe(1.5);
  });

  test('ArrowUp with decimal step preserves extra base precision', async () => {
    // Regression: value=0.05, step=0.1 → delta rounding to 1 decimal produced
    // 0.1 instead of the correct 0.15.
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        value: 0.05,
        step: 0.1,
        locale: 'en-US',
        onValueChange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(calls[0]).toBe(0.15);
  });

  test('repeated ArrowUp with decimal step still eliminates float noise', async () => {
    // Ensure the fix still prevents 0.1+0.1+...×10 = 1.0000000000000009.
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        value: 0,
        step: 0.1,
        locale: 'en-US',
        onValueChange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    for (let i = 0; i < 10; i++) {
      await fireEvent.keyDown(input, { key: 'ArrowUp' });
    }
    expect(calls[calls.length - 1]).toBe(1);
  });
});
