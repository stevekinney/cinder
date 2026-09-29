import { requiredInstance } from '@lostgradient/testing';
import { render } from '@testing-library/svelte';
import { afterEach, describe, expect, test } from 'bun:test';
import {
  blur,
  cleanupNumberInput,
  focus,
  getHidden,
  getInput,
  type,
} from './number-input-test-helpers.ts';
import NumberInput from './number-input.svelte';
afterEach(cleanupNumberInput);

describe('Validity and a11y wiring', () => {
  test('error prop sets aria-invalid and renders error element', () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', value: null, locale: 'en-US', error: 'Bad' },
    });
    const input = getInput(container);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.closest('.cinder-input-group')?.hasAttribute('data-invalid')).toBe(true);
    const errEl = container.querySelector('#n-error');
    expect(errEl).not.toBeNull();
    expect(input.getAttribute('aria-describedby')).toContain('n-error');
  });

  test('required + empty commit → customError', async () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    const mount = document.createElement('div');
    form.appendChild(mount);
    render(NumberInput, {
      target: mount,
      props: { id: 'n', name: 'q', required: true, locale: 'en-US' },
    });
    const input = requiredInstance(mount.querySelector('#n'), HTMLInputElement);
    await focus(input);
    await blur(input);
    expect(input.validity.customError).toBe(true);
  });

  test('required + garbage → customError', async () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', required: true, locale: 'en-US' },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '12abc');
    await blur(input);
    expect(input.validity.customError).toBe(true);
  });

  test('spinbutton exposes bounded numeric value attributes', () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', value: 5, min: 0, max: 10, locale: 'en-US' },
    });
    const input = getInput(container);
    expect(input.getAttribute('role')).toBe('spinbutton');
    expect(input.getAttribute('aria-valuemin')).toBe('0');
    expect(input.getAttribute('aria-valuemax')).toBe('10');
    expect(input.getAttribute('aria-valuenow')).toBe('5');
  });

  test('spinbutton aria-valuenow follows valid focused edits', async () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', value: 5, min: 0, max: 10, locale: 'en-US' },
    });
    const input = getInput(container);

    await focus(input);
    await type(input, '9');

    expect(input.value).toBe('9');
    expect(input.getAttribute('aria-valuenow')).toBe('9');
  });

  test('spinbutton aria-valuenow uses display units for percent formatting', async () => {
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        value: 0.5,
        min: 0,
        max: 1,
        locale: 'en-US',
        format: { style: 'percent' },
      },
    });
    const input = getInput(container);

    expect(input.value).toBe('50%');
    expect(input.getAttribute('aria-valuenow')).toBe('50');
    expect(input.getAttribute('aria-valuemin')).toBe('0');
    expect(input.getAttribute('aria-valuemax')).toBe('100');

    await focus(input);
    await type(input, '75');

    expect(input.value).toBe('75');
    expect(input.getAttribute('aria-valuenow')).toBe('75');
  });

  test('consumer blur handler fires once', async () => {
    let blurCount = 0;
    const { container } = render(NumberInput, {
      props: {
        id: 'n',
        value: 5,
        locale: 'en-US',
        onblur: () => {
          blurCount += 1;
        },
      },
    });
    const input = getInput(container);

    await focus(input);
    await blur(input);

    expect(blurCount).toBe(1);
  });

  test('malformed customError cleared by external value change', async () => {
    const { container, rerender } = render(NumberInput, {
      props: { id: 'n', locale: 'en-US' },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '12abc');
    await blur(input);
    expect(input.validity.customError).toBe(true);
    await rerender({ id: 'n', value: 5, locale: 'en-US' });
    expect(input.validity.customError).toBe(false);
  });

  test('name omitted: no hidden input rendered, no "undefined" attribute', () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', value: 5, locale: 'en-US' },
    });
    expect(getHidden(container)).toBeNull();
    expect(container.querySelector('[name="undefined"]')).toBeNull();
  });
});

describe('Internal error region announces invalid state', () => {
  test('malformed parse without consumer error shows internal error message', async () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'en-US' },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '12abc');
    await blur(input);
    const errEl = container.querySelector('#n-internal-error');
    expect(errEl).not.toBeNull();
    expect(errEl?.textContent?.trim()).toBe('Please enter a valid number.');
    expect(input.getAttribute('aria-describedby')).toContain('n-internal-error');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  test('required-empty without consumer error shows internal error message', async () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', required: true, locale: 'en-US' },
    });
    const input = getInput(container);
    await focus(input);
    await blur(input);
    const errEl = container.querySelector('#n-internal-error');
    expect(errEl).not.toBeNull();
    expect(errEl?.textContent?.trim()).toBe('Please enter a number.');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  test('consumer error wins over internal error when both could apply', async () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', error: 'Custom error', locale: 'en-US' },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '12abc');
    await blur(input);
    expect(container.querySelector('#n-internal-error')).toBeNull();
    expect(container.querySelector('#n-error')?.textContent?.trim()).toBe('Custom error');
  });

  test('typing clears the internal error region', async () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'en-US' },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '12abc');
    await blur(input);
    expect(container.querySelector('#n-internal-error')).not.toBeNull();
    await focus(input);
    await type(input, '5');
    expect(container.querySelector('#n-internal-error')).toBeNull();
  });

  test('required-empty error does not flash mid-keystroke after malformed clear', async () => {
    // Regression: when required=true and the user re-types after a malformed blur,
    // onInput clears malformedError but value is still null. The validity-sync
    // $effect must NOT set requiredEmptyError while the field is focused — doing so
    // would announce "Please enter a number." in the aria-live region mid-keystroke.
    const { container } = render(NumberInput, {
      props: { id: 'n', required: true, locale: 'en-US' },
    });
    const input = getInput(container);

    // Produce a malformed state by blurring with invalid text.
    await focus(input);
    await type(input, 'abc');
    await blur(input);
    expect(input.getAttribute('aria-invalid')).toBe('true');

    // Re-focus and start correcting. After the first keystroke malformedError
    // clears but value is still null. requiredEmptyError must stay false.
    await focus(input);
    await type(input, '5');

    expect(container.querySelector('#n-internal-error')).toBeNull();
    expect(input.getAttribute('aria-invalid')).toBeFalsy();
  });
});
