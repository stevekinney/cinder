/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');

// Unmount renders between tests; shared document.body otherwise leaks activeElement/nodes.
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const { tick } = await import('svelte');
const { default: ColorPicker } = await import('./color-picker.svelte');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function q<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Selector not found: ${selector}`);
  return element as T;
}

describe('ColorPicker structure', () => {
  test('composes CopyButton through its public component entrypoint', async () => {
    const source = await Bun.file(
      new URL('./color-picker-controls.svelte', import.meta.url),
    ).text();

    expect(source).toContain("from '@lostgradient/cinder/copy-button'");
    expect(source).not.toContain("from '../copy-button/copy-button.svelte'");
  });

  test('renders a labelled group with gradient, hue slider, and preview', () => {
    const { container } = render(ColorPicker, { value: '#ff0000' });
    expect(q(container, '[role="group"]').getAttribute('aria-label')).toBe('Color picker');
    expect(q(container, '[role="application"]')).toBeTruthy();
    const sliders = container.querySelectorAll('[role="slider"]');
    expect(sliders.length).toBe(1); // hue only when alpha=false
    expect(q(container, '.cinder-color-picker__preview')).toBeTruthy();
  });

  test('renders alpha slider when alpha=true', () => {
    const { container } = render(ColorPicker, { value: '#ff0000', alpha: true });
    const sliders = container.querySelectorAll('[role="slider"]');
    expect(sliders.length).toBe(2);
    const alphaSlider = container.querySelector('[aria-label="Alpha"]');
    expect(alphaSlider).toBeTruthy();
  });

  test('renders swatch listbox when swatches are provided', () => {
    const { container } = render(ColorPicker, {
      value: '#ff0000',
      swatches: ['#ff0000', '#00ff00', '#0000ff'],
    });
    const listbox = q(container, '[role="listbox"]');
    expect(listbox.getAttribute('aria-label')).toBe('Color swatches');
    const options = container.querySelectorAll('[role="option"]');
    expect(options.length).toBe(3);
  });

  test('selected swatch renders a check indicator without depending on focus', () => {
    const { container } = render(ColorPicker, {
      value: '#00ff00',
      swatches: ['#ff0000', '#00ff00', '#0000ff'],
    });

    const selectedOption = q(container, '[role="option"][aria-selected="true"]');
    expect(selectedOption.querySelector('svg')).toBeTruthy();
    expect(document.activeElement).not.toBe(selectedOption);
  });

  test('renders hidden input mirroring the value when name is provided', () => {
    const { container } = render(ColorPicker, { value: '#ff0000', name: 'pick' });
    const hidden = q<HTMLInputElement>(container, 'input[name="pick"]');
    expect(hidden.type).toBe('hidden');
    expect(hidden.value).toBe('#ff0000');
  });

  test('copies rounded HEX, RGB, and HSL values through CopyButton controls', async () => {
    const writeText = mock(async (_value: string) => {});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const { container } = render(ColorPicker, { value: '#ff0000' });
    const copyButtons = container.querySelectorAll<HTMLButtonElement>(
      '.cinder-color-picker__format',
    );

    expect([...copyButtons].map((button) => button.getAttribute('aria-label'))).toEqual([
      'Copy HEX format',
      'Copy RGB format',
      'Copy HSL format',
    ]);

    for (const button of copyButtons) await fireEvent.click(button);
    await tick();

    expect(writeText.mock.calls.map(([value]) => value)).toEqual([
      '#ff0000',
      'rgb(255, 0, 0)',
      'hsl(0, 100%, 50%)',
    ]);
  });

  test('preserves fractional HSL channels needed to round-trip dark colors', async () => {
    const writeText = mock(async (_value: string) => {});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const { container } = render(ColorPicker, { value: '#010101' });
    const hslButton = q<HTMLButtonElement>(
      container,
      '.cinder-color-picker__format[aria-label="Copy HSL format"]',
    );

    await fireEvent.click(hslButton);
    await tick();

    expect(writeText).toHaveBeenCalledWith('hsl(0, 0%, 0.39%)');
  });

  test('preserves enough alpha precision to round-trip 8-bit colors', async () => {
    const writeText = mock(async (_value: string) => {});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const { container } = render(ColorPicker, { value: '#00000001', alpha: true });
    const copyButtons = container.querySelectorAll<HTMLButtonElement>(
      '.cinder-color-picker__format',
    );

    await fireEvent.click(copyButtons[1]!);
    await fireEvent.click(copyButtons[2]!);
    await tick();

    // 4-decimal precision (matching formatColor's own canonicalization —
    // see the "Preserve fractional alpha in copy payloads" PR #1420 review
    // thread) round-trips this 8-bit alpha more precisely than the old
    // 3-decimal rounding did (0.004 would have rounded to a value that, at
    // 255 alpha steps, is indistinguishable from 2/255).
    expect(writeText.mock.calls.map(([value]) => value)).toEqual([
      'rgba(0, 0, 0, 0.0039)',
      'hsla(0, 0%, 0%, 0.0039)',
    ]);
  });

  test('exposes the copyable formats as a labelled group', () => {
    const { container } = render(ColorPicker, { value: '#336699' });

    expect(q(container, '[role="group"][aria-label="Copy color formats"]')).toBeTruthy();
  });
});

describe('ColorPicker parser round-trips', () => {
  test('hex round-trips', () => {
    const { container } = render(ColorPicker, { value: '#abcdef', name: 'p' });
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toBe('#abcdef');
  });

  test('rgb input emits hex', () => {
    const { container } = render(ColorPicker, { value: 'rgb(255, 0, 0)', name: 'p' });
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toBe('#ff0000');
  });

  test('hsl input emits hex', () => {
    const { container } = render(ColorPicker, {
      value: 'hsl(120, 100%, 50%)',
      name: 'p',
    });
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toBe('#00ff00');
  });

  test('short hex expands to long hex', () => {
    const { container } = render(ColorPicker, { value: '#f00', name: 'p' });
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toBe('#ff0000');
  });

  test('near-360 parsed hue stays within slider bounds', () => {
    const { container } = render(ColorPicker, { value: '#ff0001' });
    const hue = q(container, '[aria-label="Hue"]');
    const thumb = q(container, '.cinder-color-picker__hue-thumb');
    // The ANNOUNCED/visual bounds clamp to the slider's own [0, 359] range
    // (aria-valuemax="359") — but see the tests below for proof the
    // INTERNAL hue used for color math is not truncated to 359.
    expect(hue.getAttribute('aria-valuenow')).toBe('359');
    expect(thumb.getAttribute('style')).toContain('left: 100%;');
  });

  // Review thread (PR #1420, PRRT_kwDOSKrFTs6b8Ax2): `normalizeHue` used to
  // `Math.min(..., 359)` every parsed hue, silently truncating any
  // canonical hue between 359 and 360 down to exactly 359. For example,
  // ColorField emits `hsl(359.34 100% 17.84%)` for `#5b0001`; ColorPicker
  // parsing that back used to cap the hue to 359 and re-emit a DIFFERENT
  // RGB byte (91, 0, 2) instead of the original (91, 0, 1) — a cross-
  // component round-trip corruption. `normalizeHue` now only wraps into
  // [0, 360) without truncating the 359-360 interval.
  test('hue 359.5 round-trips through ColorPicker without being clamped to 359', () => {
    const { container } = render(ColorPicker, {
      value: 'hsl(359.5 100% 50%)',
      format: 'hsl',
      name: 'p',
    });
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    // Rounds to 2 decimals (color-picker.utilities.ts's own hand-rolled
    // rgb<->hsl math, not culori) — the point is it's NOT truncated to 359.
    expect(hidden.value).toMatch(/^hsl\(359\.\d+ 100% 50%\)$/);
    expect(hidden.value).not.toContain('hsl(359 ');

    const hue = q(container, '[aria-label="Hue"]');
    // The announced integer value still clamps to the slider's own max.
    expect(hue.getAttribute('aria-valuenow')).toBe('359');
  });

  test("the cited #5b0001 example: ColorField's hsl(359.34 ...) emission round-trips through ColorPicker at the same RGB byte", () => {
    const { container } = render(ColorPicker, {
      value: 'hsl(359.34 100% 17.84%)',
      format: 'rgb',
      name: 'p',
    });
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    // Must stay at the ORIGINAL byte (91, 0, 1) — not the previously-
    // corrupted (91, 0, 2) that hue-clamping to 359 produced.
    expect(hidden.value).toBe('rgb(91 0 1)');
  });
});

describe('ColorPicker alpha behavior', () => {
  test('alpha=true emits 8-char hex', () => {
    const { container } = render(ColorPicker, {
      value: 'rgba(255, 0, 0, 0.5)',
      alpha: true,
      name: 'p',
    });
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toMatch(/^#ff0000[0-9a-f]{2}$/);
  });

  test('alpha=false drops alpha on emit even when input has alpha', () => {
    const { container } = render(ColorPicker, {
      value: '#ff0000ff',
      alpha: false,
      name: 'p',
    });
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toBe('#ff0000');
  });
});

describe('ColorPicker invalid input', () => {
  test('invalid string yields empty hidden value', () => {
    const { container } = render(ColorPicker, {
      value: 'not-a-color',
      name: 'p',
    });
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toBe('');
  });

  test('controlled empty value clears visual selection state', async () => {
    const { container, rerender } = render(ColorPicker, {
      value: '#00ff00',
      name: 'p',
      swatches: ['#00ff00'],
    });
    let hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    let preview = q(container, '.cinder-color-picker__preview');
    let option = q(container, '[role="option"]');

    expect(hidden.value).toBe('#00ff00');
    expect(preview.getAttribute('aria-label')).toBe('Selected color: #00ff00');
    expect(option.getAttribute('aria-selected')).toBe('true');

    await rerender({ value: '', name: 'p', swatches: ['#00ff00'] });
    await tick();

    hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    preview = q(container, '.cinder-color-picker__preview');
    option = q(container, '[role="option"]');
    expect(hidden.value).toBe('');
    expect(preview.getAttribute('aria-label')).toBe('Selected color: none');
    expect(option.getAttribute('aria-selected')).toBe('false');
  });

  test('controlled invalid value clears visual selection state', async () => {
    const { container, rerender } = render(ColorPicker, {
      value: '#00ff00',
      name: 'p',
      swatches: ['#00ff00'],
    });
    await rerender({ value: 'not-a-color', name: 'p', swatches: ['#00ff00'] });
    await tick();

    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    const preview = q(container, '.cinder-color-picker__preview');
    const option = q(container, '[role="option"]');
    expect(hidden.value).toBe('');
    expect(preview.getAttribute('aria-label')).toBe('Selected color: none');
    expect(option.getAttribute('aria-selected')).toBe('false');
  });

  test('unparseable swatches do not break selection rendering', () => {
    const { container } = render(ColorPicker, {
      value: '#00ff00',
      swatches: ['not-a-color', '#00ff00'],
    });

    const options = container.querySelectorAll('[role="option"]');
    expect(options).toHaveLength(2);
    expect(options[0]?.getAttribute('aria-selected')).toBe('false');
    expect(options[1]?.querySelector('svg')).toBeTruthy();
  });

  test('clicking an unparseable swatch does not change value or show selected', async () => {
    let captured = '';
    const { container } = render(ColorPicker, {
      value: '#00ff00',
      swatches: ['not-a-color', '#00ff00'],
      name: 'p',
      onValueCommit: (color: string) => {
        captured = color;
      },
    });

    const options = container.querySelectorAll<HTMLElement>('[role="option"]');
    await fireEvent.click(options[0]!);

    // No callback fired, no value change, invalid swatch never becomes selected.
    expect(captured).toBe('');
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toBe('#00ff00');
    expect(options[0]!.getAttribute('aria-selected')).toBe('false');
  });
});

describe('ColorPicker swatch controlled-state invariant (regression: conditional spread bug)', () => {
  test('clearing value to "" deselects the previously-selected swatch', async () => {
    const { container, rerender } = render(ColorPicker, {
      value: '#00ff00',
      swatches: ['#ff0000', '#00ff00', '#0000ff'],
    });

    const options = container.querySelectorAll<HTMLElement>('[role="option"]');
    expect(options[1]!.getAttribute('aria-selected')).toBe('true');
    expect(options[1]!.hasAttribute('data-cinder-selected')).toBe(true);

    await rerender({ value: '', swatches: ['#ff0000', '#00ff00', '#0000ff'] });
    await tick();

    // After clearing, no swatch should be visually selected.
    const optionsAfter = container.querySelectorAll<HTMLElement>('[role="option"]');
    for (const option of optionsAfter) {
      expect(option.getAttribute('aria-selected')).toBe('false');
      expect(option.hasAttribute('data-cinder-selected')).toBe(false);
    }
  });

  test('clicking an unparseable swatch when ColorPicker has no value does not mark it selected', async () => {
    // This is the exact desync scenario: ColorPicker.internalValue === '',
    // so before the fix the conditional spread omitted `value` and ColorSwatchPicker
    // fell into uncontrolled mode — letting the click stick visually inside the child.
    let captured = '';
    const { container } = render(ColorPicker, {
      // No value or value: ColorPicker starts with internalValue === ''.
      swatches: ['not-a-color', '#00ff00'],
      name: 'p',
      onValueCommit: (color: string) => {
        captured = color;
      },
    });

    const options = container.querySelectorAll<HTMLElement>('[role="option"]');

    // Confirm: neither swatch selected to start.
    expect(options[0]!.getAttribute('aria-selected')).toBe('false');
    expect(options[1]!.getAttribute('aria-selected')).toBe('false');

    // Click the unparseable swatch.
    await fireEvent.click(options[0]!);

    // The unparseable click must not fire onValueCommit and must not leave the
    // swatch appearing selected — the child's selected state must remain a
    // pure function of ColorPicker's value (which is still empty).
    expect(captured).toBe('');
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toBe('');
    expect(options[0]!.getAttribute('aria-selected')).toBe('false');
    expect(options[0]!.hasAttribute('data-cinder-selected')).toBe(false);
  });

  test('after form reset to empty, clicking an unparseable swatch does not mark it selected', async () => {
    const form = document.createElement('form');
    document.body.appendChild(form);

    const { container } = render(ColorPicker, {
      target: form,
      props: {
        // No value: reset brings ColorPicker back to internalValue === ''.
        swatches: ['not-a-color', '#00ff00'],
        name: 'p',
      },
    });
    await tick();

    // Adjust value via hue so internalValue becomes non-empty.
    const hue = q(container, '[aria-label="Hue"]');
    await fireEvent.keyDown(hue, { key: 'ArrowRight' });
    const hiddenBefore = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hiddenBefore.value).not.toBe('');

    // Reset the form — brings ColorPicker back to internalValue === ''.
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await tick();

    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toBe('');

    // Now click the unparseable swatch — it must not stick.
    const options = container.querySelectorAll<HTMLElement>('[role="option"]');
    await fireEvent.click(options[0]!);

    expect(options[0]!.getAttribute('aria-selected')).toBe('false');
    expect(options[0]!.hasAttribute('data-cinder-selected')).toBe(false);

    document.body.removeChild(form);
  });
});

describe('ColorPicker swatch alpha stripping', () => {
  test('alpha=false: alpha-bearing swatch emits plain #rrggbb (alpha stripped)', async () => {
    let captured = '';
    const { container } = render(ColorPicker, {
      value: '#ffffff',
      alpha: false,
      swatches: ['#ff000080'],
      name: 'p',
      onValueCommit: (color: string) => {
        captured = color;
      },
    });

    const options = container.querySelectorAll<HTMLElement>('[role="option"]');
    await fireEvent.click(options[0]!);

    // Alpha-disabled picker must strip the alpha channel from the emitted value.
    expect(captured).toBe('#ff0000');
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toBe('#ff0000');
    // 6-char hex only, no alpha suffix.
    expect(captured).toMatch(/^#[0-9a-f]{6}$/);
  });

  test('alpha=true: alpha-bearing swatch emits 8-char #rrggbbaa', async () => {
    let captured = '';
    const { container } = render(ColorPicker, {
      value: '#ffffff',
      alpha: true,
      swatches: ['#ff000080'],
      name: 'p',
      onValueCommit: (color: string) => {
        captured = color;
      },
    });

    const options = container.querySelectorAll<HTMLElement>('[role="option"]');
    await fireEvent.click(options[0]!);

    // Alpha-enabled picker must preserve the alpha channel in the emitted value.
    expect(captured).toMatch(/^#ff0000[0-9a-f]{2}$/);
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toBe(captured);
  });
});

describe('ColorPicker hue slider keyboard', () => {
  test('ArrowRight increments hue', async () => {
    let captured = '';
    const { container } = render(ColorPicker, {
      value: '#ff0000',
      onValueCommit: (color: string) => {
        captured = color;
      },
    });
    const hue = q(container, '[aria-label="Hue"]');
    expect(hue.getAttribute('aria-valuenow')).toBe('0');
    await fireEvent.keyDown(hue, { key: 'ArrowRight' });
    expect(hue.getAttribute('aria-valuenow')).toBe('1');
    expect(captured).not.toBe('#ff0000');
  });

  test('ArrowLeft decrements hue (wraps)', async () => {
    const { container } = render(ColorPicker, { value: '#ff0000' });
    const hue = q(container, '[aria-label="Hue"]');
    await fireEvent.keyDown(hue, { key: 'ArrowLeft' });
    expect(hue.getAttribute('aria-valuenow')).toBe('359');
  });

  test('Home/End move hue to 0/359', async () => {
    const { container } = render(ColorPicker, { value: 'hsl(180, 100%, 50%)' });
    const hue = q(container, '[aria-label="Hue"]');
    await fireEvent.keyDown(hue, { key: 'Home' });
    expect(hue.getAttribute('aria-valuenow')).toBe('0');
    await fireEvent.keyDown(hue, { key: 'End' });
    expect(hue.getAttribute('aria-valuenow')).toBe('359');
  });

  test('Shift+Arrow takes 10-degree steps', async () => {
    const { container } = render(ColorPicker, { value: '#ff0000' });
    const hue = q(container, '[aria-label="Hue"]');
    await fireEvent.keyDown(hue, { key: 'ArrowRight', shiftKey: true });
    expect(hue.getAttribute('aria-valuenow')).toBe('10');
  });
});

describe('ColorPicker alpha slider keyboard', () => {
  test('ArrowRight increases alpha', async () => {
    const { container } = render(ColorPicker, {
      value: '#ff000080',
      alpha: true,
    });
    const alphaSlider = q(container, '[aria-label="Alpha"]');
    const initial = Number(alphaSlider.getAttribute('aria-valuenow'));
    await fireEvent.keyDown(alphaSlider, { key: 'ArrowRight' });
    const next = Number(alphaSlider.getAttribute('aria-valuenow'));
    expect(next).toBeGreaterThan(initial);
  });

  test('Home/End set alpha to 0/100', async () => {
    const { container } = render(ColorPicker, {
      value: '#ff000080',
      alpha: true,
    });
    const alphaSlider = q(container, '[aria-label="Alpha"]');
    await fireEvent.keyDown(alphaSlider, { key: 'Home' });
    expect(alphaSlider.getAttribute('aria-valuenow')).toBe('0');
    await fireEvent.keyDown(alphaSlider, { key: 'End' });
    expect(alphaSlider.getAttribute('aria-valuenow')).toBe('100');
  });
});

describe('ColorPicker gradient keyboard', () => {
  // Baseline for every test below: value=#ff0000 → hue=0, saturation=100, lightness=50.
  // Hand-computed against the component's own hslToRgb/formatHex and confirmed by
  // running the assertions; pinned literally so a wrong step size or clamp bound fails.

  test('ArrowUp increases lightness by exactly 1', async () => {
    let captured = '';
    const { container } = render(ColorPicker, {
      value: '#ff0000',
      onValueCommit: (color: string) => {
        captured = color;
      },
    });
    const gradient = q(container, '.cinder-color-picker__gradient');
    const notPrevented = await fireEvent.keyDown(gradient, { key: 'ArrowUp' });
    expect(captured).toBe('#ff0505');
    expect(notPrevented).toBe(false);
  });

  test('ArrowDown decreases lightness by exactly 1', async () => {
    let captured = '';
    const { container } = render(ColorPicker, {
      value: '#ff0000',
      onValueCommit: (color: string) => {
        captured = color;
      },
    });
    const gradient = q(container, '.cinder-color-picker__gradient');
    const notPrevented = await fireEvent.keyDown(gradient, { key: 'ArrowDown' });
    expect(captured).toBe('#fa0000');
    expect(notPrevented).toBe(false);
  });

  test('ArrowLeft decreases saturation by exactly 1, then ArrowRight increases it back', async () => {
    let captured = '';
    const { container } = render(ColorPicker, {
      value: '#ff0000',
      onValueCommit: (color: string) => {
        captured = color;
      },
    });
    const gradient = q(container, '.cinder-color-picker__gradient');

    const notPrevented = await fireEvent.keyDown(gradient, { key: 'ArrowLeft' });
    expect(captured).toBe('#fe0101');
    expect(notPrevented).toBe(false);

    // Fired again from the 99 step (not the 100 boundary) so a wrong step size or a
    // wrong clamp bound would still show up as the wrong hex, not a false-positive no-op.
    await fireEvent.keyDown(gradient, { key: 'ArrowRight' });
    expect(captured).toBe('#ff0000');
  });

  test('Shift+Arrow keys move saturation and lightness by exactly 10 instead of 1', async () => {
    let captured = '';
    const { container } = render(ColorPicker, {
      value: '#ff0000',
      onValueCommit: (color: string) => {
        captured = color;
      },
    });
    const gradient = q(container, '.cinder-color-picker__gradient');

    await fireEvent.keyDown(gradient, { key: 'ArrowDown', shiftKey: true });
    expect(captured).toBe('#cc0000');
    await fireEvent.keyDown(gradient, { key: 'ArrowUp', shiftKey: true });
    expect(captured).toBe('#ff0000');
    await fireEvent.keyDown(gradient, { key: 'ArrowLeft', shiftKey: true });
    expect(captured).toBe('#f20d0d');
    await fireEvent.keyDown(gradient, { key: 'ArrowRight', shiftKey: true });
    expect(captured).toBe('#ff0000');
  });

  test('disabled suppresses gradient keyboard adjustments entirely', async () => {
    let captured = '';
    const { container } = render(ColorPicker, {
      value: '#ff0000',
      disabled: true,
      onValueCommit: (color: string) => {
        captured = color;
      },
    });
    const gradient = q(container, '.cinder-color-picker__gradient');
    const notPrevented = await fireEvent.keyDown(gradient, { key: 'ArrowRight' });
    expect(captured).toBe('');
    expect(notPrevented).toBe(true);
  });
});

describe('ColorPicker swatch keyboard nav', () => {
  test('clicking a swatch updates the value', async () => {
    let captured = '';
    const { container } = render(ColorPicker, {
      value: '#ffffff',
      swatches: ['#ff0000', '#00ff00', '#0000ff'],
      name: 'p',
      onValueCommit: (color: string) => {
        captured = color;
      },
    });
    const options = container.querySelectorAll<HTMLElement>('[role="option"]');
    await fireEvent.click(options[1]!);
    expect(captured).toBe('#00ff00');
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toBe('#00ff00');
  });

  test('Enter on a focused swatch selects it', async () => {
    let captured = '';
    const { container } = render(ColorPicker, {
      value: '#ffffff',
      swatches: ['#ff0000', '#00ff00', '#0000ff'],
      onValueCommit: (color: string) => {
        captured = color;
      },
    });
    // ColorSwatchPicker's keyboard handler lives on the listbox ul and uses
    // roving-tabindex focus tracking. Navigate to the third swatch with
    // ArrowRight twice, then confirm selection with Enter.
    const listbox = q(container, '[role="listbox"]');
    await fireEvent.keyDown(listbox, { key: 'ArrowRight' });
    await fireEvent.keyDown(listbox, { key: 'ArrowRight' });
    await fireEvent.keyDown(listbox, { key: 'Enter' });
    expect(captured).toBe('#0000ff');
  });

  test('selected swatch is reflected with aria-selected', async () => {
    const { container } = render(ColorPicker, {
      value: '#00ff00',
      swatches: ['#ff0000', '#00ff00', '#0000ff'],
    });
    const options = container.querySelectorAll<HTMLElement>('[role="option"]');
    expect(options[1]!.getAttribute('aria-selected')).toBe('true');
    expect(options[0]!.getAttribute('aria-selected')).toBe('false');
  });
});

describe('ColorPicker form reset', () => {
  test('form reset reverts to value', async () => {
    const form = document.createElement('form');
    document.body.appendChild(form);

    // Render directly into the form so the hidden input mounts inside it
    // from the start and the $effect attaches its reset listener at mount.
    const { container } = render(ColorPicker, {
      target: form,
      props: {
        value: '#ff0000',
        name: 'p',
      },
    });
    await tick();

    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toBe('#ff0000');

    // Mutate via hue slider
    const hue = q(container, '[aria-label="Hue"]');
    await fireEvent.keyDown(hue, { key: 'ArrowRight', shiftKey: true });
    expect(hidden.value).not.toBe('#ff0000');

    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await tick();
    expect(hidden.value).toBe('#ff0000');

    document.body.removeChild(form);
  });

  test('form reset with invalid value resets to empty without callbacks', async () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    const inputs: string[] = [];
    const changes: string[] = [];

    const { container } = render(ColorPicker, {
      target: form,
      props: {
        value: 'not-a-color',
        name: 'p',
        onValueChange: (color: string) => inputs.push(color),
        onValueCommit: (color: string) => changes.push(color),
      },
    });
    await tick();

    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    const hue = q(container, '[aria-label="Hue"]');
    expect(hidden.value).toBe('');

    await fireEvent.keyDown(hue, { key: 'ArrowRight' });
    expect(hidden.value).not.toBe('');
    inputs.length = 0;
    changes.length = 0;

    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await tick();

    expect(hidden.value).toBe('');
    expect(inputs).toEqual([]);
    expect(changes).toEqual([]);

    document.body.removeChild(form);
  });
});

describe('ColorPicker callback contract', () => {
  test('slider keypress fires both onValueChange and onValueCommit', async () => {
    const inputs: string[] = [];
    const changes: string[] = [];
    const { container } = render(ColorPicker, {
      value: '#ff0000',
      onValueChange: (color: string) => inputs.push(color),
      onValueCommit: (color: string) => changes.push(color),
    });
    const hue = q(container, '[aria-label="Hue"]');
    await fireEvent.keyDown(hue, { key: 'ArrowRight' });
    expect(inputs.length).toBe(1);
    expect(changes.length).toBe(1);
    expect(inputs[0]).toBe(changes[0]);
  });

  test('swatch selection fires both onValueChange and onValueCommit', async () => {
    const inputs: string[] = [];
    const changes: string[] = [];
    const { container } = render(ColorPicker, {
      value: '#ffffff',
      swatches: ['#ff0000', '#00ff00'],
      onValueChange: (color: string) => inputs.push(color),
      onValueCommit: (color: string) => changes.push(color),
    });
    const option = container.querySelector<HTMLElement>('[role="option"]');
    await fireEvent.click(option!);
    expect(inputs).toEqual(['#ff0000']);
    expect(changes).toEqual(['#ff0000']);
  });
});

describe('ColorPicker pointer interaction', () => {
  test('pointer drag on hue slider updates hue and fires onValueChange then onValueCommit', async () => {
    const inputs: string[] = [];
    const changes: string[] = [];
    const { container } = render(ColorPicker, {
      value: '#ff0000',
      onValueChange: (color: string) => inputs.push(color),
      onValueCommit: (color: string) => changes.push(color),
    });
    const hue = q(container, '[aria-label="Hue"]');
    // happy-dom doesn't implement these; stub so the production setPointerCapture
    // and releasePointerCapture calls don't throw and so getBoundingClientRect
    // returns non-zero width for the mapping math.
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    (hue as unknown as { setPointerCapture: (id: number) => void }).setPointerCapture = () => {};
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    (hue as unknown as { releasePointerCapture: (id: number) => void }).releasePointerCapture =
      () => {};
    hue.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 100,
        height: 12,
        right: 100,
        bottom: 12,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    await fireEvent.pointerDown(hue, { clientX: 50, clientY: 6, pointerId: 1 });
    expect(inputs.length).toBe(1);
    expect(changes.length).toBe(0);
    await fireEvent.pointerUp(hue, { clientX: 50, clientY: 6, pointerId: 1 });
    expect(inputs.length).toBe(1);
    expect(changes.length).toBe(1);
    // Halfway across the 0-359 hue track ≈ 180 (cyan).
    expect(hue.getAttribute('aria-valuenow')).toBe('180');
  });

  test('pointer cancel does not fire onValueCommit', async () => {
    const inputs: string[] = [];
    const changes: string[] = [];
    const { container } = render(ColorPicker, {
      value: '#ff0000',
      onValueChange: (color: string) => inputs.push(color),
      onValueCommit: (color: string) => changes.push(color),
    });
    const hue = q(container, '[aria-label="Hue"]');
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    (hue as unknown as { setPointerCapture: (id: number) => void }).setPointerCapture = () => {};
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    (hue as unknown as { releasePointerCapture: (id: number) => void }).releasePointerCapture =
      () => {};
    hue.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 100,
        height: 12,
        right: 100,
        bottom: 12,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    await fireEvent.pointerDown(hue, { clientX: 50, clientY: 6, pointerId: 1 });
    await fireEvent.pointerCancel(hue, { clientX: 50, clientY: 6, pointerId: 1 });

    expect(inputs.length).toBe(1);
    expect(changes).toEqual([]);
  });
});

describe('ColorPicker alpha mode toggle', () => {
  // Per the CIN-104 alpha policy, hex only ever carries an alpha suffix when
  // the color's actual alpha is < 1 — toggling the `alpha` *UI affordance* on
  // does not itself invent an alpha suffix for an already-opaque value.
  test('toggling alpha=false → alpha=true keeps a fully-opaque value as plain #rrggbb', async () => {
    const { container, rerender } = render(ColorPicker, {
      value: '#ff0000',
      alpha: false,
      name: 'p',
    });
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toBe('#ff0000');

    await rerender({ value: '#ff0000', alpha: true, name: 'p' });
    await tick();
    expect(hidden.value).toBe('#ff0000');
  });

  test('toggling alpha=false → alpha=true re-emits 8-char hex for a translucent value', async () => {
    const { container, rerender } = render(ColorPicker, {
      value: '#ff000080',
      alpha: true,
      name: 'p',
    });
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toMatch(/^#ff0000[0-9a-f]{2}$/);

    await rerender({ value: '#ff000080', alpha: false, name: 'p' });
    await tick();
    // Per the CIN-104 ruling, `alpha` is UI-affordance-only: it does not
    // retroactively override a programmatically-passed value's own alpha.
    // Disabling the slider alone leaves an already-translucent `value`
    // translucent — see "interactive re-gate" below for the distinct case
    // where an *interactive* alpha gets healed back to opaque.
    expect(hidden.value).toMatch(/^#ff0000[0-9a-f]{2}$/);
  });

  test('a stored interactive alpha re-gates to opaque on the next user-driven emission, not merely on toggle', async () => {
    let committed = '';
    const { container, rerender } = render(ColorPicker, {
      value: '#ff0000',
      alpha: true,
      onValueCommit: (color: string) => {
        committed = color;
      },
    });

    // Drag the alpha slider to make the value interactively translucent.
    const alphaSlider = q<HTMLElement>(container, '[role="slider"][aria-label="Alpha"]');
    await fireEvent.keyDown(alphaSlider, { key: 'ArrowLeft', shiftKey: true }); // -0.1
    expect(committed).toMatch(/^#ff0000[0-9a-f]{2}$/);
    const hidden = q<HTMLInputElement>(container, 'input');
    expect(hidden.value).toMatch(/^#ff0000[0-9a-f]{2}$/);
    const afterDrag = hidden.value;

    // Disabling the affordance alone must NOT retroactively strip it. A real
    // `bind:value` consumer's own variable already reflects the drag, so its
    // next render passes that same drifted value straight through — this
    // rerender models that, not a fresh app-authored value.
    await rerender({ value: afterDrag, alpha: false });
    await tick();
    expect(hidden.value).toBe(afterDrag);

    // The *next user-driven emission* (any interactive gesture, e.g. a hue
    // nudge) re-gates the stale interactive alpha back to fully opaque —
    // the emitted hex drops the alpha byte, regardless of the small hue
    // shift the nudge itself introduces.
    const hueSlider = q<HTMLElement>(container, '[role="slider"][aria-label="Hue"]');
    await fireEvent.keyDown(hueSlider, { key: 'ArrowRight' });
    expect(hidden.value).toMatch(/^#[0-9a-f]{6}$/);
    expect(committed).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('ColorPicker swatch normalization', () => {
  test('aria-selected matches regardless of swatch input format', () => {
    const { container } = render(ColorPicker, {
      value: '#00ff00',
      swatches: ['#f00', '#0f0', '#00f'],
    });
    const options = container.querySelectorAll<HTMLElement>('[role="option"]');
    expect(options[1]!.getAttribute('aria-selected')).toBe('true');
    expect(options[0]!.getAttribute('aria-selected')).toBe('false');
  });

  // Review thread (PR #1420, PRRT_kwDOSKrFTs6b5hja): with alpha=false, a
  // programmatically-retained translucent `value` (per the CIN-104
  // alpha-retention ruling) used to be matched against swatches using a
  // GATED (forced-opaque) hex, while the value itself stayed translucent —
  // so an identical translucent swatch entry never showed as selected.
  // Matching now uses the swatch's alpha verbatim, consistent with the
  // retained (non-gated) current value.
  test('alpha=false: a retained translucent value matches an identical translucent swatch entry', () => {
    const { container } = render(ColorPicker, {
      value: '#ff000080',
      alpha: false,
      swatches: ['#ff000080', '#00ff00'],
    });
    const options = container.querySelectorAll<HTMLElement>('[role="option"]');
    expect(options[0]!.getAttribute('aria-selected')).toBe('true');
    expect(options[0]!.hasAttribute('data-cinder-selected')).toBe(true);
    expect(options[1]!.getAttribute('aria-selected')).toBe('false');
  });

  test('alpha=false: a retained translucent value does NOT match an opaque swatch of the same hue', () => {
    const { container } = render(ColorPicker, {
      value: '#ff000080',
      alpha: false,
      swatches: ['#ff0000', '#00ff00'],
    });
    const options = container.querySelectorAll<HTMLElement>('[role="option"]');
    expect(options[0]!.getAttribute('aria-selected')).toBe('false');
    expect(options[1]!.getAttribute('aria-selected')).toBe('false');
  });

  // Review thread (PR #1420, PRRT_kwDOSKrFTs6b6r7-): with alpha={false},
  // clicking a translucent swatch commits it as opaque (handleSwatchChange
  // correctly gates alpha to 1 since alpha is disabled) — but normalizeSwatch
  // used to match that SAME swatch verbatim (still translucent), so
  // immediately after commit the swatch the user just picked showed
  // aria-selected="false". Swatch matching now gates to match whichever
  // alpha policy actually produced the current value: once alphaValue
  // itself is opaque (the state any interactive commit leaves it in when
  // alpha is disabled), a translucent swatch's own alpha is gated to match.
  test('alpha=false: clicking a translucent swatch commits opaque AND keeps that same swatch selected', async () => {
    let committed = '';
    const { container } = render(ColorPicker, {
      value: '#00ff00',
      alpha: false,
      swatches: ['#ff000080', '#00ff00'],
      onValueCommit: (color: string) => {
        committed = color;
      },
    });

    const options = container.querySelectorAll<HTMLElement>('[role="option"]');
    await fireEvent.click(options[0]!);

    // Committed as opaque (alpha disabled).
    expect(committed).toBe('#ff0000');

    // The clicked swatch — even though its OWN listed color is translucent
    // — must still show as selected: it's literally the swatch the user
    // just chose, and the committed value is its gated (opaque) projection.
    const optionsAfter = container.querySelectorAll<HTMLElement>('[role="option"]');
    expect(optionsAfter[0]!.getAttribute('aria-selected')).toBe('true');
    expect(optionsAfter[0]!.hasAttribute('data-cinder-selected')).toBe(true);
    expect(optionsAfter[1]!.getAttribute('aria-selected')).toBe('false');
  });
});

describe('ColorPicker disabled', () => {
  test('disabled=true sets data-cinder-disabled and aria-disabled on subcontrols', () => {
    const { container } = render(ColorPicker, {
      value: '#ff0000',
      disabled: true,
    });
    const root = q(container, '.cinder-color-picker');
    expect(root.hasAttribute('data-cinder-disabled')).toBe(true);
    const hue = q(container, '[aria-label="Hue"]');
    expect(hue.getAttribute('aria-disabled')).toBe('true');
    expect(hue.getAttribute('tabindex')).toBe('-1');
  });

  test('disabled blocks hue keyboard updates', async () => {
    const { container } = render(ColorPicker, {
      value: '#ff0000',
      disabled: true,
    });
    const hue = q(container, '[aria-label="Hue"]');
    const before = hue.getAttribute('aria-valuenow');
    await fireEvent.keyDown(hue, { key: 'ArrowRight' });
    expect(hue.getAttribute('aria-valuenow')).toBe(before);
  });
});

describe('ColorPicker layout: alpha-enabled state', () => {
  test('renders all controls when alpha=true: gradient, hue, alpha, footer, no swatches', () => {
    const { container } = render(ColorPicker, { value: '#ff000080', alpha: true });
    expect(q(container, '[role="application"]')).toBeTruthy();
    expect(q(container, '.cinder-color-picker__hue')).toBeTruthy();
    expect(q(container, '[aria-label="Alpha"]')).toBeTruthy();
    expect(q(container, '.cinder-color-picker__footer')).toBeTruthy();
    expect(q(container, '.cinder-color-picker__preview')).toBeTruthy();
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });

  test('footer hex value shows the 8-char hex when alpha=true', () => {
    const { container } = render(ColorPicker, {
      value: '#ff000080',
      alpha: true,
      name: 'p',
    });
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    const hexText = q(container, '.cinder-color-picker__hex-value');
    expect(hexText.textContent?.trim()).toBe(hidden.value);
    expect(hidden.value).toMatch(/^#ff0000[0-9a-f]{2}$/);
  });

  test('alpha-enabled swatches render and are selectable', async () => {
    let captured = '';
    const { container } = render(ColorPicker, {
      value: '#ffffff',
      alpha: true,
      swatches: ['#ff000080', '#00ff0080'],
      onValueCommit: (color: string) => {
        captured = color;
      },
    });
    const options = container.querySelectorAll<HTMLElement>('[role="option"]');
    expect(options.length).toBe(2);
    await fireEvent.click(options[0]!);
    expect(captured).toMatch(/^#ff0000[0-9a-f]{2}$/);
  });
});

describe('ColorPicker layout: no-swatches state', () => {
  test('renders without a listbox when no swatches are provided', () => {
    const { container } = render(ColorPicker, { value: '#3b82f6' });
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    // Controls still present
    expect(q(container, '[role="application"]')).toBeTruthy();
    expect(q(container, '.cinder-color-picker__hue')).toBeTruthy();
    expect(q(container, '.cinder-color-picker__footer')).toBeTruthy();
  });

  test('footer shows hex value without swatches', () => {
    const { container } = render(ColorPicker, { value: '#3b82f6', name: 'p' });
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    const hexText = q(container, '.cinder-color-picker__hex-value');
    expect(hexText.textContent?.trim()).toBe(hidden.value);
  });

  test('footer shows dash placeholder when no color is set', () => {
    const { container } = render(ColorPicker, {});
    const hexText = q(container, '.cinder-color-picker__hex-value');
    expect(hexText.textContent?.trim()).toBe('—');
  });
});

describe('ColorPicker composition: ColorSwatchPicker integration', () => {
  test('swatch selection via ColorSwatchPicker updates the hidden input', async () => {
    const { container } = render(ColorPicker, {
      value: '#ffffff',
      swatches: ['#ef4444', '#22c55e', '#3b82f6'],
      name: 'p',
    });
    const options = container.querySelectorAll<HTMLElement>('[role="option"]');
    await fireEvent.click(options[1]!);
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toBe('#22c55e');
  });

  test('swatch selection via ColorSwatchPicker fires onValueCommit', async () => {
    let captured = '';
    const { container } = render(ColorPicker, {
      value: '#ffffff',
      swatches: ['#ef4444', '#22c55e', '#3b82f6'],
      onValueCommit: (color: string) => {
        captured = color;
      },
    });
    const options = container.querySelectorAll<HTMLElement>('[role="option"]');
    await fireEvent.click(options[2]!);
    expect(captured).toBe('#3b82f6');
  });

  test('ColorSwatchPicker reflects selected state from gradient/slider pick', async () => {
    const { container } = render(ColorPicker, {
      value: '#ef4444',
      swatches: ['#ef4444', '#22c55e'],
    });
    // The swatch matching the current color should be selected.
    const options = container.querySelectorAll<HTMLElement>('[role="option"]');
    expect(options[0]!.getAttribute('aria-selected')).toBe('true');
    expect(options[1]!.getAttribute('aria-selected')).toBe('false');
  });

  test('swatch keyboard navigation: ArrowRight then Enter selects a swatch', async () => {
    let captured = '';
    const { container } = render(ColorPicker, {
      value: '#ffffff',
      swatches: ['#ef4444', '#22c55e', '#3b82f6'],
      onValueCommit: (color: string) => {
        captured = color;
      },
    });
    const listbox = q(container, '[role="listbox"]');
    await fireEvent.keyDown(listbox, { key: 'ArrowRight' });
    await fireEvent.keyDown(listbox, { key: 'Enter' });
    expect(captured).toBe('#22c55e');
  });
});

describe('ColorPicker format (output)', () => {
  test('default format is hex, so existing consumers are unaffected', async () => {
    const { container } = render(ColorPicker, { value: '#ff0000', name: 'p' });
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toBe('#ff0000');
  });

  test('format="rgb" emits modern rgb() syntax', async () => {
    const { container } = render(ColorPicker, { value: '#ff0000', format: 'rgb', name: 'p' });
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toBe('rgb(255 0 0)');
  });

  test('format="hsl" emits modern hsl() syntax', async () => {
    const { container } = render(ColorPicker, { value: '#0000ff', format: 'hsl', name: 'p' });
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toBe('hsl(240 100% 50%)');
  });

  test('format="hwb" emits modern hwb() syntax', async () => {
    const { container } = render(ColorPicker, { value: '#00ff00', format: 'hwb', name: 'p' });
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toBe('hwb(120 0% 0%)');
  });

  test('format="oklch" emits modern oklch() syntax', async () => {
    const { container } = render(ColorPicker, { value: '#ffffff', format: 'oklch', name: 'p' });
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toMatch(/^oklch\(/);
  });

  test('non-hex format with alpha uses slash alpha syntax when alpha < 1', async () => {
    const { container } = render(ColorPicker, {
      value: '#ff000080',
      alpha: true,
      format: 'rgb',
      name: 'p',
    });
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toMatch(/^rgb\(255 0 0 \/ 0\.50\d*\)$/);
  });

  test('onValueCommit fires the configured format on a keyboard commit', async () => {
    let committed = '';
    const { container } = render(ColorPicker, {
      value: '#ff0000',
      format: 'hsl',
      onValueCommit: (color: string) => {
        committed = color;
      },
    });
    const hueSlider = q<HTMLElement>(container, '[role="slider"][aria-label="Hue"]');
    await fireEvent.keyDown(hueSlider, { key: 'ArrowRight' });
    expect(committed).toMatch(/^hsl\(/);
  });
});

// P1 regression (PR #1420 review): emitValue's rgb/hsl/oklch output couldn't
// be re-parsed by parseToHsla, which delegated to the legacy comma-only
// parseColor with no notion of oklch() at all. parseToHsla now goes through
// culori (parseCssColor in color-format.ts). These tests persist an emitted
// value in each format, remount the picker with that value, and assert the
// internal HSLA state reconstructs correctly — surfaced via the hidden
// input re-emitting the identical string and the hue slider reporting the
// matching angle.
describe('ColorPicker emit/remount round-trip (P1 regression)', () => {
  const CASES: Array<{ format: 'hex' | 'rgb' | 'hsl' | 'hwb' | 'oklch' }> = [
    { format: 'hex' },
    { format: 'rgb' },
    { format: 'hsl' },
    { format: 'hwb' },
    { format: 'oklch' },
  ];

  for (const { format } of CASES) {
    test(`format="${format}": emitted value survives an unmount/remount round-trip`, () => {
      const seed = render(ColorPicker, { value: '#3366cc', format, name: 'seed' });
      const seedHidden = q<HTMLInputElement>(seed.container, 'input[name="seed"]');
      const emitted = seedHidden.value;
      if (format !== 'hex') expect(emitted).not.toMatch(/^#/);
      const seedHue = q(seed.container, '[aria-label="Hue"]').getAttribute('aria-valuenow');
      seed.unmount();

      const second = render(ColorPicker, { value: emitted, format, name: 'again' });
      const secondHidden = q<HTMLInputElement>(second.container, 'input[name="again"]');
      const secondHue = q(second.container, '[aria-label="Hue"]').getAttribute('aria-valuenow');

      expect(secondHidden.value).toBe(emitted);
      expect(secondHue).toBe(seedHue);
      second.unmount();
    });
  }
});

// Review thread #3 (PR #1420): the "Copy HEX format" action used to copy
// whatever `internalValue` held, which is format-dependent — with a non-hex
// `format` it copied (and displayed) e.g. an oklch() string under a "HEX"
// label. It's now backed by a dedicated always-hex `hexValue`.
describe('ColorPicker "Copy HEX format" stays genuinely hex (P1 regression)', () => {
  test('format="oklch": the HEX copy action and its displayed text are hex, not oklch', () => {
    const { container } = render(ColorPicker, { value: '#3366cc', format: 'oklch' });
    const hexButton = q<HTMLButtonElement>(container, '[aria-label="Copy HEX format"]');
    expect(hexButton.textContent).toContain('#3366cc');
    expect(hexButton.textContent).not.toContain('oklch');

    const hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden.value).toMatch(/^oklch\(/);
  });

  test('the RGB and HSL copy actions remain genuinely rgb/hsl regardless of `format`', () => {
    const { container } = render(ColorPicker, { value: '#3366cc', format: 'hwb' });
    const rgbButton = q<HTMLButtonElement>(container, '[aria-label="Copy RGB format"]');
    const hslButton = q<HTMLButtonElement>(container, '[aria-label="Copy HSL format"]');
    expect(rgbButton.textContent).toMatch(/^RGB rgb\(/);
    expect(hslButton.textContent).toMatch(/^HSL hsl\(/);
  });
});

// Review thread #4 (PR #1420): converting swatch values to a non-hex,
// modern-syntax `format` broke ColorSwatchPicker's legacy
// pickContrastColor()/hasAlpha() parsing (comma-syntax hex/rgb/hsl/hwb
// only — no oklch, no modern syntax). Swatch plumbing (background color,
// contrast-indicator color, alpha detection) is now pinned to hex
// regardless of `format` — only the publicly emitted value follows
// `format`. This is the smaller-blast-radius fix: it keeps
// color-swatch-picker.svelte and its shared color-luminance.ts helpers
// (used by other consumers too) completely untouched.
describe('ColorPicker swatch plumbing stays hex regardless of `format` (P1 regression)', () => {
  test('format="oklch": the selected swatch still gets correct contrast-indicator color', () => {
    const { container } = render(ColorPicker, {
      value: '#ffffff',
      format: 'oklch',
      swatches: ['#000000', '#ffffff'],
    });
    const selectedOption = q<HTMLElement>(container, '[role="option"][aria-selected="true"]');
    const indicator = selectedOption.querySelector<HTMLElement>(
      '.cinder-color-swatch-picker__indicator',
    );
    expect(indicator).not.toBeNull();
    // White needs BLACK contrast text. If oklch swatch plumbing broke the
    // legacy parser, pickContrastColor's null-parse fallback always
    // returns 'white' — indistinguishable from the actual white swatch.
    expect(indicator!.getAttribute('style')).toContain('color: black');
  });

  test('format="oklch": alpha-bearing swatches are still detected as translucent', () => {
    const { container } = render(ColorPicker, {
      value: '#ff000080',
      alpha: true,
      format: 'oklch',
      swatches: ['#ff000080', '#00ff00'],
    });
    const options = container.querySelectorAll<HTMLElement>('[role="option"]');
    expect(options[0]!.hasAttribute('data-cinder-alpha')).toBe(true);
    expect(options[1]!.hasAttribute('data-cinder-alpha')).toBe(false);
  });
});

// Review thread #6 (PR #1420): a translucent value retained while
// alpha=false (per the CIN-104 alpha-retention ruling) used to still show
// an opaque preview and drop alpha from the RGB/HSL copy strings — because
// those three derived values gated on the `alpha` *prop* instead of the
// actual `alphaValue`. They now key off `alphaValue < 1`.
describe('ColorPicker retained translucent value renders/copies consistently (P1 regression)', () => {
  test('alpha=false with a programmatically-retained translucent value: preview and RGB/HSL copy show alpha', () => {
    const { container } = render(ColorPicker, { value: '#ff000080', alpha: false });

    const preview = q<HTMLElement>(container, '.cinder-color-picker__preview');
    expect(preview.getAttribute('style')).toContain('hsla(');

    const rgbButton = q<HTMLButtonElement>(container, '[aria-label="Copy RGB format"]');
    const hslButton = q<HTMLButtonElement>(container, '[aria-label="Copy HSL format"]');
    expect(rgbButton.textContent).toMatch(/^RGB rgba\(/);
    expect(hslButton.textContent).toMatch(/^HSL hsla\(/);
  });

  test('alpha=false with a genuinely opaque value: preview and RGB/HSL copy stay opaque', () => {
    const { container } = render(ColorPicker, { value: '#ff0000', alpha: false });

    const preview = q<HTMLElement>(container, '.cinder-color-picker__preview');
    expect(preview.getAttribute('style')).toContain('hsl(');
    expect(preview.getAttribute('style')).not.toContain('hsla(');

    const rgbButton = q<HTMLButtonElement>(container, '[aria-label="Copy RGB format"]');
    const hslButton = q<HTMLButtonElement>(container, '[aria-label="Copy HSL format"]');
    expect(rgbButton.textContent).toMatch(/^RGB rgb\(/);
    expect(hslButton.textContent).toMatch(/^HSL hsl\(/);
  });

  // Review thread (PR #1420, PRRT_kwDOSKrFTs6b5hjd): the retained
  // translucent preview above builds an hsla(...) preview color, but the
  // checkerboard backdrop was still gated on the `alpha` UI-affordance prop
  // (data-cinder-alpha), not the actual alphaValue — so the retained color
  // composited flat against the surrounding surface, indistinguishable from
  // a different opaque color, even though the stored value and copy actions
  // correctly reported alpha. The checkerboard is now gated on alphaValue < 1.
  test('alpha=false with a retained translucent value: the preview shows the alpha checkerboard backdrop', () => {
    const { container } = render(ColorPicker, { value: '#ff000080', alpha: false });
    const preview = q<HTMLElement>(container, '.cinder-color-picker__preview');
    expect(preview.hasAttribute('data-cinder-alpha')).toBe(true);
  });

  test('alpha=false with a genuinely opaque value: no checkerboard backdrop', () => {
    const { container } = render(ColorPicker, { value: '#ff0000', alpha: false });
    const preview = q<HTMLElement>(container, '.cinder-color-picker__preview');
    expect(preview.hasAttribute('data-cinder-alpha')).toBe(false);
  });

  test('alpha=true with an opaque value: no checkerboard backdrop (the affordance alone does not force it)', () => {
    const { container } = render(ColorPicker, { value: '#ff0000', alpha: true });
    const preview = q<HTMLElement>(container, '.cinder-color-picker__preview');
    expect(preview.hasAttribute('data-cinder-alpha')).toBe(false);
  });
});

// Review thread (PR #1420): "Preserve fractional alpha in copy payloads".
// An alpha in the 0.9995–1 band is < 1 raw but canonicalizes to exactly `1`
// at the 4-decimal precision `formatColor` uses for its `/ a` suffix. The
// emitted (configured-format) `value` already canonicalized correctly, but
// the copy-panel's `formatRgb`/`formatHsl` used a raw `alphaValue < 1` gate
// plus a DIFFERENT (3-decimal) rounding — so a value like 0.9996 emitted
// `/ 0.9996` in the configured format while the RGB/HSL copy strings showed
// `rgba(r, g, b, 1)`, an opaque-looking payload for a value everything else
// still reported as translucent. The copy strings and the emitted value now
// share the same `canonicalAlpha`/`isCanonicallyOpaque` boundary.
describe('ColorPicker fractional alpha in the 0.9995–1 band (P1 regression)', () => {
  test('0.9996 alpha: emitted value and RGB/HSL copy strings agree it is still translucent, at the same precision', () => {
    const { container } = render(ColorPicker, {
      value: 'rgba(255, 0, 0, 0.9996)',
      alpha: true,
      format: 'rgb',
    });

    // The emitted (configured-format) value treats 0.9996 as translucent.
    const hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden.value).toBe('rgb(255 0 0 / 0.9996)');

    const rgbButton = q<HTMLButtonElement>(container, '[aria-label="Copy RGB format"]');
    const hslButton = q<HTMLButtonElement>(container, '[aria-label="Copy HSL format"]');
    expect(rgbButton.textContent).toBe('RGB rgba(255, 0, 0, 0.9996)');
    expect(hslButton.textContent).toBe('HSL hsla(0, 100%, 50%, 0.9996)');

    // Checkerboard and preview must also agree it's translucent.
    const preview = q<HTMLElement>(container, '.cinder-color-picker__preview');
    expect(preview.hasAttribute('data-cinder-alpha')).toBe(true);
    expect(preview.getAttribute('style')).toContain('hsla(');
  });

  test('0.99999 alpha: everything agrees it canonicalizes to fully opaque', () => {
    const { container } = render(ColorPicker, {
      value: 'rgba(255, 0, 0, 0.99999)',
      alpha: true,
      format: 'rgb',
    });

    const hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden.value).toBe('rgb(255 0 0)');

    const rgbButton = q<HTMLButtonElement>(container, '[aria-label="Copy RGB format"]');
    const hslButton = q<HTMLButtonElement>(container, '[aria-label="Copy HSL format"]');
    expect(rgbButton.textContent).toBe('RGB rgb(255, 0, 0)');
    expect(hslButton.textContent).toBe('HSL hsl(0, 100%, 50%)');

    const preview = q<HTMLElement>(container, '.cinder-color-picker__preview');
    expect(preview.hasAttribute('data-cinder-alpha')).toBe(false);
    expect(preview.getAttribute('style')).toContain('hsl(');
    expect(preview.getAttribute('style')).not.toContain('hsla(');
  });
});

// Review thread (PR #1420, PRRT_kwDOSKrFTs6b8TF-): an unclamped
// out-of-range alpha (above 1 or negative) would let ColorPicker derive an
// alpha slider `aria-valuenow` / thumb position outside its declared
// [0, 100] range. parseCssColor now clamps alpha to [0, 1] regardless of
// what the input string (or culori) reports.
describe('ColorPicker clamps out-of-range alpha to valid slider bounds (review thread)', () => {
  test('alpha above 1 clamps: alpha slider aria-valuenow stays at 100, not above', () => {
    const { container } = render(ColorPicker, {
      value: 'rgb(255 0 0 / 1.5)',
      alpha: true,
      format: 'rgb',
      name: 'p',
    });
    const alphaSlider = q<HTMLElement>(container, '[aria-label="Alpha"]');
    expect(alphaSlider.getAttribute('aria-valuenow')).toBe('100');

    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    // Clamped to fully opaque — no alpha suffix.
    expect(hidden.value).toBe('rgb(255 0 0)');
  });

  test('negative alpha clamps: alpha slider aria-valuenow stays at 0, not below', () => {
    const { container } = render(ColorPicker, {
      value: 'rgb(255 0 0 / -0.5)',
      alpha: true,
      format: 'rgb',
      name: 'p',
    });
    const alphaSlider = q<HTMLElement>(container, '[aria-label="Alpha"]');
    expect(alphaSlider.getAttribute('aria-valuenow')).toBe('0');

    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toBe('rgb(255 0 0 / 0)');
  });
});

// Review thread (PR #1420, PRRT_kwDOSKrFTs6b6r73): with the default
// format="hex", formatHex quantizes alpha to a BYTE (0.9996 * 255 rounds to
// 255 -> byte-opaque, emits plain #rrggbb with no alpha at all), but every
// other alpha-dependent surface (preview, checkerboard, RGB/HSL copy
// strings) was still deciding "is this opaque?" via the fixed 4-decimal
// `isCanonicallyOpaque` boundary, under which 0.9996 is still translucent.
// So with format="hex" the bound/hidden value and HEX copy action reported
// an opaque color while the RGB/HSL copy actions, preview, and checkerboard
// still reported translucent for the exact same 0.9996 alpha. Every
// alpha-dependent surface now asks `isOpaqueForFormat(alphaValue, format)`,
// which quantizes to a byte specifically when format is 'hex'.
describe('ColorPicker format="hex" alpha quantization agrees everywhere (P1 regression)', () => {
  test('0.9996 alpha with format="hex": byte-quantizes to opaque everywhere, not just the emitted value', () => {
    const { container } = render(ColorPicker, {
      value: 'rgba(255, 0, 0, 0.9996)',
      alpha: true,
      format: 'hex',
    });

    // The emitted (hex) value is byte-opaque: no alpha suffix at all.
    const hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden.value).toBe('#ff0000');

    // Every other surface must agree it's opaque too.
    const preview = q<HTMLElement>(container, '.cinder-color-picker__preview');
    expect(preview.hasAttribute('data-cinder-alpha')).toBe(false);
    expect(preview.getAttribute('style')).toContain('hsl(');
    expect(preview.getAttribute('style')).not.toContain('hsla(');

    const rgbButton = q<HTMLButtonElement>(container, '[aria-label="Copy RGB format"]');
    const hslButton = q<HTMLButtonElement>(container, '[aria-label="Copy HSL format"]');
    expect(rgbButton.textContent).toBe('RGB rgb(255, 0, 0)');
    expect(hslButton.textContent).toBe('HSL hsl(0, 100%, 50%)');
  });

  test('the SAME 0.9996 alpha with format="rgb" (no byte quantization) stays translucent everywhere', () => {
    const { container } = render(ColorPicker, {
      value: 'rgba(255, 0, 0, 0.9996)',
      alpha: true,
      format: 'rgb',
    });

    const hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden.value).toBe('rgb(255 0 0 / 0.9996)');

    const preview = q<HTMLElement>(container, '.cinder-color-picker__preview');
    expect(preview.hasAttribute('data-cinder-alpha')).toBe(true);
    expect(preview.getAttribute('style')).toContain('hsla(');
  });

  test('an alpha that stays translucent even at byte precision (e.g. 0.9) is translucent everywhere with format="hex"', () => {
    const { container } = render(ColorPicker, {
      value: 'rgba(255, 0, 0, 0.9)',
      alpha: true,
      format: 'hex',
    });

    const hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden.value).toMatch(/^#ff0000[0-9a-f]{2}$/);

    const preview = q<HTMLElement>(container, '.cinder-color-picker__preview');
    expect(preview.hasAttribute('data-cinder-alpha')).toBe(true);
    expect(preview.getAttribute('style')).toContain('hsla(');
  });
});

// Review thread (PR #1420, PRRT_kwDOSKrFTs6b67FI): normalizeSwatch converts
// every `swatches` entry to hex for rendering/matching (byte-quantized
// alpha), and ColorSwatchPicker's onValueChange only ever hands
// handleSwatchChange that (lossy) hex string back — it has no way to return
// the original. Re-parsing the hex string for the commit would already have
// destroyed decimal alpha precision: `rgb(255 0 0 / 0.5)` normalizes to
// `#ff000080`, whose alpha byte 128 reparses to ~0.502, not 0.5. The commit
// path now looks up and parses the ORIGINAL raw swatch string instead.
describe('ColorPicker swatch commit preserves decimal alpha precision (P1 regression)', () => {
  test('clicking a swatch with non-byte-aligned alpha commits the exact decimal, not a byte-rounded one', async () => {
    let committed = '';
    const { container } = render(ColorPicker, {
      value: '#00ff00',
      alpha: true,
      format: 'rgb',
      swatches: ['rgb(255 0 0 / 0.5)', '#00ff00'],
      onValueCommit: (color: string) => {
        committed = color;
      },
    });

    const options = container.querySelectorAll<HTMLElement>('[role="option"]');
    await fireEvent.click(options[0]!);

    expect(committed).toBe('rgb(255 0 0 / 0.5)');

    const hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden.value).toBe('rgb(255 0 0 / 0.5)');
  });

  test('a swatch alpha right at the byte-quantization edge (0.502) still commits its own exact decimal', async () => {
    let committed = '';
    const { container } = render(ColorPicker, {
      value: '#00ff00',
      alpha: true,
      format: 'rgb',
      swatches: ['rgb(255 0 0 / 0.998)', '#00ff00'],
      onValueCommit: (color: string) => {
        committed = color;
      },
    });

    const options = container.querySelectorAll<HTMLElement>('[role="option"]');
    await fireEvent.click(options[0]!);

    // A naive byte round-trip (0.998 * 255 rounds to 255) would silently
    // become fully opaque; the real decimal value must survive.
    expect(committed).toBe('rgb(255 0 0 / 0.998)');
  });

  // Review thread (PR #1420, PRRT_kwDOSKrFTs6b7E8C): when two distinct
  // swatches quantize to the SAME normalized hex, ColorSwatchPicker renders
  // only the FIRST one (its own de-duplication keeps first-occurrence-wins).
  // The normalized-to-raw lookup built with `new Map(...)` kept the LAST
  // matching entry instead (later insertions overwrite earlier ones for the
  // same key), so clicking the one visible option looked up and committed
  // the SECOND (never-rendered) swatch's value. The lookup now also keeps
  // first-occurrence-wins, matching what's actually rendered.
  test('two swatches that normalize identically: only one option renders, and it commits its OWN (first) value', async () => {
    let committed = '';
    const { container } = render(ColorPicker, {
      value: '#00ff00',
      alpha: true,
      format: 'rgb',
      // Both round to the same byte (127.5 and 127.755 both round to 128),
      // so both normalize to the identical hex `#ff000080`.
      swatches: ['rgb(255 0 0 / 0.5)', 'rgb(255 0 0 / 0.501)'],
      onValueCommit: (color: string) => {
        committed = color;
      },
    });

    // ColorSwatchPicker de-duplicates: only one option should render for
    // the red swatches (plus the unrelated green current-value entry would
    // add a second — here there are no other swatches, so exactly one).
    const options = container.querySelectorAll<HTMLElement>('[role="option"]');
    expect(options.length).toBe(1);

    await fireEvent.click(options[0]!);

    // Must commit the FIRST swatch's own value, not the second's.
    expect(committed).toBe('rgb(255 0 0 / 0.5)');
  });
});

// Review thread #7 (PR #1420): with bind:value="#ff0000" and format="rgb",
// only `internalValue` was normalized at mount — the consumer's own bound
// `value` kept its original, un-normalized syntax. Resolved per the "no
// unsolicited mount-time writes" principle: mounting must never itself
// mutate a prop the consumer owns. The bound `value` is intentionally left
// exactly as passed until the first user-driven commit, at which point it's
// fully normalized. Pinned here via `component.$set`, which is the
// equivalent of the parent re-rendering with whatever its own `value`
// variable currently holds — since we never write back at mount, an
// unrelated re-render with the SAME (untouched) value must not normalize it
// either.
describe('ColorPicker bound-value mount normalization (P1 regression)', () => {
  test('mount does not normalize the bound `value`; only the hidden form-mirror is normalized', async () => {
    const { container, rerender } = render(ColorPicker, {
      value: '#ff0000',
      format: 'rgb',
      name: 'p',
    });

    // The hidden form-mirror IS normalized to the configured format at mount.
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toBe('rgb(255 0 0)');

    // An unrelated re-render that doesn't touch `value` (the parent's own
    // variable never changed, since the component never wrote back to it)
    // must not retroactively normalize it either.
    await rerender({ value: '#ff0000', format: 'rgb', name: 'p', disabled: false });
    await tick();
    expect(hidden.value).toBe('rgb(255 0 0)');

    // The first user-driven commit normalizes going forward.
    const hueSlider = q<HTMLElement>(container, '[role="slider"][aria-label="Hue"]');
    await fireEvent.keyDown(hueSlider, { key: 'ArrowRight' });
    expect(hidden.value).toMatch(/^rgb\(/);
  });
});

// Review thread (PR #1420, PRRT_kwDOSKrFTs6b3k2y): the controlled-sync
// effect used to implicitly depend on `format` (it called `emitValue`,
// which reads `format`), so on a bare format switch BOTH the controlled-sync
// effect and the dedicated format effect fired; controlled-sync ran first,
// updated `internalValue` to the new syntax itself, and the dedicated
// effect then saw `next === internalValue` and bailed out WITHOUT writing
// the new syntax back to the bound `value` — the hidden form input updated
// but a consumer's `bind:value` silently stayed on the old syntax until
// another user interaction. Decoupled: controlled-sync now only updates
// HSLA state (never reads `format`); a single dedicated effect (reacting to
// `hasValue`/HSLA/`format`) is the sole writer of `internalValue`/`value`.
describe('ColorPicker format switch is not swallowed by controlled-sync (P1 regression)', () => {
  test('switching `format` alone (bound `value` unchanged) immediately re-syncs both the hidden input and the bound `value`', async () => {
    const { container, rerender } = render(ColorPicker, {
      value: '#ff0000',
      format: 'hex',
      name: 'p',
    });
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toBe('#ff0000');

    // Same `value`, only `format` changes — this is exactly the scenario
    // the controlled-sync effect's `value` dependency would otherwise race.
    await rerender({ value: '#ff0000', format: 'rgb', name: 'p' });
    await tick();
    expect(hidden.value).toBe('rgb(255 0 0)');
  });

  test('switching `format` back and forth stays in sync every time, with no stale intermediate state', async () => {
    const { container, rerender } = render(ColorPicker, {
      value: '#00ff00',
      format: 'hex',
      name: 'p',
    });
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');

    await rerender({ value: '#00ff00', format: 'hsl', name: 'p' });
    await tick();
    expect(hidden.value).toBe('hsl(120 100% 50%)');

    await rerender({ value: '#00ff00', format: 'oklch', name: 'p' });
    await tick();
    expect(hidden.value).toMatch(/^oklch\(/);

    await rerender({ value: '#00ff00', format: 'hex', name: 'p' });
    await tick();
    expect(hidden.value).toBe('#00ff00');
  });
});
