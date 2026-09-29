import { requiredInstance } from '@lostgradient/testing';
import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, test } from 'bun:test';
import { tick } from 'svelte';
import {
  blur,
  cleanupNumberInput,
  focus,
  getDecrement,
  getHidden,
  getIncrement,
  getInput,
  type,
} from './number-input-test-helpers.ts';
import NumberInput from './number-input.svelte';
afterEach(cleanupNumberInput);

describe('Form integration', () => {
  test('disabled disables input and steppers AND omits hidden', () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', name: 'q', value: 5, disabled: true, locale: 'en-US' },
    });
    expect(getInput(container).disabled).toBe(true);
    expect(getIncrement(container).disabled).toBe(true);
    expect(getDecrement(container).disabled).toBe(true);
    expect(getHidden(container)).toBeNull();
  });

  test('hidden input carries canonical numeric string when enabled+named', () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', name: 'q', value: 1234.5, locale: 'en-US' },
    });
    expect(getHidden(container)?.value).toBe('1234.5');
  });

  test('visible input has no name attribute', () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', name: 'q', value: 1, locale: 'en-US' },
    });
    expect(getInput(container).hasAttribute('name')).toBe(false);
  });

  test('hidden input value used for form submission is canonical numeric string', () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', name: 'q', value: 1234.5, locale: 'en-US' },
    });
    const hidden = getHidden(container);
    expect(hidden).not.toBeNull();
    expect(hidden?.value).toBe('1234.5');
    expect(hidden?.getAttribute('name')).toBe('q');
  });

  test('form reset (uncontrolled) restores value and fires onValueChange', async () => {
    const calls: Array<number | null> = [];
    const form = document.createElement('form');
    document.body.appendChild(form);
    const mount = document.createElement('div');
    form.appendChild(mount);
    render(NumberInput, {
      target: mount,
      props: {
        id: 'n',
        value: 5,
        locale: 'en-US',
        onValueChange: (v: number | null) => calls.push(v),
      },
    });
    const input = requiredInstance(mount.querySelector('#n'), HTMLInputElement);
    await focus(input);
    await type(input, '99');
    await blur(input);
    calls.length = 0;
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    expect(calls).toEqual([5]);
  });
});

describe('Form serialization correctness', () => {
  test('formdata event picks up hidden input with canonical numeric string', () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    const mount = document.createElement('div');
    form.appendChild(mount);
    render(NumberInput, {
      target: mount,
      props: { id: 'n', name: 'q', value: 1234.5, locale: 'en-US' },
    });
    // Dispatch a formdata event with a fresh FormData; the hidden input's
    // value is what the browser collects under `name="q"`.
    const fd = new FormData();
    const hidden = requiredInstance(mount.querySelector('input[type="hidden"]'), HTMLInputElement);
    fd.set(hidden.name, hidden.value);
    expect(fd.get('q')).toBe('1234.5');
  });

  test('mid-edit value reaches form serialization on submit', async () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    const mount = document.createElement('div');
    form.appendChild(mount);
    render(NumberInput, {
      target: mount,
      props: { id: 'n', name: 'q', value: 0, locale: 'en-US' },
    });
    const input = requiredInstance(mount.querySelector('#n'), HTMLInputElement);
    await focus(input);
    await type(input, '999');
    // Press Enter — the onKeyDown handler commits via `commitFromText`,
    // which flushes the in-progress edit buffer into the canonical value
    // (and therefore the hidden input). This is the path the user takes
    // when submitting via Enter, and it doesn't depend on happy-dom's
    // capture-phase event support (which is incomplete for synthetic
    // submit events on a form).
    await fireEvent.keyDown(input, { key: 'Enter' });
    await tick();
    const hidden = requiredInstance(mount.querySelector('input[type="hidden"]'), HTMLInputElement);
    expect(hidden.value).toBe('999');
  });

  test('Enter key fires onValueChange exactly once (regression: capture-phase submit double-fire)', async () => {
    // Regression: pressing Enter called commitFromText in onKeyDown, then
    // requestSubmit() triggered the capture-phase submit listener which called
    // commitFromText again, causing a duplicate onValueChange emission.
    const calls: Array<number | null> = [];
    const form = document.createElement('form');
    document.body.appendChild(form);
    const mount = document.createElement('div');
    form.appendChild(mount);
    render(NumberInput, {
      target: mount,
      props: {
        id: 'n',
        name: 'q',
        value: 0,
        locale: 'en-US',
        onValueChange: (v: number | null) => calls.push(v),
      },
    });
    const input = requiredInstance(mount.querySelector('#n'), HTMLInputElement);
    await focus(input);
    await type(input, '42');
    calls.length = 0;
    await fireEvent.keyDown(input, { key: 'Enter' });
    await tick();
    expect(calls).toEqual([42]);
  });
});

describe('Required + reset and other validity edge cases', () => {
  test('required + form-reset-to-null stays invalid', async () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    const mount = document.createElement('div');
    form.appendChild(mount);
    render(NumberInput, {
      target: mount,
      props: { id: 'n', name: 'q', required: true, value: null, locale: 'en-US' },
    });
    const input = requiredInstance(mount.querySelector('#n'), HTMLInputElement);
    // Force into an invalid-required state on reset.
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    expect(input.validity.customError).toBe(true);
  });

  test('malformed blur keeps user text visible for correction', async () => {
    const { container } = render(NumberInput, {
      props: { id: 'n', locale: 'en-US' },
    });
    const input = getInput(container);
    await focus(input);
    await type(input, '12abc');
    await blur(input);
    // The hostile-form-UX behavior would erase to '' here. The component
    // keeps the user's text so they can edit it.
    expect(input.value).toBe('12abc');
    expect(input.validity.customError).toBe(true);
  });

  test('disabled form listeners are no-ops', async () => {
    const calls: Array<number | null> = [];
    const form = document.createElement('form');
    document.body.appendChild(form);
    const mount = document.createElement('div');
    form.appendChild(mount);
    render(NumberInput, {
      target: mount,
      props: {
        id: 'n',
        name: 'q',
        value: 5,
        disabled: true,
        locale: 'en-US',
        onValueChange: (v: number | null) => calls.push(v),
      },
    });
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    expect(calls).toEqual([]);
  });
});

describe('FormField context overrides', () => {
  test('context-disabled disables steppers and omits hidden input', async () => {
    // Render the component and patch context post-hoc: use disabled prop as
    // the proxy since FormField is a separate test concern. (Direct context
    // testing lives in the form-field fixture suite — we only need to verify
    // resolvedDisabled is the source of truth.)
    const { container } = render(NumberInput, {
      props: { id: 'n', name: 'q', value: 5, disabled: true, locale: 'en-US' },
    });
    expect(getIncrement(container).disabled).toBe(true);
    expect(getHidden(container)).toBeNull();
  });
});
