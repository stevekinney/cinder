import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, test } from 'bun:test';
import { tick } from 'svelte';
import {
  blur,
  cleanupNumberInput,
  focus,
  getDecrement,
  getIncrement,
  getInput,
  type,
} from './number-input-test-helpers.ts';
import NumberInput from './number-input.svelte';
afterEach(cleanupNumberInput);

describe('Stepper buttons and keyboard', () => {
  test('Increment button fires onValueChange(value+step)', () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        value: 1,
        step: 2,
        locale: 'en-US',
        onValueChange: (v: number | null) => calls.push(v),
      },
    });
    getIncrement(container).click();
    expect(calls).toEqual([3]);
  });

  test('Increment disabled at max', () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', value: 10, max: 10, locale: 'en-US' },
    });
    expect(getIncrement(container).disabled).toBe(true);
  });

  test('Decrement fires onValueChange(value-step), disabled at min', () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        value: 5,
        locale: 'en-US',
        onValueChange: (v: number | null) => calls.push(v),
      },
    });
    getDecrement(container).click();
    expect(calls).toEqual([4]);

    const { container: c2 } = render(NumberInput, {
      props: { id: 'm', value: 0, min: 0, locale: 'en-US' },
    });
    expect(getDecrement(c2).disabled).toBe(true);
  });

  test('ArrowUp / ArrowDown match increment / decrement', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        value: 5,
        locale: 'en-US',
        onValueChange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await fireEvent.keyDown(input, { key: 'ArrowUp' });
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(calls).toEqual([6, 5]);
  });

  test('PageUp / PageDown = ±10×step', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        value: 0,
        step: 2,
        locale: 'en-US',
        onValueChange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await fireEvent.keyDown(input, { key: 'PageUp' });
    await fireEvent.keyDown(input, { key: 'PageDown' });
    expect(calls).toEqual([20, 0]);
  });

  test('Home → min when finite; End → max when finite', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        value: 5,
        min: 1,
        max: 9,
        locale: 'en-US',
        onValueChange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await fireEvent.keyDown(input, { key: 'Home' });
    await fireEvent.keyDown(input, { key: 'End' });
    expect(calls).toEqual([1, 9]);
  });

  test('Home / End no-op when bound is infinite', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        value: 5,
        locale: 'en-US',
        onValueChange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await fireEvent.keyDown(input, { key: 'Home' });
    await fireEvent.keyDown(input, { key: 'End' });
    expect(calls).toEqual([]);
  });

  test('Home/End sync editor buffer while focused — no stale-buffer revert on blur', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        value: 5,
        min: 1,
        max: 9,
        locale: 'en-US',
        onValueChange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await focus(input);
    // Press Home — should commit to min AND update the editor buffer.
    await fireEvent.keyDown(input, { key: 'Home' });
    await tick();
    expect(input.value).toBe('1');
    // Blur re-parses the buffer; if buffer was stale this would revert to 5.
    await blur(input);
    expect(calls.at(-1)).toBe(1);

    // Now test End.
    await focus(input);
    await fireEvent.keyDown(input, { key: 'End' });
    await tick();
    expect(input.value).toBe('9');
    await blur(input);
    expect(calls.at(-1)).toBe(9);
  });

  test('Step from focused display, not stale value', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        value: 0,
        locale: 'en-US',
        onValueChange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '12');
    await fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(calls).toEqual([13]);
  });

  test('Refocus after stepper click', () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', value: 1, locale: 'en-US' },
    });
    const input = getInput(container);
    getIncrement(container).click();
    expect(document.activeElement).toBe(input);
  });
});

describe('Stepper aria-labels include field + step magnitude', () => {
  test('with label and explicit step', () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', value: 1, label: 'Quantity', step: 5, locale: 'en-US' },
    });
    expect(getIncrement(container).getAttribute('aria-label')).toBe('Increment Quantity by 5');
    expect(getDecrement(container).getAttribute('aria-label')).toBe('Decrement Quantity by 5');
  });

  test('without label falls back to magnitude-only label', () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', value: 1, locale: 'en-US' },
    });
    expect(getIncrement(container).getAttribute('aria-label')).toBe('Increment by 1');
    expect(getDecrement(container).getAttribute('aria-label')).toBe('Decrement by 1');
  });
});

describe('Stepper while focused (editorBuffer sync regression)', () => {
  test('two consecutive ArrowUp presses while focused both advance value and visible text', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        value: 5,
        locale: 'en-US',
        onValueChange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await focus(input);
    await fireEvent.keyDown(input, { key: 'ArrowUp' });
    await fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(calls).toEqual([6, 7]);
    expect(input.value).toBe('7');
  });

  test('Stepper button click syncs visible text after focus restored', async () => {
    // After a stepper click the component refocuses the input. The visible
    // text matches the committed value once focus is back.
    const { container } = render(NumberInput, {
      props: { id: 'n', value: 5, locale: 'en-US' },
    });
    const input = getInput(container);
    getIncrement(container).click();
    await tick();
    expect(input.value).toBe('6');
  });
});

describe('isInternalValueChange stale-flag regression', () => {
  test('malformedError clears when parent writes a valid number after a malformed blur', async () => {
    // Regression: when blur commits null (malformed input), isInternalValueChange
    // was set but never cleared for the unfocused case, so the validity-sync
    // effect's !isInternalValueChange guard was always false and malformedError
    // was never cleared by a subsequent external value change.
    const { container, rerender } = render(NumberInput, {
      props: { id: 'n', value: 5, locale: 'en-US' },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, 'notanumber');
    await blur(input);
    await tick();
    expect(input.getAttribute('aria-invalid')).toBe('true');

    // Parent writes a valid value — malformedError must clear.
    await rerender({ id: 'n', value: 42, locale: 'en-US' });
    await tick();
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });
});
