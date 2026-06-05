/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

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
  test('renders a labelled group with gradient, hue slider, and preview', () => {
    const { container } = render(ColorPicker, { defaultValue: '#ff0000' });
    expect(q(container, '[role="group"]').getAttribute('aria-label')).toBe('Color picker');
    expect(q(container, '[role="application"]')).toBeTruthy();
    const sliders = container.querySelectorAll('[role="slider"]');
    expect(sliders.length).toBe(1); // hue only when alpha=false
    expect(q(container, '.cinder-color-picker__preview')).toBeTruthy();
  });

  test('renders alpha slider when alpha=true', () => {
    const { container } = render(ColorPicker, { defaultValue: '#ff0000', alpha: true });
    const sliders = container.querySelectorAll('[role="slider"]');
    expect(sliders.length).toBe(2);
    const alphaSlider = container.querySelector('[aria-label="Alpha"]');
    expect(alphaSlider).toBeTruthy();
  });

  test('renders swatch listbox when swatches are provided', () => {
    const { container } = render(ColorPicker, {
      defaultValue: '#ff0000',
      swatches: ['#ff0000', '#00ff00', '#0000ff'],
    });
    const listbox = q(container, '[role="listbox"]');
    expect(listbox.getAttribute('aria-label')).toBe('Color swatches');
    const options = container.querySelectorAll('[role="option"]');
    expect(options.length).toBe(3);
  });

  test('selected swatch renders a check indicator without depending on focus', () => {
    const { container } = render(ColorPicker, {
      defaultValue: '#00ff00',
      swatches: ['#ff0000', '#00ff00', '#0000ff'],
    });

    const selectedOption = q(container, '[role="option"][aria-selected="true"]');
    expect(selectedOption.querySelector('svg')).toBeTruthy();
    expect(document.activeElement).not.toBe(selectedOption);
  });

  test('renders hidden input mirroring the value when name is provided', () => {
    const { container } = render(ColorPicker, { defaultValue: '#ff0000', name: 'pick' });
    const hidden = q<HTMLInputElement>(container, 'input[name="pick"]');
    expect(hidden.type).toBe('hidden');
    expect(hidden.value).toBe('#ff0000');
  });
});

describe('ColorPicker parser round-trips', () => {
  test('hex round-trips', () => {
    const { container } = render(ColorPicker, { defaultValue: '#abcdef', name: 'p' });
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toBe('#abcdef');
  });

  test('rgb input emits hex', () => {
    const { container } = render(ColorPicker, { defaultValue: 'rgb(255, 0, 0)', name: 'p' });
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toBe('#ff0000');
  });

  test('hsl input emits hex', () => {
    const { container } = render(ColorPicker, {
      defaultValue: 'hsl(120, 100%, 50%)',
      name: 'p',
    });
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toBe('#00ff00');
  });

  test('short hex expands to long hex', () => {
    const { container } = render(ColorPicker, { defaultValue: '#f00', name: 'p' });
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toBe('#ff0000');
  });

  test('near-360 parsed hue stays within slider bounds', () => {
    const { container } = render(ColorPicker, { defaultValue: '#ff0001' });
    const hue = q(container, '[aria-label="Hue"]');
    const thumb = q(container, '.cinder-color-picker__hue-thumb');
    expect(hue.getAttribute('aria-valuenow')).toBe('359');
    expect(thumb.getAttribute('style')).toContain('left: 100%;');
  });
});

describe('ColorPicker alpha behavior', () => {
  test('alpha=true emits 8-char hex', () => {
    const { container } = render(ColorPicker, {
      defaultValue: 'rgba(255, 0, 0, 0.5)',
      alpha: true,
      name: 'p',
    });
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toMatch(/^#ff0000[0-9a-f]{2}$/);
  });

  test('alpha=false drops alpha on emit even when input has alpha', () => {
    const { container } = render(ColorPicker, {
      defaultValue: '#ff0000ff',
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
      defaultValue: 'not-a-color',
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
      defaultValue: '#00ff00',
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
      defaultValue: '#00ff00',
      swatches: ['not-a-color', '#00ff00'],
      name: 'p',
      onchange: (color: string) => {
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
      // No value or defaultValue: ColorPicker starts with internalValue === ''.
      swatches: ['not-a-color', '#00ff00'],
      name: 'p',
      onchange: (color: string) => {
        captured = color;
      },
    });

    const options = container.querySelectorAll<HTMLElement>('[role="option"]');

    // Confirm: neither swatch selected to start.
    expect(options[0]!.getAttribute('aria-selected')).toBe('false');
    expect(options[1]!.getAttribute('aria-selected')).toBe('false');

    // Click the unparseable swatch.
    await fireEvent.click(options[0]!);

    // The unparseable click must not fire onchange and must not leave the
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
        // No defaultValue: reset brings ColorPicker back to internalValue === ''.
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
      defaultValue: '#ffffff',
      alpha: false,
      swatches: ['#ff000080'],
      name: 'p',
      onchange: (color: string) => {
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
      defaultValue: '#ffffff',
      alpha: true,
      swatches: ['#ff000080'],
      name: 'p',
      onchange: (color: string) => {
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
      defaultValue: '#ff0000',
      onchange: (color: string) => {
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
    const { container } = render(ColorPicker, { defaultValue: '#ff0000' });
    const hue = q(container, '[aria-label="Hue"]');
    await fireEvent.keyDown(hue, { key: 'ArrowLeft' });
    expect(hue.getAttribute('aria-valuenow')).toBe('359');
  });

  test('Home/End move hue to 0/359', async () => {
    const { container } = render(ColorPicker, { defaultValue: 'hsl(180, 100%, 50%)' });
    const hue = q(container, '[aria-label="Hue"]');
    await fireEvent.keyDown(hue, { key: 'Home' });
    expect(hue.getAttribute('aria-valuenow')).toBe('0');
    await fireEvent.keyDown(hue, { key: 'End' });
    expect(hue.getAttribute('aria-valuenow')).toBe('359');
  });

  test('Shift+Arrow takes 10-degree steps', async () => {
    const { container } = render(ColorPicker, { defaultValue: '#ff0000' });
    const hue = q(container, '[aria-label="Hue"]');
    await fireEvent.keyDown(hue, { key: 'ArrowRight', shiftKey: true });
    expect(hue.getAttribute('aria-valuenow')).toBe('10');
  });
});

describe('ColorPicker alpha slider keyboard', () => {
  test('ArrowRight increases alpha', async () => {
    const { container } = render(ColorPicker, {
      defaultValue: '#ff000080',
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
      defaultValue: '#ff000080',
      alpha: true,
    });
    const alphaSlider = q(container, '[aria-label="Alpha"]');
    await fireEvent.keyDown(alphaSlider, { key: 'Home' });
    expect(alphaSlider.getAttribute('aria-valuenow')).toBe('0');
    await fireEvent.keyDown(alphaSlider, { key: 'End' });
    expect(alphaSlider.getAttribute('aria-valuenow')).toBe('100');
  });
});

describe('ColorPicker swatch keyboard nav', () => {
  test('clicking a swatch updates the value', async () => {
    let captured = '';
    const { container } = render(ColorPicker, {
      defaultValue: '#ffffff',
      swatches: ['#ff0000', '#00ff00', '#0000ff'],
      name: 'p',
      onchange: (color: string) => {
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
      defaultValue: '#ffffff',
      swatches: ['#ff0000', '#00ff00', '#0000ff'],
      onchange: (color: string) => {
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
      defaultValue: '#00ff00',
      swatches: ['#ff0000', '#00ff00', '#0000ff'],
    });
    const options = container.querySelectorAll<HTMLElement>('[role="option"]');
    expect(options[1]!.getAttribute('aria-selected')).toBe('true');
    expect(options[0]!.getAttribute('aria-selected')).toBe('false');
  });
});

describe('ColorPicker form reset', () => {
  test('form reset reverts to defaultValue', async () => {
    const form = document.createElement('form');
    document.body.appendChild(form);

    // Render directly into the form so the hidden input mounts inside it
    // from the start and the $effect attaches its reset listener at mount.
    const { container } = render(ColorPicker, {
      target: form,
      props: {
        defaultValue: '#ff0000',
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

  test('form reset with invalid defaultValue resets to empty without callbacks', async () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    const inputs: string[] = [];
    const changes: string[] = [];

    const { container } = render(ColorPicker, {
      target: form,
      props: {
        defaultValue: 'not-a-color',
        name: 'p',
        oninput: (color: string) => inputs.push(color),
        onchange: (color: string) => changes.push(color),
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
  test('slider keypress fires both oninput and onchange', async () => {
    const inputs: string[] = [];
    const changes: string[] = [];
    const { container } = render(ColorPicker, {
      defaultValue: '#ff0000',
      oninput: (color: string) => inputs.push(color),
      onchange: (color: string) => changes.push(color),
    });
    const hue = q(container, '[aria-label="Hue"]');
    await fireEvent.keyDown(hue, { key: 'ArrowRight' });
    expect(inputs.length).toBe(1);
    expect(changes.length).toBe(1);
    expect(inputs[0]).toBe(changes[0]);
  });

  test('swatch selection fires both oninput and onchange', async () => {
    const inputs: string[] = [];
    const changes: string[] = [];
    const { container } = render(ColorPicker, {
      defaultValue: '#ffffff',
      swatches: ['#ff0000', '#00ff00'],
      oninput: (color: string) => inputs.push(color),
      onchange: (color: string) => changes.push(color),
    });
    const option = container.querySelector<HTMLElement>('[role="option"]');
    await fireEvent.click(option!);
    expect(inputs).toEqual(['#ff0000']);
    expect(changes).toEqual(['#ff0000']);
  });
});

describe('ColorPicker pointer interaction', () => {
  test('pointer drag on hue slider updates hue and fires oninput then onchange', async () => {
    const inputs: string[] = [];
    const changes: string[] = [];
    const { container } = render(ColorPicker, {
      defaultValue: '#ff0000',
      oninput: (color: string) => inputs.push(color),
      onchange: (color: string) => changes.push(color),
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

  test('pointer cancel does not fire onchange', async () => {
    const inputs: string[] = [];
    const changes: string[] = [];
    const { container } = render(ColorPicker, {
      defaultValue: '#ff0000',
      oninput: (color: string) => inputs.push(color),
      onchange: (color: string) => changes.push(color),
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
  test('toggling alpha=false → alpha=true re-emits 8-char hex', async () => {
    const { container, rerender } = render(ColorPicker, {
      defaultValue: '#ff0000',
      alpha: false,
      name: 'p',
    });
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toBe('#ff0000');

    await rerender({ defaultValue: '#ff0000', alpha: true, name: 'p' });
    await tick();
    expect(hidden.value).toMatch(/^#ff0000[0-9a-f]{2}$/);
  });
});

describe('ColorPicker swatch normalization', () => {
  test('aria-selected matches regardless of swatch input format', () => {
    const { container } = render(ColorPicker, {
      defaultValue: '#00ff00',
      swatches: ['#f00', '#0f0', '#00f'],
    });
    const options = container.querySelectorAll<HTMLElement>('[role="option"]');
    expect(options[1]!.getAttribute('aria-selected')).toBe('true');
    expect(options[0]!.getAttribute('aria-selected')).toBe('false');
  });
});

describe('ColorPicker disabled', () => {
  test('disabled=true sets data-cinder-disabled and aria-disabled on subcontrols', () => {
    const { container } = render(ColorPicker, {
      defaultValue: '#ff0000',
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
      defaultValue: '#ff0000',
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
    const { container } = render(ColorPicker, { defaultValue: '#ff000080', alpha: true });
    expect(q(container, '[role="application"]')).toBeTruthy();
    expect(q(container, '.cinder-color-picker__hue')).toBeTruthy();
    expect(q(container, '[aria-label="Alpha"]')).toBeTruthy();
    expect(q(container, '.cinder-color-picker__footer')).toBeTruthy();
    expect(q(container, '.cinder-color-picker__preview')).toBeTruthy();
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });

  test('footer hex value shows the 8-char hex when alpha=true', () => {
    const { container } = render(ColorPicker, {
      defaultValue: '#ff000080',
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
      defaultValue: '#ffffff',
      alpha: true,
      swatches: ['#ff000080', '#00ff0080'],
      onchange: (color: string) => {
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
    const { container } = render(ColorPicker, { defaultValue: '#3b82f6' });
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    // Controls still present
    expect(q(container, '[role="application"]')).toBeTruthy();
    expect(q(container, '.cinder-color-picker__hue')).toBeTruthy();
    expect(q(container, '.cinder-color-picker__footer')).toBeTruthy();
  });

  test('footer shows hex value without swatches', () => {
    const { container } = render(ColorPicker, { defaultValue: '#3b82f6', name: 'p' });
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
      defaultValue: '#ffffff',
      swatches: ['#ef4444', '#22c55e', '#3b82f6'],
      name: 'p',
    });
    const options = container.querySelectorAll<HTMLElement>('[role="option"]');
    await fireEvent.click(options[1]!);
    const hidden = q<HTMLInputElement>(container, 'input[name="p"]');
    expect(hidden.value).toBe('#22c55e');
  });

  test('swatch selection via ColorSwatchPicker fires onchange', async () => {
    let captured = '';
    const { container } = render(ColorPicker, {
      defaultValue: '#ffffff',
      swatches: ['#ef4444', '#22c55e', '#3b82f6'],
      onchange: (color: string) => {
        captured = color;
      },
    });
    const options = container.querySelectorAll<HTMLElement>('[role="option"]');
    await fireEvent.click(options[2]!);
    expect(captured).toBe('#3b82f6');
  });

  test('ColorSwatchPicker reflects selected state from gradient/slider pick', async () => {
    const { container } = render(ColorPicker, {
      defaultValue: '#ef4444',
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
      defaultValue: '#ffffff',
      swatches: ['#ef4444', '#22c55e', '#3b82f6'],
      onchange: (color: string) => {
        captured = color;
      },
    });
    const listbox = q(container, '[role="listbox"]');
    await fireEvent.keyDown(listbox, { key: 'ArrowRight' });
    await fireEvent.keyDown(listbox, { key: 'Enter' });
    expect(captured).toBe('#22c55e');
  });
});
