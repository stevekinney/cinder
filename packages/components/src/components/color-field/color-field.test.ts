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

function getVisibleInput(container: ParentNode): HTMLInputElement {
  return q<HTMLInputElement>(container, 'input:not([type="hidden"])');
}

function getNamedHidden(container: ParentNode, name: string): HTMLInputElement | null {
  return container.querySelector<HTMLInputElement>(`input[type="hidden"][name="${name}"]`);
}

async function typeAndBlur(container: ParentNode, value: string): Promise<void> {
  const input = getVisibleInput(container);
  await fireEvent.input(input, { target: { value } });
  await fireEvent.blur(input);
  await tick();
}

describe('ColorField — parse round-trip', () => {
  test.each([
    { input: '#f00', expected: '#ff0000' },
    { input: 'rgb(255,0,0)', expected: '#ff0000' },
    { input: 'hsl(0,100%,50%)', expected: '#ff0000' },
    { input: '#ff0000', expected: '#ff0000' },
  ])('parses $input -> $expected', async ({ input, expected }) => {
    const emitted: string[] = [];
    const { container } = render(ColorField, {
      props: { id: 'cf', onchange: (v: string) => emitted.push(v) },
    });
    await typeAndBlur(container, input);
    expect(emitted).toEqual([expected]);
    expect(getVisibleInput(container).value).toBe(expected);
  });
});

describe('ColorField — invalid input', () => {
  test('raises a parse error with aria-invalid', async () => {
    const emitted: string[] = [];
    const { container } = render(ColorField, {
      props: { id: 'cf', onchange: (v: string) => emitted.push(v) },
    });
    await typeAndBlur(container, 'not-a-color');
    const input = getVisibleInput(container);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.value).toBe('not-a-color');
    expect(emitted).toEqual([]);
  });

  test('custom errorMessage overrides default', async () => {
    const { container } = render(ColorField, {
      props: { id: 'cf', errorMessage: 'Bad color!' },
    });
    await typeAndBlur(container, 'oops');
    expect(container.textContent).toContain('Bad color!');
  });
});

describe('ColorField — alpha rule', () => {
  test.each([
    { alpha: false, input: '#ff000080', expected: '#ff0000' },
    { alpha: true, input: '#ff000080', expected: '#ff000080' },
    { alpha: true, input: '#ff0000', expected: '#ff0000' },
  ])('alpha=$alpha input=$input -> $expected', async ({ alpha, input, expected }) => {
    const emitted: string[] = [];
    const { container } = render(ColorField, {
      props: { id: 'cf', alpha, onchange: (v: string) => emitted.push(v) },
    });
    await typeAndBlur(container, input);
    expect(emitted).toEqual([expected]);
  });
});

describe('ColorField — formats gate + canonical-display bypass', () => {
  test('formats=hex rejects rgb()', async () => {
    const emitted: string[] = [];
    const { container } = render(ColorField, {
      props: { id: 'cf', formats: ['hex'], onchange: (v: string) => emitted.push(v) },
    });
    await typeAndBlur(container, 'rgb(0,0,0)');
    expect(emitted).toEqual([]);
    expect(getVisibleInput(container).getAttribute('aria-invalid')).toBe('true');
  });

  test('formats=rgb rejects #000', async () => {
    const emitted: string[] = [];
    const { container } = render(ColorField, {
      props: { id: 'cf', formats: ['rgb'], onchange: (v: string) => emitted.push(v) },
    });
    await typeAndBlur(container, '#000');
    expect(emitted).toEqual([]);
    expect(getVisibleInput(container).getAttribute('aria-invalid')).toBe('true');
  });

  test('formats=rgb accepts rgb() then bypasses gate on canonical re-blur', async () => {
    const emitted: string[] = [];
    const { container } = render(ColorField, {
      props: { id: 'cf', formats: ['rgb'], onchange: (v: string) => emitted.push(v) },
    });
    await typeAndBlur(container, 'rgb(0,0,0)');
    expect(emitted).toEqual(['#000000']);
    await fireEvent.blur(getVisibleInput(container));
    expect(getVisibleInput(container).getAttribute('aria-invalid')).not.toBe('true');
  });
});

describe('ColorField — no commit during typing', () => {
  test('typing without blur does not emit or mark invalid', async () => {
    const emitted: string[] = [];
    const { container } = render(ColorField, {
      props: { id: 'cf', onchange: (v: string) => emitted.push(v) },
    });
    const input = getVisibleInput(container);
    await fireEvent.input(input, { target: { value: '#a' } });
    expect(emitted).toEqual([]);
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
  });
});

function wrapInForm(container: HTMLElement): {
  form: HTMLFormElement;
  submitted: () => boolean;
  submitterText: () => string | null;
} {
  // Reparent rendered nodes into a fresh form within the test container, so
  // testing-library cleanup unmounts cleanly via the original container.
  const form = document.createElement('form');
  const button = document.createElement('button');
  button.textContent = 'Save';
  let submittedFlag = false;
  let submitterText: string | null = null;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submittedFlag = true;
    submitterText = event.submitter?.textContent ?? null;
  });
  while (container.firstChild) form.appendChild(container.firstChild);
  form.appendChild(button);
  container.appendChild(form);
  return { form, submitted: () => submittedFlag, submitterText: () => submitterText };
}

describe('ColorField — Enter behavior', () => {
  test('default commit-then-submit fires onchange and submits the form', async () => {
    const emitted: string[] = [];
    const { container } = render(ColorField, {
      props: { id: 'cf', name: 'c', onchange: (v: string) => emitted.push(v) },
    });
    const wrapped = wrapInForm(container);
    const input = getVisibleInput(wrapped.form);
    await fireEvent.input(input, { target: { value: '#ff0000' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    await tick();

    expect(emitted).toEqual(['#ff0000']);
    expect(wrapped.submitted()).toBe(true);
    expect(wrapped.submitterText()).toBe('Save');
    expect(getNamedHidden(wrapped.form, 'c')!.value).toBe('#ff0000');
  });

  test('commit-only fires onchange but does not submit', async () => {
    const emitted: string[] = [];
    const { container } = render(ColorField, {
      props: {
        id: 'cf',
        name: 'c',
        enterBehavior: 'commit-only',
        onchange: (v: string) => emitted.push(v),
      },
    });
    const wrapped = wrapInForm(container);
    const input = getVisibleInput(wrapped.form);
    await fireEvent.input(input, { target: { value: '#ff0000' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    await tick();

    expect(emitted).toEqual(['#ff0000']);
    expect(wrapped.submitted()).toBe(false);
  });

  test('invalid input + Enter raises error and does not submit', async () => {
    const emitted: string[] = [];
    const { container } = render(ColorField, {
      props: { id: 'cf', name: 'c', onchange: (v: string) => emitted.push(v) },
    });
    const wrapped = wrapInForm(container);
    const input = getVisibleInput(wrapped.form);
    await fireEvent.input(input, { target: { value: 'bad' } });
    const ev = await fireEvent.keyDown(input, { key: 'Enter' });
    await tick();

    expect(emitted).toEqual([]);
    expect(wrapped.submitted()).toBe(false);
    expect(ev).toBe(false);
  });
});

describe('ColorField — blur idempotence', () => {
  test('refocusing and reblurring without typing does not re-emit', async () => {
    const emitted: string[] = [];
    const { container } = render(ColorField, {
      props: { id: 'cf', onchange: (v: string) => emitted.push(v) },
    });
    await typeAndBlur(container, '#ff0000');
    await fireEvent.blur(getVisibleInput(container));
    expect(emitted).toEqual(['#ff0000']);
  });

  test('whitespace blur on empty field does not emit', async () => {
    const emitted: string[] = [];
    const { container } = render(ColorField, {
      props: { id: 'cf', onchange: (v: string) => emitted.push(v) },
    });
    const input = getVisibleInput(container);
    await fireEvent.input(input, { target: { value: '   ' } });
    await fireEvent.blur(input);
    expect(emitted).toEqual([]);
  });

  test('whitespace blur after committed value clears and emits empty', async () => {
    const emitted: string[] = [];
    const { container } = render(ColorField, {
      props: { id: 'cf', onchange: (v: string) => emitted.push(v) },
    });
    await typeAndBlur(container, '#ff0000');
    const input = getVisibleInput(container);
    await fireEvent.input(input, { target: { value: '   ' } });
    await fireEvent.blur(input);
    expect(emitted).toEqual(['#ff0000', '']);
  });
});

describe('ColorField — form reset', () => {
  test('uncontrolled reset reverts to defaultValue and does not emit', async () => {
    const emitted: string[] = [];
    const form = document.createElement('form');
    document.body.appendChild(form);
    const { container } = render(ColorField, {
      target: form,
      props: {
        id: 'cf',
        defaultValue: '#abcdef',
        name: 'c',
        onchange: (v: string) => emitted.push(v),
      },
    });
    await tick();
    const input = getVisibleInput(container);
    await fireEvent.input(input, { target: { value: '#ff0000' } });
    await fireEvent.blur(input);
    await tick();
    expect(emitted).toEqual(['#ff0000']);
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await tick();
    expect(getNamedHidden(container, 'c')!.value).toBe('#abcdef');
    expect(getVisibleInput(container).value).toBe('#abcdef');
    expect(emitted).toEqual(['#ff0000']);
    document.body.removeChild(form);
  });
});

describe('ColorField — controlled invalid value', () => {
  test('value=bad shows verbatim, error, empty mirror', async () => {
    const { container } = render(ColorField, {
      props: { id: 'cf', value: 'bad', name: 'c' },
    });
    const input = getVisibleInput(container);
    expect(input.value).toBe('bad');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(getNamedHidden(container, 'c')!.value).toBe('');
  });
});

describe('ColorField — hidden input mirror + alpha re-derivation', () => {
  test('mirror reflects committedHex; alpha toggle re-derives without onchange', async () => {
    const emitted: string[] = [];
    const onchange = (v: string) => emitted.push(v);
    const { container, rerender } = render(ColorField, {
      props: { id: 'cf', name: 'c', alpha: false, onchange },
    });
    await typeAndBlur(container, '#ff000080');
    expect(getNamedHidden(container, 'c')!.value).toBe('#ff0000');
    await rerender({ id: 'cf', name: 'c', alpha: true, onchange });
    await tick();
    expect(getNamedHidden(container, 'c')!.value).toBe('#ff000080');
    expect(emitted).toEqual(['#ff0000']);
  });
});

describe('ColorField — controlled reconciliation', () => {
  test('parent updates are not silently dropped', async () => {
    const emitted: string[] = [];
    const { rerender, container } = render(ColorField, {
      props: { id: 'cf', value: '#000000', onchange: (v: string) => emitted.push(v) },
    });
    await typeAndBlur(container, '#00ff00');
    expect(emitted).toEqual(['#00ff00']);
    await rerender({ id: 'cf', value: '#ff0000', onchange: (v: string) => emitted.push(v) });
    await tick();
    expect(getVisibleInput(container).value).toBe('#ff0000');
    await rerender({ id: 'cf', value: '#00ff00', onchange: (v: string) => emitted.push(v) });
    await tick();
    expect(getVisibleInput(container).value).toBe('#00ff00');
  });
});

describe('ColorField — composition + DOM contract', () => {
  test('class merges onto outer wrapper', () => {
    const { container } = render(ColorField, {
      props: { id: 'cf', class: 'custom' },
    });
    expect(container.querySelector('.cinder-color-field.custom')).not.toBeNull();
  });

  test('disabled flows to inner input and outer data attribute', () => {
    const { container } = render(ColorField, {
      props: { id: 'cf', disabled: true },
    });
    expect(getVisibleInput(container).disabled).toBe(true);
    expect(container.querySelector('.cinder-color-field[data-cinder-disabled]')).not.toBeNull();
  });

  test('onchange not forwarded to native change event', async () => {
    const emitted: string[] = [];
    const { container } = render(ColorField, {
      props: { id: 'cf', onchange: (v: string) => emitted.push(v) },
    });
    const input = getVisibleInput(container);
    await fireEvent.change(input, { target: { value: '#ff0000' } });
    // Native change without blur should NOT trigger consumer onchange via blur pipeline
    expect(emitted).toEqual([]);
  });
});

describe('ColorField — API edge cases', () => {
  test('both value and defaultValue emits DEV warn once; value wins', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(ColorField, {
      props: { id: 'cf', value: '#aaaaaa', defaultValue: '#bbbbbb' },
    });
    expect(getVisibleInput(container).value).toBe('#aaaaaa');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test('formats=[] emits DEV warn and accepts all formats', async () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {});
    const emitted: string[] = [];
    const { container } = render(ColorField, {
      props: { id: 'cf', formats: [], onchange: (v: string) => emitted.push(v) },
    });
    await typeAndBlur(container, 'rgb(0,0,0)');
    expect(emitted).toEqual(['#000000']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('ColorField — hidden mirror under parse error', () => {
  test('clear invalid text -> mirror empty, onchange empty', async () => {
    const emitted: string[] = [];
    const { container } = render(ColorField, {
      props: { id: 'cf', name: 'c', onchange: (v: string) => emitted.push(v) },
    });
    await typeAndBlur(container, '#ff0000');
    expect(getNamedHidden(container, 'c')!.value).toBe('#ff0000');
    await typeAndBlur(container, 'not-a-color');
    expect(getNamedHidden(container, 'c')!.value).toBe('');
    const input = getVisibleInput(container);
    await fireEvent.input(input, { target: { value: '' } });
    await fireEvent.blur(input);
    expect(getNamedHidden(container, 'c')!.value).toBe('');
    expect(emitted).toEqual(['#ff0000', '']);
  });

  test('fix invalid text -> mirror updates to new valid color', async () => {
    const emitted: string[] = [];
    const { container } = render(ColorField, {
      props: { id: 'cf', name: 'c', onchange: (v: string) => emitted.push(v) },
    });
    await typeAndBlur(container, '#ff0000');
    await typeAndBlur(container, 'not-a-color');
    expect(getNamedHidden(container, 'c')!.value).toBe('');
    await typeAndBlur(container, '#00ff00');
    expect(getNamedHidden(container, 'c')!.value).toBe('#00ff00');
    expect(emitted).toEqual(['#ff0000', '#00ff00']);
  });
});

describe('ColorField — initialization', () => {
  test('uncontrolled defaultValue=#ff000080 + alpha=false -> visible #ff0000', () => {
    const { container } = render(ColorField, {
      props: { id: 'cf', defaultValue: '#ff000080', alpha: false, name: 'c' },
    });
    expect(getVisibleInput(container).value).toBe('#ff0000');
    expect(getNamedHidden(container, 'c')!.value).toBe('#ff0000');
  });

  test('uncontrolled invalid defaultValue collapses silently', () => {
    const { container } = render(ColorField, {
      props: { id: 'cf', defaultValue: 'bad', name: 'c' },
    });
    expect(getVisibleInput(container).value).toBe('');
    expect(getVisibleInput(container).getAttribute('aria-invalid')).not.toBe('true');
    expect(getNamedHidden(container, 'c')!.value).toBe('');
  });

  test('controlled value=bad shows verbatim with error', () => {
    const { container } = render(ColorField, {
      props: { id: 'cf', value: 'bad', name: 'c' },
    });
    expect(getVisibleInput(container).value).toBe('bad');
    expect(getNamedHidden(container, 'c')!.value).toBe('');
  });
});

describe('ColorField — formats change does not clear error', () => {
  test('changing formats while error is active leaves error in place', async () => {
    const emitted: string[] = [];
    const { container, rerender } = render(ColorField, {
      props: { id: 'cf', formats: ['hex'], name: 'c', onchange: (v: string) => emitted.push(v) },
    });
    await typeAndBlur(container, 'rgb(0,0,0)');
    const input = getVisibleInput(container);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(getNamedHidden(container, 'c')!.value).toBe('');

    await rerender({
      id: 'cf',
      formats: ['rgb'],
      name: 'c',
      onchange: (v: string) => emitted.push(v),
    });
    await tick();
    // Error still present until next blur
    expect(getVisibleInput(container).getAttribute('aria-invalid')).toBe('true');
    expect(getNamedHidden(container, 'c')!.value).toBe('');

    await fireEvent.blur(getVisibleInput(container));
    expect(getNamedHidden(container, 'c')!.value).toBe('#000000');
    expect(emitted).toEqual(['#000000']);
  });
});

describe('ColorField — controlled parent ignores onchange', () => {
  test('optimistic state persists until parent issues a real value change', async () => {
    const emitted: string[] = [];
    const onchange = (v: string) => emitted.push(v);
    const { rerender, container } = render(ColorField, {
      props: { id: 'cf', value: '#000000', onchange },
    });
    await tick();
    await typeAndBlur(container, '#ff0000');
    await tick();
    expect(emitted).toEqual(['#ff0000']);
    expect(getVisibleInput(container).value).toBe('#ff0000');
    // A real prop change to a different value takes precedence.
    await rerender({ id: 'cf', value: '#0000ff', onchange });
    await tick();
    expect(getVisibleInput(container).value).toBe('#0000ff');
  });
});
