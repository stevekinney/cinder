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

    warn.mockRestore();
  });
});
