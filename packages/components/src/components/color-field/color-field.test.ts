/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { ComponentProps } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, render, fireEvent } = await import('@testing-library/svelte/pure');
const { tick } = await import('svelte');
const { default: ColorField } = await import('./color-field.svelte');
const { default: ColorFieldFormFixture } =
  await import('../../test/fixtures/color-field-form-fixture.svelte');
const { default: ColorFieldFormFieldFixture } =
  await import('../../test/fixtures/color-field-form-field-fixture.svelte');

afterEach(() => {
  cleanup();
  // Rendering the fixture into the default container avoids the happy-dom
  // detached-child teardown failure that showed up when these tests mounted
  // standalone forms under document.body.
  document.body.replaceChildren();
});

function q<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Selector not found: ${selector}`);
  return element as T;
}

function renderColorFieldFormFixture(props: ComponentProps<typeof ColorFieldFormFixture>) {
  const result = render(ColorFieldFormFixture, { target: document.body, props });
  const form = document.body.querySelector('form:last-of-type');
  if (!(form instanceof HTMLFormElement)) {
    throw new Error('Expected ColorFieldFormFixture to render a form');
  }
  return { ...result, container: form };
}

function getInput(container: ParentNode, id = 'color'): HTMLInputElement {
  return q<HTMLInputElement>(container, `#${id}`);
}

async function typeAndBlur(input: HTMLInputElement, text: string): Promise<void> {
  await fireEvent.input(input, { target: { value: text } });
  await fireEvent.blur(input);
  await tick();
}

describe('ColorField — color picker trigger', () => {
  test('composes picker dependencies through public component entries', async () => {
    const source = await Bun.file(new URL('./color-field.svelte', import.meta.url)).text();

    expect(source).toContain("from '@lostgradient/cinder/button'");
    expect(source).toContain("from '@lostgradient/cinder/color-picker'");
    expect(source).toContain("from '@lostgradient/cinder/popover'");
    expect(source).not.toContain("from '../button/button.svelte'");
    expect(source).not.toContain("from '../color-picker/color-picker.svelte'");
    expect(source).not.toContain("from '../popover/popover.svelte'");
  });

  test('uses an accessible button that opens the composed ColorPicker', async () => {
    const { container } = render(ColorField, { id: 'color', name: 'color' });
    const trigger = q<HTMLButtonElement>(container, '.cinder-color-field__swatch-button');
    const swatch = q(container, '.cinder-color-field__swatch');

    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger.getAttribute('aria-label')).toBe('Choose a color');
    expect(swatch.tagName).toBe('SPAN');
    expect(swatch.getAttribute('aria-hidden')).toBe('true');

    await tick();
    await fireEvent.click(trigger);
    await tick();

    expect(document.body.querySelector('.cinder-color-picker')).not.toBeNull();
  });

  test('keeps the composed picker open during keyboard slider commits', async () => {
    const { container } = render(ColorField, { id: 'color', value: '#ff0000' });
    await fireEvent.click(q<HTMLButtonElement>(container, '.cinder-color-field__swatch-button'));
    const hue = q<HTMLElement>(document.body, '[role="slider"][aria-label="Hue"]');

    await fireEvent.keyDown(hue, { key: 'ArrowRight' });
    await tick();

    expect(document.body.querySelector('.cinder-color-picker')).not.toBeNull();
  });

  test('disables an open picker when the field becomes readonly', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container, rerender } = render(ColorField, {
      id: 'color',
      value: '#ff0000',
      onValueChange,
    });
    await fireEvent.click(q<HTMLButtonElement>(container, '.cinder-color-field__swatch-button'));
    const hue = q<HTMLElement>(document.body, '[role="slider"][aria-label="Hue"]');

    await rerender({
      id: 'color',
      value: '#ff0000',
      readonly: true,
      onValueChange,
    });
    await fireEvent.keyDown(hue, { key: 'ArrowRight' });

    expect(hue.getAttribute('aria-disabled')).toBe('true');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  // Review thread (PR #1420, PRRT_kwDOSKrFTs6b67FF): the embedded
  // ColorPicker used to stay at its default format="hex" regardless of the
  // field's own `format`. Any picker-driven commit therefore quantized
  // alpha to an 8-bit hex byte internally (e.g. an existing `/ 0.5` became
  // `/ 0.502`) BEFORE handlePickerCommit ever re-parsed and reformatted it
  // into the field's actual `format` — corrupting the committed precision
  // even for interactions (like nudging hue) that never touch alpha at all.
  // The picker now receives the field's `format` directly.
  test("a picker-driven commit preserves the field value's decimal alpha precision", async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, {
      id: 'color',
      value: 'rgb(255 0 0 / 0.5)',
      alpha: true,
      format: 'rgb',
      onValueChange,
    });
    await fireEvent.click(q<HTMLButtonElement>(container, '.cinder-color-field__swatch-button'));
    const hue = q<HTMLElement>(document.body, '[role="slider"][aria-label="Hue"]');

    // Nudge hue only — alpha should pass through untouched. If the embedded
    // picker were still hex by default, this alone would already corrupt
    // 0.5 into ~0.502 via 8-bit byte quantization.
    await fireEvent.keyDown(hue, { key: 'ArrowRight' });
    await tick();

    expect(onValueChange).toHaveBeenCalled();
    const committed = onValueChange.mock.calls.at(-1)![0];
    expect(committed).toMatch(/\/\s*0\.5\)$/);
  });
});

describe('ColorField — parse round-trips', () => {
  const cases = [
    { input: '#f00', expected: '#ff0000' },
    { input: 'rgb(255, 0, 0)', expected: '#ff0000' },
    { input: 'hsl(0, 100%, 50%)', expected: '#ff0000' },
    { input: '#ff0000', expected: '#ff0000' },
  ];

  for (const { input: text, expected } of cases) {
    test(`commits ${text} as ${expected}`, async () => {
      const onValueChange = mock<(value: string) => void>(() => {});
      const { container } = render(ColorField, { id: 'color', name: 'c', onValueChange });
      const input = getInput(container);
      await typeAndBlur(input, text);
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls[0]?.[0]).toBe(expected);
      expect(input.value).toBe(expected);
      const hidden = q<HTMLInputElement>(container, 'input[type="hidden"][name="c"]');
      expect(hidden.value).toBe(expected);
    });
  }
});

describe('ColorField — invalid input', () => {
  test('raises parse error, sets aria-invalid, does not fire onValueChange', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, { id: 'color', onValueChange });
    const input = getInput(container);
    await typeAndBlur(input, 'not-a-color');
    expect(onValueChange).not.toHaveBeenCalled();
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

  // Review thread (PR #1420, PRRT_kwDOSKrFTs6b7zRP): while the field is
  // already invalid, changing `errorMessage` used to leave the displayed
  // live-region error (and the native custom-validity message) stale —
  // the reconciliation effect tracked only `formats`/`format`, not
  // `errorMessage`, so it didn't rerun until another validation or
  // formats/format change. `errorMessage` is now tracked explicitly too
  // (without tracking the draft text itself).
  test('changing errorMessage while already invalid refreshes the displayed error immediately', async () => {
    const { container, rerender } = render(ColorField, {
      id: 'color',
      errorMessage: 'Pick a color from the palette.',
    });
    const input = getInput(container);
    await typeAndBlur(input, 'nope');
    expect(container.querySelector('.cinder-input-field__error')?.textContent).toContain(
      'Pick a color from the palette.',
    );

    // Parent swaps in a different custom message while still invalid.
    await rerender({ id: 'color', errorMessage: 'Try a hex code like #336699.' });
    await tick();
    expect(container.querySelector('.cinder-input-field__error')?.textContent).toContain(
      'Try a hex code like #336699.',
    );
    expect(container.querySelector('.cinder-input-field__error')?.textContent).not.toContain(
      'Pick a color from the palette.',
    );

    // Parent removes the custom message entirely — falls back to the
    // generated default.
    await rerender({ id: 'color', errorMessage: undefined });
    await tick();
    const errorText = container.querySelector('.cinder-input-field__error')?.textContent ?? '';
    expect(errorText).not.toContain('Try a hex code like #336699.');
    expect(errorText).toContain('hex');
  });

  // Review thread (PR #1420, PRRT_kwDOSKrFTs6b8Ax4): folding `errorMessage`
  // into the SAME effect that reconciles/commits format-widened drafts (the
  // previous round's fix for the errorMessage-staleness bug above) meant an
  // errorMessage-only change also re-ran that reconciliation branch. If the
  // user had an invalid blur behind them and had since typed a new,
  // now-valid replacement draft, that draft got silently committed to
  // `value` (via `seedFromParts`) the moment a parent changed
  // `errorMessage` — with no blur, no Enter, and no `onValueChange` —
  // breaking the exact local-draft contract the split was supposed to
  // protect. The errorMessage-only effect is now fully separate from the
  // formats/format reconciliation effect: it only ever refreshes the
  // displayed message, never touches `visibleText`/`value`.
  test('changing errorMessage while an uncommitted valid draft is in progress does NOT commit the draft', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container, rerender } = render(ColorField, {
      id: 'color',
      errorMessage: 'Pick a color from the palette.',
      onValueChange,
    });
    const input = getInput(container);

    // Invalid blur first, so parseError is set.
    await typeAndBlur(input, 'nope');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(onValueChange).not.toHaveBeenCalled();

    // Type a fully valid replacement WITHOUT blurring — a local draft.
    await fireEvent.input(input, { target: { value: '#ff0000' } });
    await tick();
    expect(onValueChange).not.toHaveBeenCalled();

    // Parent changes errorMessage while that draft is still uncommitted.
    await rerender({
      id: 'color',
      errorMessage: 'Try a hex code like #336699.',
      onValueChange,
    });
    await tick();

    // The draft must NOT have been silently committed.
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input.value).toBe('#ff0000');
    const hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden.value).toBe('');

    // Only the next real commit (blur) actually seeds/emits it.
    await fireEvent.blur(input);
    await tick();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]![0]).toBe('#ff0000');
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
      const onValueChange = mock<(value: string) => void>(() => {});
      const { container } = render(ColorField, { id: 'color', alpha, name: 'c', onValueChange });
      const input = getInput(container);
      await typeAndBlur(input, text);
      expect(onValueChange.mock.calls[0]?.[0]).toBe(expected);
      const hidden = q<HTMLInputElement>(container, 'input[type="hidden"][name="c"]');
      expect(hidden.value).toBe(expected);
    });
  }
});

describe('ColorField — formats gate', () => {
  test('formats=[hex] rejects rgb input', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, {
      id: 'color',
      formats: ['hex'],
      onValueChange,
    });
    const input = getInput(container);
    await typeAndBlur(input, 'rgb(0,0,0)');
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  test('formats=[rgb] accepts rgb, then re-blur on canonical hex is a no-op (bypass)', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, {
      id: 'color',
      formats: ['rgb'],
      onValueChange,
    });
    const input = getInput(container);
    await typeAndBlur(input, 'rgb(0,0,0)');
    expect(onValueChange.mock.calls[0]?.[0]).toBe('#000000');
    expect(input.value).toBe('#000000');
    // Re-blur with the canonical hex already in the field. The bypass should
    // keep us in a valid state with no new error.
    await fireEvent.blur(input);
    await tick();
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  test('formats=[rgb] accepts a visual picker commit even though the picker emits hex', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, {
      id: 'color',
      value: 'rgb(255, 0, 0)',
      formats: ['rgb'],
      onValueChange,
    });

    await fireEvent.click(q<HTMLButtonElement>(container, 'button[aria-label="Choose a color"]'));
    await fireEvent.keyDown(q<HTMLElement>(document.body, '[role="slider"][aria-label="Hue"]'), {
      key: 'ArrowRight',
    });

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[0]).toMatch(/^#[0-9a-f]{6}$/);
    expect(getInput(container).getAttribute('aria-invalid')).not.toBe('true');
  });

  test('formats=[hex] + #abc accepted', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, {
      id: 'color',
      formats: ['hex'],
      onValueChange,
    });
    const input = getInput(container);
    await typeAndBlur(input, '#abc');
    expect(onValueChange.mock.calls[0]?.[0]).toBe('#aabbcc');
  });

  test('default formats accept hwb input', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, { id: 'color', onValueChange });

    await typeAndBlur(getInput(container), 'hwb(120 20% 30%)');

    expect(onValueChange.mock.calls[0]?.[0]).toBe('#33b333');
  });

  test('formats=[oklch] accepts an oklch() input string', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, {
      id: 'color',
      formats: ['oklch'],
      onValueChange,
    });
    await typeAndBlur(getInput(container), 'oklch(0% 0 0)');
    expect(onValueChange.mock.calls[0]?.[0]).toBe('#000000');
  });
});

describe('ColorField — format (output)', () => {
  test('default format is hex, so existing consumers are unaffected', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, { id: 'color', onValueChange });
    await typeAndBlur(getInput(container), '#ff0000');
    expect(onValueChange.mock.calls[0]?.[0]).toBe('#ff0000');
  });

  test('format="rgb" emits modern rgb() syntax', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, { id: 'color', format: 'rgb', onValueChange });
    await typeAndBlur(getInput(container), '#ff0000');
    expect(onValueChange.mock.calls[0]?.[0]).toBe('rgb(255 0 0)');
  });

  test('format="hsl" emits modern hsl() syntax', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, { id: 'color', format: 'hsl', onValueChange });
    await typeAndBlur(getInput(container), '#0000ff');
    expect(onValueChange.mock.calls[0]?.[0]).toBe('hsl(240 100% 50%)');
  });

  test('format="hwb" emits modern hwb() syntax', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, { id: 'color', format: 'hwb', onValueChange });
    await typeAndBlur(getInput(container), '#00ff00');
    expect(onValueChange.mock.calls[0]?.[0]).toBe('hwb(120 0% 0%)');
  });

  test('format="oklch" emits modern oklch() syntax', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, { id: 'color', format: 'oklch', onValueChange });
    await typeAndBlur(getInput(container), '#ffffff');
    expect(onValueChange.mock.calls[0]?.[0]).toMatch(/^oklch\(/);
  });

  test('non-hex format with alpha uses slash alpha syntax, alpha=true and a<1', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, {
      id: 'color',
      format: 'rgb',
      alpha: true,
      onValueChange,
    });
    await typeAndBlur(getInput(container), '#ff000080');
    expect(onValueChange.mock.calls[0]?.[0]).toBe('rgb(255 0 0 / 0.502)');
  });

  test('alpha=false strips alpha even for non-hex formats', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, {
      id: 'color',
      format: 'rgb',
      alpha: false,
      onValueChange,
    });
    await typeAndBlur(getInput(container), '#ff000080');
    expect(onValueChange.mock.calls[0]?.[0]).toBe('rgb(255 0 0)');
  });

  test('formats (input) and format (output) are independent: oklch input, hex output', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, {
      id: 'color',
      formats: ['oklch'],
      format: 'hex',
      onValueChange,
    });
    await typeAndBlur(getInput(container), 'oklch(100% 0 0)');
    expect(onValueChange.mock.calls[0]?.[0]).toBe('#ffffff');
  });
});

describe('ColorField — no commit during typing', () => {
  test('typing without blur does not call onValueChange or set aria-invalid', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, { id: 'color', onValueChange });
    const input = getInput(container);
    await fireEvent.input(input, { target: { value: '#a' } });
    await tick();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
  });

  // Review thread (PR #1420, PRRT_kwDOSKrFTs6b67FB): the formats/format
  // reconciliation effect used to also (implicitly) track `visibleText`, so
  // once an invalid blur left `parseError` set, EVERY subsequent keystroke
  // re-ran it. As soon as the user's in-progress replacement draft became
  // parseable, it was silently committed — without blur/Enter and without
  // firing `onValueChange` — breaking the local-draft contract this exact
  // describe block is about. The effect is now scoped to actual
  // `formats`/`format` prop changes only (via `void formats; void format;`
  // plus `untrack` around everything else), so typing alone — even typing
  // that happens to make the draft valid — can never trigger it.
  test('typing a valid replacement after an invalid blur does NOT auto-commit before the next blur/Enter', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, { id: 'color', onValueChange });
    const input = getInput(container);

    // Commit something invalid first, so parseError is set.
    await typeAndBlur(input, 'not-a-color');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(onValueChange).not.toHaveBeenCalled();

    // Now type a fully valid replacement WITHOUT blurring. `formats`/
    // `format` never changed — this must stay a local, uncommitted draft.
    await fireEvent.input(input, { target: { value: '#ff0000' } });
    await tick();
    expect(onValueChange).not.toHaveBeenCalled();

    const hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden.value).toBe('');

    // Only the next commit (blur) actually seeds/emits it.
    await fireEvent.blur(input);
    await tick();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]![0]).toBe('#ff0000');
  });
});

describe('ColorField — Enter behavior', () => {
  test('default commit-then-submit fires onValueChange and submits via requestSubmit', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const onsubmit = mock<(event: SubmitEvent) => void>((event) => event.preventDefault());
    const { container } = renderColorFieldFormFixture({
      id: 'color',
      name: 'c',
      enterBehavior: 'commit-then-submit',
      onValueChange,
      onsubmit,
    });
    const input = getInput(container);
    await fireEvent.input(input, { target: { value: '#ff0000' } });
    const event = await fireEvent.keyDown(input, { key: 'Enter' });
    await tick();
    expect(onValueChange.mock.calls[0]?.[0]).toBe('#ff0000');
    expect(onsubmit).toHaveBeenCalledTimes(1);
    expect(event).toBe(false); // preventDefault returns false from fireEvent
    const hidden = q<HTMLInputElement>(container, 'input[type="hidden"][name="c"]');
    expect(hidden.value).toBe('#ff0000');
  });

  test('commit-only commits but does NOT submit', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const onsubmit = mock<(event: SubmitEvent) => void>((event) => event.preventDefault());
    const { container } = renderColorFieldFormFixture({
      id: 'color',
      name: 'c',
      enterBehavior: 'commit-only',
      onValueChange,
      onsubmit,
    });
    const input = getInput(container);
    await fireEvent.input(input, { target: { value: '#00ff00' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    await tick();
    expect(onValueChange.mock.calls[0]?.[0]).toBe('#00ff00');
    expect(onsubmit).not.toHaveBeenCalled();
  });

  test('invalid + Enter raises error, does NOT submit', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const onsubmit = mock<(event: SubmitEvent) => void>((event) => event.preventDefault());
    const { container } = renderColorFieldFormFixture({
      id: 'color',
      name: 'c',
      enterBehavior: 'commit-then-submit',
      onValueChange,
      onsubmit,
    });
    const input = getInput(container);
    await fireEvent.input(input, { target: { value: 'nope' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    await tick();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onsubmit).not.toHaveBeenCalled();
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  test('no-name case: Enter still submits with no color in FormData', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const onsubmit = mock<(event: SubmitEvent) => void>((event) => event.preventDefault());
    const { container } = renderColorFieldFormFixture({
      id: 'color',
      enterBehavior: 'commit-then-submit',
      onValueChange,
      onsubmit,
    });
    const input = getInput(container);
    await fireEvent.input(input, { target: { value: '#abcdef' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    await tick();
    expect(onValueChange.mock.calls[0]?.[0]).toBe('#abcdef');
    expect(onsubmit).toHaveBeenCalledTimes(1);
    expect(container.querySelector('input[type="hidden"][name]')).toBeNull();
  });
});

describe('ColorField — blur idempotence', () => {
  test('blur after committing without typing does not refire onValueChange', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, { id: 'color', onValueChange });
    const input = getInput(container);
    await typeAndBlur(input, '#ff0000');
    await fireEvent.focus(input);
    await fireEvent.blur(input);
    await tick();
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  test('whitespace blur on empty field is a no-op', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, { id: 'color', onValueChange });
    const input = getInput(container);
    await typeAndBlur(input, '   ');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test('whitespace blur after a committed value emits empty', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, { id: 'color', onValueChange });
    const input = getInput(container);
    await typeAndBlur(input, '#ff0000');
    await typeAndBlur(input, '   ');
    expect(onValueChange).toHaveBeenCalledTimes(2);
    expect(onValueChange.mock.calls[1]?.[0]).toBe('');
  });
});

describe('ColorField — form reset', () => {
  test('uncontrolled: reset reverts to value without firing onValueChange', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = renderColorFieldFormFixture({
      id: 'color',
      name: 'c',
      value: '#abcdef',
      onValueChange,
    });
    const input = getInput(container);
    await typeAndBlur(input, '#ff0000');
    expect(input.value).toBe('#ff0000');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    const form = container;
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await tick();
    expect(input.value).toBe('#abcdef');
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  test('canceled reset leaves the committed color unchanged', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = renderColorFieldFormFixture({
      id: 'color',
      name: 'c',
      value: '',
      onValueChange,
    });
    const input = getInput(container);
    await typeAndBlur(input, '#123456');
    expect(input.value).toBe('#123456');
    const hidden = q<HTMLInputElement>(container, 'input[type="hidden"][name="c"]');
    expect(hidden.value).toBe('#123456');

    const form = container;
    form.addEventListener('reset', (event) => event.preventDefault(), { once: true });
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await tick();

    expect(input.value).toBe('#123456');
    expect(hidden.value).toBe('#123456');
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  test('uncontrolled with alpha-bearing default: alpha=true reconstructs after reset', async () => {
    const { container, rerender } = renderColorFieldFormFixture({
      id: 'color',
      name: 'c',
      value: '#ff000080',
      alpha: false,
    });
    const input = getInput(container);
    expect(input.value).toBe('#ff0000');
    await typeAndBlur(input, '#00ff00');
    const form = container;
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await tick();
    expect(input.value).toBe('#ff0000');
    await rerender({ id: 'color', name: 'c', value: '#ff000080', alpha: true });
    await tick();
    expect(input.value).toBe('#ff000080');
  });
});

describe('ColorField — controlled invalid value', () => {
  test('external invalid value preserves visible text, raises error, no onValueChange', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, {
      id: 'color',
      name: 'c',
      value: 'bad',
      onValueChange,
    });
    await tick();
    const input = getInput(container);
    expect(input.value).toBe('bad');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const hidden = q<HTMLInputElement>(container, 'input[type="hidden"][name="c"]');
    expect(hidden.value).toBe('');
    expect(onValueChange).not.toHaveBeenCalled();
    const swatch = q(container, '.cinder-color-field__swatch');
    expect(swatch.getAttribute('style') ?? '').not.toContain('bad');
    expect(swatch.getAttribute('data-cinder-empty')).toBe('');
  });

  test('clearing an external invalid value commits empty', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, {
      id: 'color',
      name: 'c',
      value: 'bad',
      onValueChange,
    });
    await tick();
    const input = getInput(container);
    await typeAndBlur(input, '');
    const hidden = q<HTMLInputElement>(container, 'input[type="hidden"][name="c"]');
    expect(input.value).toBe('');
    expect(hidden.value).toBe('');
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[0]).toBe('');
  });
});

describe('ColorField — hidden mirror + alpha re-derivation', () => {
  test('alpha toggle re-derives hidden mirror without firing onValueChange', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container, rerender } = render(ColorField, {
      id: 'color',
      name: 'c',
      alpha: false,
      onValueChange,
    });
    const input = getInput(container);
    await typeAndBlur(input, '#ff000080');
    let hidden = q<HTMLInputElement>(container, 'input[type="hidden"][name="c"]');
    expect(hidden.value).toBe('#ff0000');
    expect(onValueChange).toHaveBeenCalledTimes(1);

    await rerender({ id: 'color', name: 'c', alpha: true, onValueChange });
    await tick();
    hidden = q<HTMLInputElement>(container, 'input[type="hidden"][name="c"]');
    expect(hidden.value).toBe('#ff000080');
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });
});

describe('ColorField — controlled reconciliation', () => {
  test('parent updates are always observed; same-value re-applies are safe', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container, rerender } = render(ColorField, {
      id: 'color',
      name: 'c',
      value: '#000000',
      onValueChange,
    });
    const input = getInput(container);
    await typeAndBlur(input, '#00ff00');
    expect(onValueChange.mock.calls[0]?.[0]).toBe('#00ff00');

    // Parent rejects our commit and forces a different value.
    await rerender({ id: 'color', name: 'c', value: '#ff0000', onValueChange });
    await tick();
    expect(input.value).toBe('#ff0000');

    // Parent applies the prior committed value.
    await rerender({ id: 'color', name: 'c', value: '#00ff00', onValueChange });
    await tick();
    expect(input.value).toBe('#00ff00');

    // Parent re-applies the same value — no change in field, no error.
    await rerender({ id: 'color', name: 'c', value: '#00ff00', onValueChange });
    await tick();
    expect(input.value).toBe('#00ff00');
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
  });
});

describe('ColorField — bindable alpha state', () => {
  test('alpha toggle re-emits preserved partial alpha after a local bindable commit', async () => {
    const { container, rerender } = render(ColorField, {
      id: 'color',
      name: 'c',
      value: '#ff0000',
      alpha: false,
    });
    const input = getInput(container);
    await typeAndBlur(input, '#ff000080');

    await rerender({ id: 'color', name: 'c', value: '#ff0000', alpha: false });
    await tick();

    await rerender({ id: 'color', name: 'c', value: '#ff0000', alpha: true });
    await tick();
    const hidden = q<HTMLInputElement>(container, 'input[type="hidden"][name="c"]');
    expect(hidden.value).toBe('#ff000080');
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

  test('native change event does NOT invoke consumer onValueChange', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, { id: 'color', onValueChange });
    const input = getInput(container);
    await fireEvent.input(input, { target: { value: '#ff0000' } });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();
    expect(onValueChange).not.toHaveBeenCalled();
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
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = renderColorFieldFormFixture({
      id: 'color',
      name: 'c',
      value: '#abcdef',
      onValueChange,
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
    // Reset must not fire onValueChange — the test below asserts this didn't sneak through.
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  test('late value update reconciles into the bindable field', async () => {
    const { container, rerender } = render(ColorField, { id: 'color' });
    const input = getInput(container);
    await fireEvent.input(input, { target: { value: '#123456' } });
    await fireEvent.blur(input);
    await tick();
    expect(input.value).toBe('#123456');
    await rerender({ id: 'color', value: '#000000' });
    await tick();
    expect(input.value).toBe('#000000');
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
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, { id: 'color', onValueChange });
    const input = getInput(container);
    await typeAndBlur(input, '#abcd');
    expect(onValueChange.mock.calls[0]?.[0]).toBe('#aabbcc');
  });

  test('alpha=true preserves alpha from #abcd', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, { id: 'color', alpha: true, onValueChange });
    const input = getInput(container);
    await typeAndBlur(input, '#abcd');
    expect(onValueChange.mock.calls[0]?.[0]).toBe('#aabbccdd');
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

  test('formats=[hex] + value="rgb(0,0,0)" preserves invalid visible text', () => {
    const { container } = render(ColorField, {
      id: 'color',
      formats: ['hex'],
      value: 'rgb(0,0,0)',
    });
    const input = getInput(container);
    expect(input.value).toBe('rgb(0,0,0)');
    expect(input.getAttribute('aria-invalid')).toBe('true');
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

  test('aria-label forwards to the inner input', () => {
    const { container } = render(ColorField, {
      id: 'color',
      'aria-label': 'Accent color',
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
    const { container } = renderColorFieldFormFixture({
      id: 'color',
      name: 'c',
      value: '#ff0000',
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
  test('reset with value rejected by formats clears rather than re-applying', async () => {
    const { container } = renderColorFieldFormFixture({
      id: 'color',
      name: 'c',
      formats: ['hex'],
      value: 'rgb(0,0,0)',
    });
    const input = getInput(container);
    // Initial: value is rgb() but formats=['hex'] — preserve it visibly with invalid state.
    expect(input.value).toBe('rgb(0,0,0)');
    await typeAndBlur(input, '#abcdef');
    expect(input.value).toBe('#abcdef');
    const form = container;
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await tick();
    // After reset: value still fails formats gate; field clears.
    expect(input.value).toBe('');
  });

  // Review thread (PR #1420, PRRT_kwDOSKrFTs6b7E8M): the initial value's
  // syntax can be accepted ONLY because it matches the mount-time `format`
  // (the configured `format` is always an implicit member of the accepted
  // set). If `format` later changes, that syntax can drop back out of the
  // accepted set (when it's absent from `formats`) even though the color
  // itself was successfully parsed and committed at mount. The old
  // `resetToInitialValue` re-validated the raw `resetTarget` string against
  // the CURRENT gate on every reset, so it would clear the field instead of
  // restoring the originally-accepted color. It now snapshots the
  // successfully-parsed reset color once at mount and re-emits THAT through
  // the current `format` on reset, bypassing gate re-validation entirely.
  test('reset restores the initially-accepted color even after `format` changes it out of the accepted set', async () => {
    const oklchRed = 'oklch(62.8% 0.2577 29.23)';
    const { container, rerender } = renderColorFieldFormFixture({
      id: 'color',
      name: 'c',
      value: oklchRed,
      formats: ['hex'],
      format: 'oklch',
    });
    const input = getInput(container);
    // Accepted at mount: 'oklch' is the configured `format`, so it's
    // implicitly admitted even though `formats` only lists 'hex'.
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
    expect(input.value).toMatch(/^oklch\(/);

    // Switch `format` to 'rgb' — 'oklch' syntax now drops out of the
    // accepted set (it's neither in `formats` nor the new `format`).
    await rerender({
      id: 'color',
      name: 'c',
      value: oklchRed,
      formats: ['hex'],
      format: 'rgb',
    });
    await tick();

    // Dirty the field with something else, then reset.
    await typeAndBlur(input, '#00ff00');
    expect(input.value).toBe('rgb(0 255 0)');

    container.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await tick();

    // Must restore the originally-accepted red — re-emitted in the CURRENT
    // format ('rgb') — not clear the field.
    expect(input.value).toBe('rgb(255 0 0)');
    const hidden = q<HTMLInputElement>(container, 'input[type="hidden"][name="c"]');
    expect(hidden.value).toBe('rgb(255 0 0)');
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

  test('default error message names every accepted format', async () => {
    const { container } = render(ColorField, { id: 'color' });
    const input = getInput(container);
    await typeAndBlur(input, 'nope');
    const errorText = container.querySelector('.cinder-input-field__error')?.textContent ?? '';
    expect(errorText).toContain('hex');
    expect(errorText).toContain('rgb()');
    expect(errorText).toContain('hsl()');
    expect(errorText).toContain('hwb()');
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

// P1 regression (PR #1420 review): with format="rgb"/"hsl" the field emits
// modern space-separated syntax, but intake used to delegate to the legacy
// comma-only parseColor — so pasting the field's own emitted value back in
// failed to parse. Intake now goes through culori (parseCssColor in
// color-format.ts) for every format in `formats`. These tests emit in each
// format, paste the emitted string back into the field, and assert it
// parses and re-emits identically.
describe('ColorField — emit/intake round-trip (P1 regression)', () => {
  const CASES: Array<{ format: 'hex' | 'rgb' | 'hsl' | 'hwb' | 'oklch'; seed: string }> = [
    { format: 'hex', seed: '#3366cc' },
    { format: 'rgb', seed: '#3366cc' },
    { format: 'hsl', seed: '#3366cc' },
    { format: 'hwb', seed: '#3366cc' },
    { format: 'oklch', seed: '#3366cc' },
  ];

  for (const { format, seed } of CASES) {
    test(`format="${format}": emit → paste into a fresh field → parses and re-emits identically`, async () => {
      const onValueChange = mock<(value: string) => void>(() => {});
      const first = render(ColorField, {
        id: 'color-a',
        format,
        formats: ['hex', 'rgb', 'hsl', 'hwb', 'oklch'],
        onValueChange,
      });

      // First commit: seed a hex value, capture what the field emits in `format`.
      await typeAndBlur(getInput(first.container, 'color-a'), seed);
      expect(onValueChange).toHaveBeenCalledTimes(1);
      const emitted = onValueChange.mock.calls[0]![0];
      if (format !== 'hex') expect(emitted).not.toMatch(/^#/);
      first.unmount();

      // Paste the emitted string into a *fresh* field instance (no prior
      // committed state, so the canonical-display bypass can't shortcut the
      // parse) — it must parse (no aria-invalid) and commit right back out
      // to the exact same string.
      const onValueChangeSecond = mock<(value: string) => void>(() => {});
      const second = render(ColorField, {
        id: 'color-b',
        format,
        formats: ['hex', 'rgb', 'hsl', 'hwb', 'oklch'],
        onValueChange: onValueChangeSecond,
      });
      const secondInput = getInput(second.container, 'color-b');
      await typeAndBlur(secondInput, emitted);

      expect(secondInput.getAttribute('aria-invalid')).not.toBe('true');
      expect(onValueChangeSecond).toHaveBeenCalledTimes(1);
      expect(onValueChangeSecond.mock.calls[0]![0]).toBe(emitted);
      second.unmount();
    });
  }

  test('format="rgb": a translucent value round-trips through the alpha slash syntax', async () => {
    const seedChange = mock<(value: string) => void>(() => {});
    const seed = render(ColorField, {
      id: 'color-alpha-a',
      format: 'rgb',
      alpha: true,
      onValueChange: seedChange,
    });
    await typeAndBlur(getInput(seed.container, 'color-alpha-a'), '#3366cc80');
    const emitted = seedChange.mock.calls[0]![0];
    expect(emitted).toMatch(/\//);
    seed.unmount();

    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, {
      id: 'color-alpha-b',
      format: 'rgb',
      alpha: true,
      onValueChange,
    });
    const input = getInput(container, 'color-alpha-b');
    await typeAndBlur(input, emitted);
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]![0]).toBe(emitted);
  });

  // Review thread #1 (PR #1420): with format="oklch" and the DEFAULT
  // `formats` (which doesn't list 'oklch'), the field emitted oklch() but
  // its own intake allowlist rejected it — the accepted-input set must
  // always include the configured output `format`, unioned in.
  test('format="oklch" with default `formats`: the field always accepts its own output', async () => {
    // No `formats` prop at all — exercises the actual default (which
    // doesn't list 'oklch'), not an explicit superset.
    const seedChange = mock<(value: string) => void>(() => {});
    const seed = render(ColorField, {
      id: 'color-df-a',
      format: 'oklch',
      onValueChange: seedChange,
    });
    await typeAndBlur(getInput(seed.container, 'color-df-a'), '#3366cc');
    expect(seedChange).toHaveBeenCalledTimes(1);
    const emitted = seedChange.mock.calls[0]![0];
    expect(emitted).toMatch(/^oklch\(/);
    seed.unmount();

    // Paste that oklch() string into a *fresh* field (default `formats`,
    // no prior committed state, so the canonical-display bypass can't
    // shortcut the parse) — it must be accepted.
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, {
      id: 'color-df-b',
      format: 'oklch',
      onValueChange,
    });
    const input = getInput(container, 'color-df-b');
    await typeAndBlur(input, emitted);
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]![0]).toBe(emitted);
  });
});

// Review thread (PR #1420, PRRT_kwDOSKrFTs6b3k24): changing `format` while
// the user has an uncommitted draft in progress used to invalidate the
// alpha/config-sync effect (which reads `format` through `emitFor`), and
// that effect unconditionally overwrote `visibleText` with the reformatted
// OLD committed color — silently discarding the user's in-progress
// keystrokes, even though ColorField otherwise keeps intermediate input
// local until blur/Enter. The effect now only overwrites `visibleText` when
// it still matches the prior committed mirror (nothing dirty to lose); a
// draft in progress is preserved, and the new `format` applies naturally at
// the user's next commit.
describe('ColorField — format change preserves an in-progress draft (P1 regression)', () => {
  test('changing `format` mid-typing does not clobber the uncommitted draft text', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container, rerender } = render(ColorField, {
      id: 'color-draft',
      value: '#3366cc',
      format: 'hex',
      onValueChange,
    });
    const input = getInput(container, 'color-draft');

    // User starts typing a replacement but hasn't committed it yet.
    await fireEvent.input(input, { target: { value: '#123456' } });
    await tick();
    expect(input.value).toBe('#123456');

    // Format changes mid-draft — must NOT touch the visible draft text.
    await rerender({ id: 'color-draft', value: '#3366cc', format: 'rgb', onValueChange });
    await tick();
    expect(input.value).toBe('#123456');
    expect(onValueChange).not.toHaveBeenCalled();

    // Committing now applies the NEW format to whatever the user actually typed.
    await fireEvent.blur(input);
    await tick();
    expect(input.value).toBe('rgb(18 52 86)');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]![0]).toBe('rgb(18 52 86)');
  });

  test('changing `format` with no draft in progress DOES reformat the resting (committed) display', async () => {
    const { container, rerender } = render(ColorField, {
      id: 'color-no-draft',
      value: '#3366cc',
      format: 'hex',
    });
    const input = getInput(container, 'color-no-draft');
    expect(input.value).toBe('#3366cc');

    await rerender({ id: 'color-no-draft', value: '#3366cc', format: 'hsl' });
    await tick();
    expect(input.value).toBe('hsl(220 60% 50%)');
  });
});

// Review thread (PR #1420, PRRT_kwDOSKrFTs6b6r77): a controlled value
// initially rejected by `formats` can become implicitly accepted once
// `format` changes (recall `acceptedFormats` always unions in the
// configured `format`). The "formats runtime change" effect used to only
// clear `parseError` in that case, leaving `committedRgba`/`committedHex`
// at their prior (never-seeded) empty state — the field looked valid, but
// its swatch and hidden form mirror stayed empty until the user typed
// something and committed again. The effect now reconciles (seeds) the
// committed state via `seedFromParts` whenever the gate widens.
describe('ColorField — format switch admits a previously-rejected value (P1 regression)', () => {
  test('an oklch value rejected under formats=["hex"] + format="hex" is reconciled once format switches to "oklch"', async () => {
    const oklchRed = 'oklch(62.8% 0.2577 29.23)';
    const { container, rerender } = render(ColorField, {
      id: 'color-widen',
      name: 'widen',
      value: oklchRed,
      formats: ['hex'],
      format: 'hex',
    });
    const input = getInput(container, 'color-widen');

    // Initially rejected: 'oklch' is neither in `formats` nor the configured
    // (hex) `format`.
    expect(input.getAttribute('aria-invalid')).toBe('true');
    let hidden = q<HTMLInputElement>(container, 'input[type="hidden"][name="widen"]');
    expect(hidden.value).toBe('');
    let swatch = q(container, '.cinder-color-field__swatch');
    expect(swatch.hasAttribute('data-cinder-empty')).toBe(true);

    // Switching `format` to "oklch" widens the effective accepted-input set
    // to admit this exact value — the field must reconcile, not just clear
    // the error.
    await rerender({
      id: 'color-widen',
      name: 'widen',
      value: oklchRed,
      formats: ['hex'],
      format: 'oklch',
    });
    await tick();

    expect(input.getAttribute('aria-invalid')).not.toBe('true');
    hidden = q<HTMLInputElement>(container, 'input[type="hidden"][name="widen"]');
    expect(hidden.value).toMatch(/^oklch\(/);
    expect(input.value).toMatch(/^oklch\(/);
    swatch = q(container, '.cinder-color-field__swatch');
    expect(swatch.hasAttribute('data-cinder-empty')).toBe(false);
  });
});

// Review thread (PR #1420, PRRT_kwDOSKrFTs6b7ntq): the implicit widening
// that unions the configured `format` into the accepted-input set used to
// also grant the legacy `rgba()`/`hsla()` alias, because `passesFormatGate`
// checked "is 'rgb' anywhere in acceptedFormats?" without distinguishing
// WHY it was there. With `formats={['hex']}` and `format="rgb"`, that meant
// `rgba()` input was silently accepted too, even though the consumer's
// `formats` list deliberately excluded it (per the documented "rgba/hsla
// aliases can be restricted independently" contract). The implicit
// widening now admits only the configured format's own exact syntax —
// `explicitFormats` (the `formats` prop's own list, before the `format`
// union) is what the legacy-alias leniency checks against.
describe('ColorField — implicit format widening excludes legacy aliases (P1 regression)', () => {
  test('formats=["hex"] + format="rgb": accepts rgb() (implicit) but rejects rgba() (legacy alias, not explicitly listed)', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, {
      id: 'color-no-alias',
      formats: ['hex'],
      format: 'rgb',
      onValueChange,
    });
    const input = getInput(container, 'color-no-alias');

    // The configured format's own exact syntax IS accepted.
    await typeAndBlur(input, 'rgb(255 0 0)');
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
    expect(onValueChange).toHaveBeenCalledTimes(1);

    onValueChange.mockClear();

    // The legacy alias is NOT — it was never explicitly listed in `formats`.
    await typeAndBlur(input, 'rgba(0, 255, 0, 0.5)');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test('formats=["rgb"] + format="hex": explicitly listing "rgb" still grants the rgba() alias, unaffected by format widening', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, {
      id: 'color-explicit-alias',
      formats: ['rgb'],
      format: 'hex',
      onValueChange,
    });
    const input = getInput(container, 'color-explicit-alias');

    // 'rgb' is EXPLICITLY listed in `formats` here (not merely implied by
    // `format`), so the existing rgb->rgba leniency still applies.
    await typeAndBlur(input, 'rgba(0, 255, 0, 0.5)');
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  test('formats=["hsl"] + format="oklch": explicitly listing "hsl" still grants the hsla() alias', async () => {
    const onValueChange = mock<(value: string) => void>(() => {});
    const { container } = render(ColorField, {
      id: 'color-explicit-hsla',
      formats: ['hsl'],
      format: 'oklch',
      onValueChange,
    });
    const input = getInput(container, 'color-explicit-hsla');

    await typeAndBlur(input, 'hsla(120, 100%, 50%, 0.5)');
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });
});
