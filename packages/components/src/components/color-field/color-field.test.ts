/// <reference lib="dom" />
import { describe, expect, spyOn, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: ColorField } = await import('./color-field.svelte');

function q<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Selector not found: ${selector}`);
  return element as T;
}

function findInput(root: ParentNode, id: string): HTMLInputElement {
  return q<HTMLInputElement>(root, `#${id}`);
}

async function typeAndBlur(input: HTMLInputElement, text: string): Promise<void> {
  await fireEvent.input(input, { target: { value: text } });
  await fireEvent.blur(input);
}

describe('ColorField parse round-trip', () => {
  const cases = [
    { input: '#f00', expected: '#ff0000' },
    { input: 'rgb(255, 0, 0)', expected: '#ff0000' },
    { input: 'hsl(0, 100%, 50%)', expected: '#ff0000' },
    { input: '#ff0000', expected: '#ff0000' },
  ];

  for (const { input, expected } of cases) {
    test(`parses ${input} -> ${expected}`, async () => {
      const seen: string[] = [];
      const { container } = render(ColorField, {
        props: { id: 'cf', name: 'c', onchange: (v: string) => seen.push(v) },
      });
      const field = findInput(container, 'cf');
      await typeAndBlur(field, input);
      expect(seen).toEqual([expected]);
      expect(field.value).toBe(expected);
      const hidden = q<HTMLInputElement>(container, 'input[name="c"]');
      expect(hidden.value).toBe(expected);
    });
  }
});

describe('ColorField parse errors', () => {
  test('invalid input raises parse error and aria-invalid', async () => {
    const seen: string[] = [];
    const { container } = render(ColorField, {
      props: { id: 'cf', onchange: (v: string) => seen.push(v) },
    });
    const field = findInput(container, 'cf');
    await typeAndBlur(field, 'not-a-color');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(seen).toEqual([]);
    expect(field.value).toBe('not-a-color');
    expect(container.textContent).toContain('Enter a valid hex');
  });

  test('custom errorMessage overrides default', async () => {
    const { container } = render(ColorField, {
      props: { id: 'cf', errorMessage: 'Custom oops' },
    });
    const field = findInput(container, 'cf');
    await typeAndBlur(field, 'not-a-color');
    expect(container.textContent).toContain('Custom oops');
  });
});

describe('ColorField alpha behavior', () => {
  test('alpha=false strips alpha from #RRGGBBAA', async () => {
    const seen: string[] = [];
    const { container } = render(ColorField, {
      props: { id: 'cf', alpha: false, onchange: (v: string) => seen.push(v) },
    });
    await typeAndBlur(findInput(container, 'cf'), '#ff000080');
    expect(seen).toEqual(['#ff0000']);
  });

  test('alpha=true emits #RRGGBBAA for partial alpha', async () => {
    const seen: string[] = [];
    const { container } = render(ColorField, {
      props: { id: 'cf', alpha: true, onchange: (v: string) => seen.push(v) },
    });
    await typeAndBlur(findInput(container, 'cf'), '#ff000080');
    expect(seen).toEqual(['#ff000080']);
  });

  test('alpha=true does not pad opaque values', async () => {
    const seen: string[] = [];
    const { container } = render(ColorField, {
      props: { id: 'cf', alpha: true, onchange: (v: string) => seen.push(v) },
    });
    await typeAndBlur(findInput(container, 'cf'), '#ff0000');
    expect(seen).toEqual(['#ff0000']);
  });
});

describe('ColorField formats gate', () => {
  test('formats=[hex] rejects rgb()', async () => {
    const seen: string[] = [];
    const { container } = render(ColorField, {
      props: { id: 'cf', formats: ['hex'], onchange: (v: string) => seen.push(v) },
    });
    await typeAndBlur(findInput(container, 'cf'), 'rgb(0,0,0)');
    expect(seen).toEqual([]);
  });

  test('formats=[rgb] rejects hex literal', async () => {
    const seen: string[] = [];
    const { container } = render(ColorField, {
      props: { id: 'cf', formats: ['rgb'], onchange: (v: string) => seen.push(v) },
    });
    await typeAndBlur(findInput(container, 'cf'), '#000');
    expect(seen).toEqual([]);
  });

  test('canonical-display bypass: re-blur on committed hex does not error', async () => {
    const { container } = render(ColorField, {
      props: { id: 'cf', formats: ['rgb'] },
    });
    const field = findInput(container, 'cf');
    await typeAndBlur(field, 'rgb(0,0,0)');
    expect(field.value).toBe('#000000');
    expect(field.getAttribute('aria-invalid')).not.toBe('true');
    // Re-blur with no edits
    await fireEvent.blur(field);
    expect(field.getAttribute('aria-invalid')).not.toBe('true');
  });
});

describe('ColorField typing does not commit', () => {
  test('typing without blur does not fire onchange or set aria-invalid', async () => {
    const seen: string[] = [];
    const { container } = render(ColorField, {
      props: { id: 'cf', onchange: (v: string) => seen.push(v) },
    });
    const field = findInput(container, 'cf');
    await fireEvent.input(field, { target: { value: '#a' } });
    expect(seen).toEqual([]);
    expect(field.getAttribute('aria-invalid')).not.toBe('true');
  });
});

describe('ColorField Enter key', () => {
  test('default: commit + requestSubmit dispatches form submit', async () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    const submitter = document.createElement('button');
    submitter.textContent = 'Save';
    form.appendChild(submitter);

    const captured: { hidden: string | null; submitter: HTMLElement | null } = {
      hidden: null,
      submitter: null,
    };
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const hidden = form.querySelector<HTMLInputElement>('input[name="c"]');
      captured.hidden = hidden ? hidden.value : null;
      captured.submitter = event.submitter;
    });

    const seen: string[] = [];
    const { container } = render(ColorField, {
      target: form,
      props: { id: 'cf', name: 'c', onchange: (v: string) => seen.push(v) },
    });

    const field = findInput(container, 'cf');
    await fireEvent.input(field, { target: { value: '#ff0000' } });
    const dispatched = await fireEvent.keyDown(field, { key: 'Enter' });
    // fireEvent returns false when the event's default was prevented — which
    // is exactly what ColorField does, regardless of commit outcome.
    expect(dispatched).toBe(false);
    await tick();

    expect(seen).toEqual(['#ff0000']);
    expect(captured.hidden).toBe('#ff0000');
    expect(captured.submitter).toBe(submitter);

    document.body.removeChild(form);
  });

  test('commit-only does not dispatch submit', async () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    let submitted = false;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submitted = true;
    });

    const seen: string[] = [];
    const { container } = render(ColorField, {
      target: form,
      props: {
        id: 'cf',
        name: 'c',
        enterBehavior: 'commit-only',
        onchange: (v: string) => seen.push(v),
      },
    });

    const field = findInput(container, 'cf');
    await fireEvent.input(field, { target: { value: '#ff0000' } });
    await fireEvent.keyDown(field, { key: 'Enter' });
    await tick();

    expect(seen).toEqual(['#ff0000']);
    expect(submitted).toBe(false);

    document.body.removeChild(form);
  });

  test('Enter on invalid input does not submit', async () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    let submitted = false;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submitted = true;
    });

    const { container } = render(ColorField, {
      target: form,
      props: { id: 'cf', name: 'c' },
    });
    const field = findInput(container, 'cf');
    await fireEvent.input(field, { target: { value: 'bogus' } });
    await fireEvent.keyDown(field, { key: 'Enter' });
    await tick();

    expect(submitted).toBe(false);
    expect(field.getAttribute('aria-invalid')).toBe('true');

    document.body.removeChild(form);
  });
});

describe('ColorField blur idempotence', () => {
  test('repeated blur without typing does not re-fire onchange', async () => {
    const seen: string[] = [];
    const { container } = render(ColorField, {
      props: { id: 'cf', onchange: (v: string) => seen.push(v) },
    });
    const field = findInput(container, 'cf');
    await typeAndBlur(field, '#ff0000');
    await fireEvent.focus(field);
    await fireEvent.blur(field);
    expect(seen).toEqual(['#ff0000']);
  });

  test('whitespace blur on empty field does not fire onchange', async () => {
    const seen: string[] = [];
    const { container } = render(ColorField, {
      props: { id: 'cf', onchange: (v: string) => seen.push(v) },
    });
    const field = findInput(container, 'cf');
    await typeAndBlur(field, '   ');
    expect(seen).toEqual([]);
  });

  test('clearing a committed value fires onchange("")', async () => {
    const seen: string[] = [];
    const { container } = render(ColorField, {
      props: { id: 'cf', onchange: (v: string) => seen.push(v) },
    });
    const field = findInput(container, 'cf');
    await typeAndBlur(field, '#ff0000');
    await typeAndBlur(field, '');
    expect(seen).toEqual(['#ff0000', '']);
  });
});

describe('ColorField form reset', () => {
  test('uncontrolled reverts to defaultValue without firing onchange', async () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    const seen: string[] = [];

    const { container } = render(ColorField, {
      target: form,
      props: {
        id: 'cf',
        name: 'c',
        defaultValue: '#abcdef',
        onchange: (v: string) => seen.push(v),
      },
    });
    await tick();

    const field = findInput(container, 'cf');
    expect(field.value).toBe('#abcdef');
    await typeAndBlur(field, '#000000');
    seen.length = 0;

    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await tick();
    expect(field.value).toBe('#abcdef');
    expect(seen).toEqual([]);

    document.body.removeChild(form);
  });
});

describe('ColorField controlled mode', () => {
  test('invalid controlled value renders error and preserves visible text', async () => {
    const { container } = render(ColorField, {
      props: { id: 'cf', name: 'c', value: 'bad' },
    });
    const field = findInput(container, 'cf');
    expect(field.value).toBe('bad');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    const hidden = q<HTMLInputElement>(container, 'input[name="c"]');
    expect(hidden.value).toBe('');
    const swatch = q(container, '.cinder-color-field__swatch');
    expect(swatch.getAttribute('style') ?? '').not.toContain('bad');
    expect(swatch.hasAttribute('data-empty')).toBe(true);
    expect(container.textContent).toContain('Enter a valid');
  });

  test('parent update to a new valid value reconciles visible input and hidden mirror', async () => {
    const { container, rerender } = render(ColorField, {
      props: { id: 'cf', name: 'c', value: '#ff0000' },
    });
    expect(findInput(container, 'cf').value).toBe('#ff0000');
    expect(q<HTMLInputElement>(container, 'input[name="c"]').value).toBe('#ff0000');

    await rerender({ id: 'cf', name: 'c', value: '#0000ff' });
    await tick();
    expect(findInput(container, 'cf').value).toBe('#0000ff');
    expect(q<HTMLInputElement>(container, 'input[name="c"]').value).toBe('#0000ff');
  });

  test('controlled authority: alpha toggle on a value the parent never gave alpha for stays at echo', async () => {
    const seen: string[] = [];
    const { container, rerender } = render(ColorField, {
      props: {
        id: 'cf',
        name: 'c',
        value: '#ff0000',
        alpha: false,
        onchange: (v: string) => seen.push(v),
      },
    });
    expect(q<HTMLInputElement>(container, 'input[name="c"]').value).toBe('#ff0000');
    seen.length = 0;
    // Flip alpha on without changing value. Because we're controlled, the
    // alpha effect reconciles from `value` — there is no alpha to restore.
    await rerender({
      id: 'cf',
      name: 'c',
      value: '#ff0000',
      alpha: true,
      onchange: (v: string) => seen.push(v),
    });
    await tick();
    expect(q<HTMLInputElement>(container, 'input[name="c"]').value).toBe('#ff0000');
    expect(seen).toEqual([]); // No onchange from prop-only toggle.
  });

  test('controlled: form reset is ignored, value remains from prop', async () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    const seen: string[] = [];
    const { container } = render(ColorField, {
      target: form,
      props: { id: 'cf', name: 'c', value: '#abcdef', onchange: (v: string) => seen.push(v) },
    });
    await tick();
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await tick();
    expect(findInput(container, 'cf').value).toBe('#abcdef');
    expect(seen).toEqual([]);
    document.body.removeChild(form);
  });
});

describe('ColorField uncontrolled alpha toggle', () => {
  test('toggling alpha false→true on a committed partial-alpha value re-derives hex', async () => {
    const { container, rerender } = render(ColorField, {
      props: { id: 'cf', name: 'c', alpha: false },
    });
    await typeAndBlur(findInput(container, 'cf'), '#ff000080');
    expect(q<HTMLInputElement>(container, 'input[name="c"]').value).toBe('#ff0000');

    await rerender({ id: 'cf', name: 'c', alpha: true });
    await tick();
    expect(q<HTMLInputElement>(container, 'input[name="c"]').value).toBe('#ff000080');
    expect(findInput(container, 'cf').value).toBe('#ff000080');
  });

  test('reset preserves alpha reconstruction across alpha toggle', async () => {
    const form = document.createElement('form');
    document.body.appendChild(form);

    const { container, rerender } = render(ColorField, {
      target: form,
      props: { id: 'cf', name: 'c', defaultValue: '#ff000080', alpha: false },
    });
    await tick();
    const field = findInput(container, 'cf');
    expect(field.value).toBe('#ff0000');

    await typeAndBlur(field, '#0000ff');
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await tick();
    expect(field.value).toBe('#ff0000');

    await rerender({ id: 'cf', name: 'c', defaultValue: '#ff000080', alpha: true });
    await tick();
    expect(field.value).toBe('#ff000080');

    document.body.removeChild(form);
  });
});

describe('ColorField DOM contract', () => {
  test('class prop merges onto outer wrapper', () => {
    const { container } = render(ColorField, {
      props: { id: 'cf', class: 'custom' },
    });
    const wrapper = q(container, '.cinder-color-field');
    expect(wrapper.classList.contains('custom')).toBe(true);
  });

  test('disabled sets data-disabled on wrapper and disables the input', () => {
    const { container } = render(ColorField, {
      props: { id: 'cf', disabled: true },
    });
    const wrapper = q(container, '.cinder-color-field');
    expect(wrapper.hasAttribute('data-disabled')).toBe(true);
    const field = findInput(container, 'cf');
    expect(field.disabled).toBe(true);
  });

  test('native change event on the input does not invoke onchange', async () => {
    const seen: string[] = [];
    const { container } = render(ColorField, {
      props: { id: 'cf', onchange: (v: string) => seen.push(v) },
    });
    const field = findInput(container, 'cf');
    field.value = '#ff0000';
    field.dispatchEvent(new Event('change'));
    expect(seen).toEqual([]);
  });
});

describe('ColorField mode switch warning', () => {
  test('switching from controlled to undefined logs a DEV warning and preserves state', async () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {});
    const { container, rerender } = render(ColorField, {
      props: { id: 'cf', value: '#abcdef' },
    });
    const field = findInput(container, 'cf');
    expect(field.value).toBe('#abcdef');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await rerender({ id: 'cf', value: undefined as any });
    await tick();

    expect(field.value).toBe('#abcdef');
    expect(warn).toHaveBeenCalled();
    const firstCall = warn.mock.calls[0] as unknown as string[];
    expect(firstCall[0]).toContain('ColorField');
    expect(firstCall[0]).toContain('controlled');

    warn.mockRestore();
  });
});

describe('ColorField composition with FormField', () => {
  test('FormField error and field parse error coexist with distinct ids in aria-describedby', async () => {
    const { default: Fixture } =
      await import('../../test/fixtures/color-field-form-field-fixture.svelte');

    const { container } = render(Fixture, {
      props: {
        fieldId: 'wrapped',
        fieldLabel: 'Brand color',
        fieldError: 'Must match brand palette',
        typedValue: 'not-a-color',
      },
    });

    const field = findInput(container, 'wrapped');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    const describedBy = field.getAttribute('aria-describedby') ?? '';
    const ids = describedBy.split(/\s+/).filter(Boolean);
    // Both the FormField's error id and the ColorField's own error id should
    // appear, without collision.
    expect(ids.length).toBeGreaterThanOrEqual(2);
    for (const idRef of ids) {
      expect(container.querySelector(`#${idRef}`)).not.toBeNull();
    }

    const text = container.textContent ?? '';
    expect(text).toContain('Must match brand palette');
    expect(text).toContain('Enter a valid');
  });
});

describe('ColorField Enter stale-mirror safety', () => {
  test('typing invalid text after a prior commit and pressing Enter does not submit stale hidden mirror', async () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    let submitted = false;
    let submittedHidden: string | null = null;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submitted = true;
      const hidden = form.querySelector<HTMLInputElement>('input[name="c"]');
      submittedHidden = hidden ? hidden.value : null;
    });

    const { container } = render(ColorField, {
      target: form,
      props: { id: 'cf', name: 'c' },
    });
    const field = findInput(container, 'cf');
    await typeAndBlur(field, '#ff0000');
    // Now type invalid text without blurring, press Enter.
    await fireEvent.input(field, { target: { value: 'bogus' } });
    await fireEvent.keyDown(field, { key: 'Enter' });
    await tick();

    expect(submitted).toBe(false);
    expect(submittedHidden).toBeNull();
    // Even when something else tries to submit synchronously, customValidity blocks it.
    expect(field.validity.customError).toBe(true);

    document.body.removeChild(form);
  });

  test('clearing the field then pressing Enter writes the hidden mirror to empty before any submit', async () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    const submits: string[] = [];
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const hidden = form.querySelector<HTMLInputElement>('input[name="c"]');
      submits.push(hidden ? hidden.value : '');
    });

    const { container } = render(ColorField, {
      target: form,
      props: { id: 'cf', name: 'c' },
    });
    const field = findInput(container, 'cf');
    await typeAndBlur(field, '#ff0000');
    expect(q<HTMLInputElement>(container, 'input[name="c"]').value).toBe('#ff0000');

    // Clear without blurring, press Enter. With enterBehavior='commit-then-submit',
    // the cleared commit fires onchange('') but no requestSubmit (committed = false).
    // The hidden mirror must already be '' before any outer submit handler runs.
    await fireEvent.input(field, { target: { value: '' } });
    await fireEvent.keyDown(field, { key: 'Enter' });
    await tick();

    // No submit fired (committed false after clear).
    expect(submits).toEqual([]);
    expect(q<HTMLInputElement>(container, 'input[name="c"]').value).toBe('');

    document.body.removeChild(form);
  });
});

describe('ColorField native form validation', () => {
  test('parse error sets a custom validity message so native submit is blocked', async () => {
    const { container } = render(ColorField, {
      props: { id: 'cf', name: 'c' },
    });
    const field = findInput(container, 'cf');
    await typeAndBlur(field, 'bogus');
    expect(field.validity.customError).toBe(true);
    expect(field.validationMessage).toContain('Enter a valid');

    // Clearing the field via a successful commit clears the custom validity.
    await typeAndBlur(field, '#ff0000');
    await tick();
    expect(field.validity.customError).toBe(false);
    expect(field.validationMessage).toBe('');
  });
});

describe('ColorField reset listener lifecycle', () => {
  test('reset listener is removed on unmount', async () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    const seen: string[] = [];

    const { container, unmount } = render(ColorField, {
      target: form,
      props: { id: 'cf', defaultValue: '#abcdef', onchange: (v: string) => seen.push(v) },
    });
    await tick();
    const field = findInput(container, 'cf');
    await typeAndBlur(field, '#000000');
    expect(seen).toEqual(['#000000']);

    // First reset while mounted — reverts and clears.
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await tick();

    unmount();
    // After unmount, dispatching reset must not throw or invoke any state on
    // the destroyed component.
    expect(() => {
      form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    }).not.toThrow();

    document.body.removeChild(form);
  });
});
