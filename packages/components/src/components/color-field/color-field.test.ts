/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { ComponentProps } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte/pure');
const { tick } = await import('svelte');
const { default: ColorField } = await import('./color-field.svelte');
const { default: ColorFieldFormFixture } =
  await import('../../test/fixtures/color-field-form-fixture.svelte');
const { default: ColorFieldFormFieldFixture } =
  await import('../../test/fixtures/color-field-form-field-fixture.svelte');

afterEach(() => {
  document.body.replaceChildren();
});

function q<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Selector not found: ${selector}`);
  return element as T;
}

function getInput(container: ParentNode, id = 'color'): HTMLInputElement {
  return q<HTMLInputElement>(container, `#${id}`);
}

function renderColorFieldFormFixture(props: ComponentProps<typeof ColorFieldFormFixture>) {
  const result = render(ColorFieldFormFixture, { props });
  const form = result.container.querySelector('form');
  if (!(form instanceof HTMLElement)) {
    throw new Error('ColorField form fixture did not render a <form> element.');
  }
  return {
    ...result,
    container: form,
  };
}

async function typeAndBlur(input: HTMLInputElement, text: string): Promise<void> {
  await fireEvent.input(input, { target: { value: text } });
  await fireEvent.blur(input);
  await tick();
}

describe('ColorField — parse round-trips', () => {
  const cases = [
    { input: '#f00', expected: '#ff0000' },
    { input: 'rgb(255, 0, 0)', expected: '#ff0000' },
    { input: 'hsl(0, 100%, 50%)', expected: '#ff0000' },
    { input: '#ff0000', expected: '#ff0000' },
  ];

  for (const { input: text, expected } of cases) {
    test(`commits ${text} as ${expected}`, async () => {
      const onchange = mock<(value: string) => void>(() => {});
      const { container } = render(ColorField, { id: 'color', name: 'c', onchange });
      const input = getInput(container);
      await typeAndBlur(input, text);
      expect(onchange).toHaveBeenCalledTimes(1);
      expect(onchange.mock.calls[0]?.[0]).toBe(expected);
      expect(input.value).toBe(expected);
      const hidden = q<HTMLInputElement>(container, 'input[type="hidden"][name="c"]');
      expect(hidden.value).toBe(expected);
    });
  }
});

describe('ColorField — invalid input', () => {
  test('raises parse error, sets aria-invalid, does not fire onchange', async () => {
    const onchange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, { id: 'color', onchange });
    const input = getInput(container);
    await typeAndBlur(input, 'not-a-color');
    expect(onchange).not.toHaveBeenCalled();
    expect(input.value).toBe('not-a-color');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(container.querySelector('.cinder-input-field__error')?.textContent ?? '').toContain(
      'valid hex',
    );
  });

  test('custom errorMessage overrides default text', async () => {
    const { container } = render(ColorField, {
      id: 'color',
      errorMessage: 'Pick a color from the palette.',
    });
    const input = getInput(container);
    await typeAndBlur(input, 'nope');
    expect(container.querySelector('.cinder-input-field__error')?.textContent).toContain(
      'Pick a color from the palette.',
    );
  });
});

describe('ColorField — alpha behavior', () => {
  const cases = [
    { alpha: false, input: '#ff000080', expected: '#ff0000' },
    { alpha: true, input: '#ff000080', expected: '#ff000080' },
    { alpha: true, input: '#ff0000', expected: '#ff0000' },
  ];

  for (const { alpha, input: text, expected } of cases) {
    test(`alpha=${alpha} + ${text} → ${expected}`, async () => {
      const onchange = mock<(value: string) => void>(() => {});
      const { container } = render(ColorField, { id: 'color', alpha, name: 'c', onchange });
      const input = getInput(container);
      await typeAndBlur(input, text);
      expect(onchange.mock.calls[0]?.[0]).toBe(expected);
      const hidden = q<HTMLInputElement>(container, 'input[type="hidden"][name="c"]');
      expect(hidden.value).toBe(expected);
    });
  }
});

describe('ColorField — formats gate', () => {
  test('formats=[hex] rejects rgb input', async () => {
    const onchange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, {
      id: 'color',
      formats: ['hex'],
      onchange,
    });
    const input = getInput(container);
    await typeAndBlur(input, 'rgb(0,0,0)');
    expect(onchange).not.toHaveBeenCalled();
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  test('formats=[rgb] accepts rgb, then re-blur on canonical hex is a no-op (bypass)', async () => {
    const onchange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, {
      id: 'color',
      formats: ['rgb'],
      onchange,
    });
    const input = getInput(container);
    await typeAndBlur(input, 'rgb(0,0,0)');
    expect(onchange.mock.calls[0]?.[0]).toBe('#000000');
    expect(input.value).toBe('#000000');
    // Re-blur with the canonical hex already in the field. The bypass should
    // keep us in a valid state with no new error.
    await fireEvent.blur(input);
    await tick();
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
    expect(onchange).toHaveBeenCalledTimes(1);
  });

  test('formats=[hex] + #abc accepted', async () => {
    const onchange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, {
      id: 'color',
      formats: ['hex'],
      onchange,
    });
    const input = getInput(container);
    await typeAndBlur(input, '#abc');
    expect(onchange.mock.calls[0]?.[0]).toBe('#aabbcc');
  });
});

describe('ColorField — no commit during typing', () => {
  test('typing without blur does not call onchange or set aria-invalid', async () => {
    const onchange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, { id: 'color', onchange });
    const input = getInput(container);
    await fireEvent.input(input, { target: { value: '#a' } });
    await tick();
    expect(onchange).not.toHaveBeenCalled();
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
  });
});

describe('ColorField — Enter behavior', () => {
  test('default commit-then-submit fires onchange and submits via requestSubmit', async () => {
    const onchange = mock<(value: string) => void>(() => {});
    const onsubmit = mock<(event: SubmitEvent) => void>((event) => event.preventDefault());
    const { container } = renderColorFieldFormFixture({
      id: 'color',
      name: 'c',
      enterBehavior: 'commit-then-submit',
      onchange,
      onsubmit,
    });
    const input = getInput(container);
    await fireEvent.input(input, { target: { value: '#ff0000' } });
    const event = await fireEvent.keyDown(input, { key: 'Enter' });
    await tick();
    expect(onchange.mock.calls[0]?.[0]).toBe('#ff0000');
    expect(onsubmit).toHaveBeenCalledTimes(1);
    expect(event).toBe(false); // preventDefault returns false from fireEvent
    const hidden = q<HTMLInputElement>(container, 'input[type="hidden"][name="c"]');
    expect(hidden.value).toBe('#ff0000');
  });

  test('commit-only commits but does NOT submit', async () => {
    const onchange = mock<(value: string) => void>(() => {});
    const onsubmit = mock<(event: SubmitEvent) => void>((event) => event.preventDefault());
    const { container } = renderColorFieldFormFixture({
      id: 'color',
      name: 'c',
      enterBehavior: 'commit-only',
      onchange,
      onsubmit,
    });
    const input = getInput(container);
    await fireEvent.input(input, { target: { value: '#00ff00' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    await tick();
    expect(onchange.mock.calls[0]?.[0]).toBe('#00ff00');
    expect(onsubmit).not.toHaveBeenCalled();
  });

  test('invalid + Enter raises error, does NOT submit', async () => {
    const onchange = mock<(value: string) => void>(() => {});
    const onsubmit = mock<(event: SubmitEvent) => void>((event) => event.preventDefault());
    const { container } = renderColorFieldFormFixture({
      id: 'color',
      name: 'c',
      enterBehavior: 'commit-then-submit',
      onchange,
      onsubmit,
    });
    const input = getInput(container);
    await fireEvent.input(input, { target: { value: 'nope' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    await tick();
    expect(onchange).not.toHaveBeenCalled();
    expect(onsubmit).not.toHaveBeenCalled();
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  test('no-name case: Enter still submits with no color in FormData', async () => {
    const onchange = mock<(value: string) => void>(() => {});
    const onsubmit = mock<(event: SubmitEvent) => void>((event) => event.preventDefault());
    const { container } = renderColorFieldFormFixture({
      id: 'color',
      enterBehavior: 'commit-then-submit',
      onchange,
      onsubmit,
    });
    const input = getInput(container);
    await fireEvent.input(input, { target: { value: '#abcdef' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    await tick();
    expect(onchange.mock.calls[0]?.[0]).toBe('#abcdef');
    expect(onsubmit).toHaveBeenCalledTimes(1);
    expect(container.querySelector('input[type="hidden"][name]')).toBeNull();
  });
});

describe('ColorField — blur idempotence', () => {
  test('blur after committing without typing does not refire onchange', async () => {
    const onchange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, { id: 'color', onchange });
    const input = getInput(container);
    await typeAndBlur(input, '#ff0000');
    await fireEvent.focus(input);
    await fireEvent.blur(input);
    await tick();
    expect(onchange).toHaveBeenCalledTimes(1);
  });

  test('whitespace blur on empty field is a no-op', async () => {
    const onchange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, { id: 'color', onchange });
    const input = getInput(container);
    await typeAndBlur(input, '   ');
    expect(onchange).not.toHaveBeenCalled();
  });

  test('whitespace blur after a committed value emits empty', async () => {
    const onchange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, { id: 'color', onchange });
    const input = getInput(container);
    await typeAndBlur(input, '#ff0000');
    await typeAndBlur(input, '   ');
    expect(onchange).toHaveBeenCalledTimes(2);
    expect(onchange.mock.calls[1]?.[0]).toBe('');
  });
});

describe('ColorField — form reset', () => {
  test('uncontrolled: reset reverts to defaultValue without firing onchange', async () => {
    const onchange = mock<(value: string) => void>(() => {});
    const { container } = renderColorFieldFormFixture({
      id: 'color',
      name: 'c',
      defaultValue: '#abcdef',
      onchange,
    });
    const input = getInput(container);
    await typeAndBlur(input, '#ff0000');
    expect(input.value).toBe('#ff0000');
    expect(onchange).toHaveBeenCalledTimes(1);
    const form = container;
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await tick();
    expect(input.value).toBe('#abcdef');
    expect(onchange).toHaveBeenCalledTimes(1);
  });

  test('uncontrolled with alpha-bearing default: alpha=true reconstructs after reset', async () => {
    const { container, rerender } = renderColorFieldFormFixture({
      id: 'color',
      name: 'c',
      defaultValue: '#ff000080',
      alpha: false,
    });
    const input = getInput(container);
    expect(input.value).toBe('#ff0000');
    await typeAndBlur(input, '#00ff00');
    const form = container;
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await tick();
    expect(input.value).toBe('#ff0000');
    await rerender({ id: 'color', name: 'c', defaultValue: '#ff000080', alpha: true });
    await tick();
    expect(input.value).toBe('#ff000080');
  });
});

describe('ColorField — controlled invalid value', () => {
  test('external invalid value preserves visible text, raises error, no onchange', async () => {
    const onchange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, {
      id: 'color',
      name: 'c',
      value: 'bad',
      onchange,
    });
    await tick();
    const input = getInput(container);
    expect(input.value).toBe('bad');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const hidden = q<HTMLInputElement>(container, 'input[type="hidden"][name="c"]');
    expect(hidden.value).toBe('');
    expect(onchange).not.toHaveBeenCalled();
    const swatch = q(container, '.cinder-color-field__swatch');
    expect(swatch.getAttribute('style') ?? '').not.toContain('bad');
    expect(swatch.getAttribute('data-cinder-empty')).toBe('');
  });
});

describe('ColorField — hidden mirror + alpha re-derivation', () => {
  test('alpha toggle re-derives hidden mirror without firing onchange', async () => {
    const onchange = mock<(value: string) => void>(() => {});
    const { container, rerender } = render(ColorField, {
      id: 'color',
      name: 'c',
      alpha: false,
      onchange,
    });
    const input = getInput(container);
    await typeAndBlur(input, '#ff000080');
    let hidden = q<HTMLInputElement>(container, 'input[type="hidden"][name="c"]');
    expect(hidden.value).toBe('#ff0000');
    expect(onchange).toHaveBeenCalledTimes(1);

    await rerender({ id: 'color', name: 'c', alpha: true, onchange });
    await tick();
    hidden = q<HTMLInputElement>(container, 'input[type="hidden"][name="c"]');
    expect(hidden.value).toBe('#ff000080');
    expect(onchange).toHaveBeenCalledTimes(1);
  });
});

describe('ColorField — controlled reconciliation', () => {
  test('parent updates are always observed; same-value re-applies are safe', async () => {
    const onchange = mock<(value: string) => void>(() => {});
    const { container, rerender } = render(ColorField, {
      id: 'color',
      name: 'c',
      value: '#000000',
      onchange,
    });
    const input = getInput(container);
    await typeAndBlur(input, '#00ff00');
    expect(onchange.mock.calls[0]?.[0]).toBe('#00ff00');

    // Parent rejects our commit and forces a different value.
    await rerender({ id: 'color', name: 'c', value: '#ff0000', onchange });
    await tick();
    expect(input.value).toBe('#ff0000');

    // Parent applies the prior committed value.
    await rerender({ id: 'color', name: 'c', value: '#00ff00', onchange });
    await tick();
    expect(input.value).toBe('#00ff00');

    // Parent re-applies the same value — no change in field, no error.
    await rerender({ id: 'color', name: 'c', value: '#00ff00', onchange });
    await tick();
    expect(input.value).toBe('#00ff00');
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
  });
});

describe('ColorField — controlled authority over alpha', () => {
  test('parent echo without alpha + alpha toggle does not retain partial alpha', async () => {
    const { container, rerender } = render(ColorField, {
      id: 'color',
      name: 'c',
      value: '#ff0000',
      alpha: false,
    });
    const input = getInput(container);
    await typeAndBlur(input, '#ff000080');

    // Parent echoes the opaque hex (rejecting the alpha component).
    await rerender({ id: 'color', name: 'c', value: '#ff0000', alpha: false });
    await tick();

    await rerender({ id: 'color', name: 'c', value: '#ff0000', alpha: true });
    await tick();
    const hidden = q<HTMLInputElement>(container, 'input[type="hidden"][name="c"]');
    expect(hidden.value).toBe('#ff0000');
  });
});

describe('ColorField — composition + DOM contract', () => {
  test('FormField error coexists with ColorField parse error', async () => {
    const { container } = render(ColorFieldFormFieldFixture, {
      id: 'color',
      fieldError: 'Must match brand palette.',
    });
    const input = getInput(container);
    await typeAndBlur(input, 'nope');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    // Both error texts render somewhere in the composition.
    const errorTexts = Array.from(
      container.querySelectorAll('.cinder-input-field__error, .cinder-form-field__error'),
    ).map((el) => el.textContent ?? '');
    expect(errorTexts.some((t) => t.includes('Must match brand palette.'))).toBe(true);
    expect(errorTexts.some((t) => t.includes('valid hex'))).toBe(true);
    // aria-describedby references at least one error id (Input's own, since
    // the ColorField-owned parse error takes precedence on the inner input).
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    expect(describedBy.length).toBeGreaterThan(0);
  });

  test('native change event does NOT invoke consumer onchange', async () => {
    const onchange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, { id: 'color', onchange });
    const input = getInput(container);
    await fireEvent.input(input, { target: { value: '#ff0000' } });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();
    expect(onchange).not.toHaveBeenCalled();
  });

  test('class prop merges onto wrapper', () => {
    const { container } = render(ColorField, { id: 'color', class: 'custom-extra' });
    const wrapper = q(container, '.cinder-color-field');
    expect(wrapper.classList.contains('custom-extra')).toBe(true);
  });

  test('disabled forwards to inner input and outer wrapper', () => {
    const { container } = render(ColorField, { id: 'color', disabled: true });
    const input = getInput(container);
    expect(input.disabled).toBe(true);
    const wrapper = q(container, '.cinder-color-field');
    expect(wrapper.getAttribute('data-cinder-disabled')).toBe('');
  });

  test('reset on a mounted form runs once and survives a follow-up dispatch', async () => {
    const onchange = mock<(value: string) => void>(() => {});
    const { container } = renderColorFieldFormFixture({
      id: 'color',
      name: 'c',
      defaultValue: '#abcdef',
      onchange,
    });
    const form = container;
    const input = getInput(container);
    await typeAndBlur(input, '#000000');
    expect(input.value).toBe('#000000');
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await tick();
    expect(input.value).toBe('#abcdef');
    // A second reset is also a no-op — listener still attached, default value re-applies.
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await tick();
    expect(input.value).toBe('#abcdef');
    // Reset must not fire onchange — the test below asserts this didn't sneak through.
    expect(onchange).toHaveBeenCalledTimes(1);
  });

  test('uncontrolled→controlled mode switch leaves prior state intact', async () => {
    // Mount uncontrolled, then rerender with `value` set. The controlled-sync
    // effect is gated by `isControlled` captured at mount, so the field should
    // ignore the late `value` prop and keep whatever the user has typed.
    const { container, rerender } = render(ColorField, { id: 'color' });
    const input = getInput(container);
    await fireEvent.input(input, { target: { value: '#123456' } });
    await fireEvent.blur(input);
    await tick();
    expect(input.value).toBe('#123456');
    await rerender({ id: 'color', value: '#000000' });
    await tick();
    // Late-arriving `value` is ignored because mode was captured as uncontrolled.
    expect(input.value).toBe('#123456');
  });
});

describe('ColorField — constraint validation (submit-button click)', () => {
  test('invalid text marks the input invalid via setCustomValidity', async () => {
    const { container } = render(ColorField, { id: 'color' });
    const input = getInput(container);
    await typeAndBlur(input, 'not-a-color');
    expect(input.validity.valid).toBe(false);
    expect(input.validationMessage).toBeTruthy();
  });

  test('valid commit clears customValidity', async () => {
    const { container } = render(ColorField, { id: 'color' });
    const input = getInput(container);
    await typeAndBlur(input, 'not-a-color');
    expect(input.validity.valid).toBe(false);
    await typeAndBlur(input, '#ff0000');
    expect(input.validity.valid).toBe(true);
  });
});

describe('ColorField — 4-char hex (#rgba)', () => {
  test('alpha=false strips alpha from #abcd', async () => {
    const onchange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, { id: 'color', onchange });
    const input = getInput(container);
    await typeAndBlur(input, '#abcd');
    expect(onchange.mock.calls[0]?.[0]).toBe('#aabbcc');
  });

  test('alpha=true preserves alpha from #abcd', async () => {
    const onchange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, { id: 'color', alpha: true, onchange });
    const input = getInput(container);
    await typeAndBlur(input, '#abcd');
    expect(onchange.mock.calls[0]?.[0]).toBe('#aabbccdd');
  });
});

describe('ColorField — controlled init honors formats gate', () => {
  test('formats=[hex] + value="rgb(0,0,0)" surfaces parse error at mount', async () => {
    const { container } = render(ColorField, {
      id: 'color',
      formats: ['hex'],
      value: 'rgb(0,0,0)',
    });
    await tick();
    const input = getInput(container);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.value).toBe('rgb(0,0,0)');
  });

  test('formats=[hex] + defaultValue="rgb(0,0,0)" leaves field empty (silent reject)', () => {
    const { container } = render(ColorField, {
      id: 'color',
      formats: ['hex'],
      defaultValue: 'rgb(0,0,0)',
    });
    const input = getInput(container);
    expect(input.value).toBe('');
  });
});

describe('ColorField — controlled reconcile trims whitespace', () => {
  test('value with surrounding whitespace is accepted', async () => {
    const { container } = render(ColorField, {
      id: 'color',
      value: '  #ff0000  ',
    });
    await tick();
    const input = getInput(container);
    expect(input.value).toBe('#ff0000');
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
  });
});

describe('ColorField — Enter in controlled mode with equivalent syntax', () => {
  test('controlled value + user typing equivalent syntax + Enter still submits', async () => {
    const onsubmit = mock<(event: SubmitEvent) => void>((event) => event.preventDefault());
    const { container } = renderColorFieldFormFixture({
      id: 'color',
      name: 'c',
      value: '#ff0000',
      enterBehavior: 'commit-then-submit',
      onsubmit,
    });
    const input = getInput(container);
    await fireEvent.input(input, { target: { value: 'rgb(255,0,0)' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    await tick();
    expect(onsubmit).toHaveBeenCalledTimes(1);
  });
});

describe('ColorField — forwarded form attributes', () => {
  test('required forwards to native input', () => {
    const { container } = render(ColorField, { id: 'color', required: true });
    const input = getInput(container);
    expect(input.required).toBe(true);
  });

  test('readonly forwards to native input', () => {
    const { container } = render(ColorField, { id: 'color', readonly: true });
    const input = getInput(container);
    expect(input.readOnly).toBe(true);
  });

  test('placeholder forwards to native input', () => {
    const { container } = render(ColorField, {
      id: 'color',
      placeholder: 'Pick a color',
    });
    const input = getInput(container);
    expect(input.placeholder).toBe('Pick a color');
  });

  test('ariaLabel forwards as aria-label', () => {
    const { container } = render(ColorField, {
      id: 'color',
      ariaLabel: 'Accent color',
    });
    const input = getInput(container);
    expect(input.getAttribute('aria-label')).toBe('Accent color');
  });
});

describe('ColorField — Enter-clear sync regression', () => {
  test('clearing the field and pressing Enter submits with empty hidden mirror', async () => {
    const onsubmit = mock<(event: SubmitEvent) => void>((event) => event.preventDefault());
    let hiddenAtSubmit: string | undefined;
    const onsubmitCapture: (event: SubmitEvent) => void = (event) => {
      const target = event.target as HTMLFormElement;
      const mirror = target.querySelector<HTMLInputElement>('input[type="hidden"][name="c"]');
      hiddenAtSubmit = mirror?.value;
      onsubmit(event);
    };
    const { container } = render(ColorFieldFormFixture, {
      id: 'color',
      name: 'c',
      defaultValue: '#ff0000',
      enterBehavior: 'commit-then-submit',
      onsubmit: onsubmitCapture,
    });
    const input = getInput(container);
    expect(input.value).toBe('#ff0000');
    await fireEvent.input(input, { target: { value: '' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    await tick();
    expect(onsubmit).toHaveBeenCalledTimes(1);
    expect(hiddenAtSubmit).toBe('');
  });
});

describe('ColorField — reset honors formats gate', () => {
  test('reset with defaultValue rejected by formats clears rather than re-applying', async () => {
    const { container } = render(ColorFieldFormFixture, {
      id: 'color',
      name: 'c',
      formats: ['hex'],
      defaultValue: 'rgb(0,0,0)',
    });
    const input = getInput(container);
    // Initial: defaultValue is rgb() but formats=['hex'] — silently rejected at mount.
    expect(input.value).toBe('');
    await typeAndBlur(input, '#abcdef');
    expect(input.value).toBe('#abcdef');
    const form = q<HTMLFormElement>(container, 'form');
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await tick();
    // After reset: defaultValue still fails formats gate; field clears.
    expect(input.value).toBe('');
  });
});

describe('ColorField — default error message reflects formats', () => {
  test('formats=[hex] surfaces a hex-only error message', async () => {
    const { container } = render(ColorField, { id: 'color', formats: ['hex'] });
    const input = getInput(container);
    await typeAndBlur(input, 'rgb(0,0,0)');
    const errorText = container.querySelector('.cinder-input-field__error')?.textContent ?? '';
    expect(errorText).toContain('hex');
    expect(errorText).not.toContain('rgb');
    expect(errorText).not.toContain('hsl');
  });

  test('default formats produces the legacy three-format message', async () => {
    const { container } = render(ColorField, { id: 'color' });
    const input = getInput(container);
    await typeAndBlur(input, 'nope');
    const errorText = container.querySelector('.cinder-input-field__error')?.textContent ?? '';
    expect(errorText).toContain('hex');
    expect(errorText).toContain('rgb()');
    expect(errorText).toContain('hsl()');
  });

  test('error wording refreshes when formats changes at runtime', async () => {
    const { container, rerender } = render(ColorField, {
      id: 'color',
      formats: ['hex'],
    });
    const input = getInput(container);
    await typeAndBlur(input, 'rgb(0,0,0)');
    let errorText = container.querySelector('.cinder-input-field__error')?.textContent ?? '';
    expect(errorText).toContain('hex');
    expect(errorText).not.toContain('rgb');
    // Widen formats to include rgb. The visible text is now valid; the error
    // should be cleared.
    await rerender({ id: 'color', formats: ['hex', 'rgb'] });
    await tick();
    errorText = container.querySelector('.cinder-input-field__error')?.textContent ?? '';
    expect(errorText).toBe('');

    // Now type something that fails the new gate (an hsl color, still not allowed)
    // and assert the wording mentions the currently allowed formats, not the old set.
    await typeAndBlur(input, 'hsl(0,100%,50%)');
    errorText = container.querySelector('.cinder-input-field__error')?.textContent ?? '';
    expect(errorText).toContain('rgb()');

    // Narrow back down. Wording should refresh even though the text still
    // fails the gate.
    await rerender({ id: 'color', formats: ['hex'] });
    await tick();
    errorText = container.querySelector('.cinder-input-field__error')?.textContent ?? '';
    expect(errorText).toContain('hex');
    expect(errorText).not.toContain('rgb');
    expect(errorText).not.toContain('hsl');
  });
});
