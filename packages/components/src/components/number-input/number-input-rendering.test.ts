import { render } from '@testing-library/svelte';
import { afterEach, describe, expect, test } from 'bun:test';
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
import type { NumberInputProps } from './number-input.types.ts';
afterEach(cleanupNumberInput);

test('renders a custom adornment before the steppers', () => {
  const { container } = render(NumberInput, {
    props: { id: 'amount', value: 12, adornment: 'USD' },
  });

  expect(container.querySelector('.cinder-number-input__adornment')?.textContent).toBe('USD');
});

describe('NumberInput basics', () => {
  test('sidecar includes Input styles and preserves the full stepper width', async () => {
    const [css, componentSource] = await Promise.all([
      Bun.file(new URL('./number-input.css', import.meta.url)).text(),
      Bun.file(new URL('./number-input.svelte', import.meta.url)).text(),
    ]);

    expect(css).toContain("@import '../input/input.css';");
    expect(css).toMatch(
      /\.cinder-input-group:has\(> \.cinder-number-input__input\)\s*> \.cinder-input-group__trailing\s*\{[^}]*max-inline-size:\s*none;/,
    );
    expect(css).toMatch(
      /\.cinder-input-group:has\(> \.cinder-number-input__input\)\s*> \.cinder-input-group__trailing\s*\{[^}]*gap:\s*0;[^}]*padding-inline:\s*0;/,
    );
    expect(css).toMatch(
      /\.cinder-number-input\[data-invalid\]\s+\.cinder-number-input__stepper\s*\{[^}]*border-inline-start-color:\s*var\(--cinder-status-danger-solid\);/,
    );
    expect(css).not.toMatch(
      /\.cinder-input-group:has\(> \.cinder-number-input__input\[aria-invalid='true'\]\)\s*\{/,
    );
    expect(componentSource).toContain("from '../input/index.ts';");
    expect(componentSource).not.toContain("from '../input/input.svelte'");
  });

  test('composes the editable control through Input', () => {
    const { container } = render(NumberInput, { props: { id: 'n', value: 2 } });

    expect(container.querySelector('.cinder-input-group')).not.toBeNull();
    expect(getInput(container).closest('.cinder-input-group')).not.toBeNull();
  });

  test('marks the outer field wrapper as a full-width layout participant', () => {
    const { container } = render(NumberInput, { props: { id: 'n', value: 2 } });
    const field = container.firstElementChild;

    expect(field?.classList.contains('cinder-input-field')).toBe(true);
    expect(field?.hasAttribute('data-cinder-full-width')).toBe(true);
  });

  test('forwards the native input attachment', () => {
    let attachedInput: HTMLInputElement | undefined;
    render(NumberInput, {
      props: {
        id: 'n',
        inputAttachment: (node: HTMLInputElement) => {
          attachedInput = node;
        },
      },
    });

    expect(attachedInput?.id).toBe('n');
  });

  test('keeps consumer layout classes on the root and the component hook on the frame', () => {
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        class: 'custom-number-input',
        style: 'accent-color: rebeccapurple',
      },
    });

    const input = getInput(container);
    expect(container.firstElementChild?.classList.contains('custom-number-input')).toBe(true);
    expect(container.querySelector('.cinder-input-group.cinder-number-input')).not.toBeNull();
    expect(container.querySelector('.cinder-input-group.custom-number-input')).toBeNull();
    expect(container.querySelector('.cinder-input-field.cinder-number-input')).toBeNull();
    expect(input.classList.contains('custom-number-input')).toBe(false);
    expect(input.getAttribute('style')).toContain('accent-color: rebeccapurple');
  });

  test('reactively forwards updated native attributes to Input', async () => {
    const { container, rerender } = render(NumberInput, {
      props: { id: 'n', placeholder: 'Initial' },
    });

    await rerender({ id: 'n', placeholder: 'Updated' });

    expect(getInput(container).getAttribute('placeholder')).toBe('Updated');
  });

  test('renders Lucide icons for the stepper controls', () => {
    const { container } = render(NumberInput, { props: { id: 'n', value: 2 } });

    expect(getIncrement(container).querySelector('svg.lucide-plus')).not.toBeNull();
    expect(getDecrement(container).querySelector('svg.lucide-minus')).not.toBeNull();
    expect(getIncrement(container).textContent?.trim()).toBe('');
    expect(getDecrement(container).textContent?.trim()).toBe('');
  });

  test('type surface excludes inherited defaultValue', () => {
    const excludesInheritedDefaultValue: 'defaultValue' extends keyof NumberInputProps
      ? false
      : true = true;

    expect(excludesInheritedDefaultValue).toBe(true);
  });

  test('renders with value formatted in en-US', () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', value: 1234.5, locale: 'en-US' },
    });
    expect(getInput(container).value).toBe('1,234.5');
  });

  test('controlled value updates display', async () => {
    const { container, rerender } = render(NumberInput, {
      props: { id: 'n', value: 1, locale: 'en-US' },
    });
    expect(getInput(container).value).toBe('1');
    await rerender({ id: 'n', value: 42, locale: 'en-US' });
    expect(getInput(container).value).toBe('42');
  });

  test('per-keystroke does not commit `0.`', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        value: null,
        locale: 'en-US',
        onValueChange: (v: number | null) => calls.push(v),
      },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '0.');
    expect(input.value).toBe('0.');
    expect(calls).toEqual([]);
  });

  test('bare `-` survives mid-typing without committing', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'en-US', onValueChange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '-');
    expect(input.value).toBe('-');
    expect(calls).toEqual([]);
  });

  test('blur commits valid number and reformats', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'en-US', onValueChange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '1234.5');
    await blur(input);
    expect(calls).toEqual([1234.5]);
    expect(input.value).toBe('1,234.5');
  });

  test('blur empty fires onValueChange(null)', async () => {
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
    await type(input, '');
    await blur(input);
    expect(calls).toEqual([null]);
  });

  test('blur `0.` → 0', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'en-US', onValueChange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '0.');
    await blur(input);
    expect(calls).toEqual([0]);
  });

  test('blur `.5` → 0.5', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'en-US', onValueChange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '.5');
    await blur(input);
    expect(calls).toEqual([0.5]);
  });

  test('blur `+1` → 1', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'en-US', onValueChange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '+1');
    await blur(input);
    expect(calls).toEqual([1]);
  });

  test('blur bare `-` → null', async () => {
    const calls: Array<number | null> = [];
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'en-US', onValueChange: (v: number | null) => calls.push(v) },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '-');
    await blur(input);
    expect(calls).toEqual([null]);
  });
});

describe('NumberInput — required marker', () => {
  test('renders the shared required marker on a standalone NumberInput', () => {
    const { container } = render(NumberInput, {
      props: { id: 'req-number', value: null, label: 'Count', required: true },
    });
    const marker = container.querySelector('.cinder-_required-marker');
    expect(marker).not.toBeNull();
    expect(marker?.getAttribute('aria-hidden')).toBe('true');
    expect(marker?.textContent).toBe('*');
  });
});
