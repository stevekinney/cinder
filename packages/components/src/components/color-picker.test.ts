/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
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
    const options = container.querySelectorAll<HTMLElement>('[role="option"]');
    await fireEvent.keyDown(options[2]!, { key: 'Enter' });
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
