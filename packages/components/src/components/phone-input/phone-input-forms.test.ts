/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';
import type { PhoneInputChange } from './phone-input.types.ts';

setupHappyDom();

const { cleanup, render, fireEvent, waitFor } = await import('@testing-library/svelte');
const { default: PhoneInput } = await import('./phone-input.svelte');

afterEach(cleanup);

function nationalInput(container: Element): HTMLInputElement {
  return container.querySelector<HTMLInputElement>('input[type="tel"]')!;
}

function countrySelect(container: Element): HTMLSelectElement {
  return container.querySelector<HTMLSelectElement>('select')!;
}

describe('PhoneInput form reset', () => {
  test('preserves newer external value and country updates after reset dispatch', async () => {
    const form = document.createElement('form');
    document.body.append(form);
    const rendered = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', name: 'phone', value: '+14155552671', country: 'US' },
      target: form,
    });
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await rendered.rerender({
      id: 'p',
      label: 'Phone',
      name: 'phone',
      value: '+442079460958',
      country: 'GB',
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(countrySelect(rendered.container).value).toBe('GB');
    expect(rendered.container.querySelector('input[type="hidden"]')?.getAttribute('value')).toBe(
      '+442079460958',
    );
    rendered.unmount();
    form.remove();
  });
  test('restores the initial national formatting on reset', async () => {
    const form = document.createElement('form');
    document.body.append(form);
    const rendered = render(PhoneInput, {
      target: form,
      props: {
        id: 'p',
        label: 'Phone',
        country: 'US',
        value: '4155550132',
      },
    });
    const input = nationalInput(rendered.container);

    await waitFor(() => expect(input.value).toBe('(415) 555-0132'));
    await fireEvent.input(input, { target: { value: '2025550123' } });
    expect(input.value).toBe('(202) 555-0123');

    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(countrySelect(rendered.container).value).toBe('US');
    expect(input.value).toBe('(415) 555-0132');
    rendered.unmount();
    form.remove();
  });

  test('preserves invalid initial text on reset', async () => {
    const form = document.createElement('form');
    document.body.append(form);
    const rendered = render(PhoneInput, {
      target: form,
      props: { id: 'p', label: 'Phone', value: 'invalid' },
    });
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(nationalInput(rendered.container).value).toBe('invalid');
    rendered.unmount();
    form.remove();
  });

  test('resynchronizes an untouched non-first initial country on reset', async () => {
    const form = document.createElement('form');
    document.body.append(form);
    const rendered = render(PhoneInput, {
      target: form,
      props: { id: 'p', label: 'Phone', countries: ['US', 'GB'], country: 'GB' },
    });
    expect(countrySelect(rendered.container).value).toBe('GB');
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(countrySelect(rendered.container).value).toBe('GB');
    expect(
      rendered.container.querySelector('.cinder-phone-input__country-summary')?.textContent,
    ).toContain('GB');
    rendered.unmount();
    form.remove();
  });
  test('resynchronizes an untouched initial national display on reset', async () => {
    const form = document.createElement('form');
    document.body.append(form);
    const rendered = render(PhoneInput, {
      target: form,
      props: { id: 'p', label: 'Phone', country: 'US', value: '+14155550132' },
    });
    const input = nationalInput(rendered.container);
    await waitFor(() => expect(input.value).toContain('415'));
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(input.value).toContain('415');
    rendered.unmount();
    form.remove();
  });

  test('does not reset when the reset event is canceled', async () => {
    const form = document.createElement('form');
    document.body.append(form);
    const rendered = render(PhoneInput, {
      target: form,
      props: {
        id: 'p',
        label: 'Phone',
        countries: ['US', 'GB'],
        value: '+14155550132',
      },
    });
    const input = nationalInput(rendered.container);
    await fireEvent.input(input, { target: { value: '2025550123' } });
    const editedDisplay = input.value;
    let resetCanceled = false;
    form.addEventListener('reset', (event) => {
      event.preventDefault();
      resetCanceled = event.defaultPrevented;
    });

    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(resetCanceled).toBe(true);
    expect(input.value).toBe(editedDisplay);
    rendered.unmount();
    form.remove();
  });

  test('preserves a disallowed initial E.164 value literally on reset', async () => {
    const form = document.createElement('form');
    document.body.append(form);
    const changes: PhoneInputChange[] = [];
    const rendered = render(PhoneInput, {
      target: form,
      props: {
        id: 'p',
        label: 'Phone',
        countries: ['US'],
        value: '+442079460958',
        onValueChange: (change: PhoneInputChange) => changes.push(change),
      },
    });
    const input = nationalInput(rendered.container);
    await fireEvent.input(input, { target: { value: '2025550123' } });

    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(countrySelect(rendered.container).value).toBe('US');
    expect(input.value).toBe('+442079460958');

    await fireEvent.input(input, { target: { value: '4155550132' } });
    expect(changes.at(-1)?.country).toBe('US');
    rendered.unmount();
    form.remove();
  });

  test('restores the rendered fallback country for a disallowed initial E.164 value', async () => {
    const form = document.createElement('form');
    document.body.append(form);
    const rendered = render(PhoneInput, {
      target: form,
      props: {
        id: 'p',
        label: 'Phone',
        countries: ['US', 'CA'],
        country: 'CA',
        value: '+442079460958',
      },
    });
    const input = nationalInput(rendered.container);

    await waitFor(() => expect(countrySelect(rendered.container).value).toBe('US'));
    await fireEvent.input(input, { target: { value: '4165550123' } });
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(countrySelect(rendered.container).value).toBe('US');
    expect(input.value).toBe('+442079460958');
    rendered.unmount();
    form.remove();
  });
});

describe('PhoneInput hidden form value', () => {
  test('hidden input carries the canonical E.164 string for a valid number', async () => {
    const { container } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone', name: 'phone' },
    });
    await fireEvent.input(nationalInput(container), { target: { value: '4155550132' } });
    const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"]')!;
    expect(hidden.value).toBe('+14155550132');
  });

  test('hidden input does not emit a stale E.164 after country changes externally without a value update', async () => {
    // Regression for cursor/bugbot: if a consumer changes `country` without
    // updating `value`, the prior E.164 belongs to the previous country and
    // must not be submitted under the new selection.
    const { container, rerender } = render(PhoneInput, {
      props: {
        id: 'p',
        label: 'Phone',
        name: 'phone',
        countries: ['US', 'GB'],
        country: 'US',
        value: '+14155550132',
      },
    });
    const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"]')!;
    expect(hidden.value).toBe('+14155550132');
    await rerender({
      id: 'p',
      label: 'Phone',
      name: 'phone',
      countries: ['US', 'GB'],
      country: 'GB',
      value: '+14155550132',
    });
    // The stored E.164 still parses as US, but the user is now looking at a
    // GB dropdown — submission must not carry the prior US number through.
    expect(hidden.value).toBe('');
  });

  test('non-strict E.164 value (free-form text) is never forwarded to the hidden input', () => {
    // libphonenumber can extract a phone number from arbitrary text like
    // "call +1 415 555 0132" — the hidden form value must NOT carry such
    // input through unchanged. parseE164Value enforces a strict `^\+\d+$`
    // grammar, so the hidden value should be empty.
    const { container } = render(PhoneInput, {
      props: {
        id: 'p',
        label: 'Phone',
        name: 'phone',
        value: 'call +1 415 555 0132',
      },
    });
    const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"]')!;
    expect(hidden.value).toBe('');
  });
});
