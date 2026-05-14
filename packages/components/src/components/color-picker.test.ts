/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
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

    const { container } = render(ColorPicker, {
      defaultValue: '#ff0000',
      name: 'p',
    });
    form.appendChild(container);
    // Allow the $effect that attaches the form reset listener to run after
    // the hidden input is reparented under the form.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const hidden = q<HTMLInputElement>(form, 'input[name="p"]');
    expect(hidden.value).toBe('#ff0000');

    // Mutate via hue slider
    const hue = q(form, '[aria-label="Hue"]');
    await fireEvent.keyDown(hue, { key: 'ArrowRight', shiftKey: true });
    expect(hidden.value).not.toBe('#ff0000');

    // Dispatch the reset event directly — Svelte's onreset wiring expects
    // a bubbling event from the form element itself.
    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(hidden.value).toBe('#ff0000');

    document.body.removeChild(form);
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
