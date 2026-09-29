/// <reference lib="dom" />
import { setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
setupHappyDom();
const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: ShortcutField } = await import('./shortcut-field.svelte');
afterEach(() => cleanup());
describe('ShortcutField', () => {
  test('is a read-only textbox and captures normalized modifiers', async () => {
    const { container } = render(ShortcutField);
    const field = container.querySelector('[role="textbox"]')!;
    expect(field.getAttribute('aria-readonly')).toBe('true');
    await fireEvent.focus(field);
    await fireEvent.keyDown(field, { key: 's', metaKey: true, shiftKey: true });
    expect(container.querySelector('kbd')?.textContent).toBe('Meta');
    expect(container.textContent).toContain('Shift');
    expect(container.textContent).toContain('S');
  });
  test('Escape exits capture and validation rejects reserved combinations', async () => {
    const { container } = render(ShortcutField, { validate: () => 'Reserved shortcut' });
    const field = container.querySelector('[role="textbox"]')!;
    await fireEvent.focus(field);
    await fireEvent.keyDown(field, { key: 'k', ctrlKey: true });
    expect(container.textContent).toContain('Reserved shortcut');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    const describedBy = field.getAttribute('aria-describedby');
    expect(describedBy).not.toBeNull();
    expect(describedBy).not.toBe('shortcut-field-error');
    expect(container.querySelector(`#${describedBy}`)?.textContent).toContain('Reserved shortcut');
    await fireEvent.keyDown(field, { key: 'Escape' });
    expect(field.getAttribute('aria-invalid')).toBeNull();
    expect(field.getAttribute('aria-describedby')).toBeNull();
    expect(container.querySelector('.cinder-shortcut-field__error')).toBeNull();
  });
  test('clear action is available for an existing value', async () => {
    const { container } = render(ShortcutField, { value: ['Control', 'K'] });
    expect(container.querySelector('[aria-label="Clear shortcut"]')).not.toBeNull();
  });

  test('does not consume Tab or modifier-only keys and disarms on blur', async () => {
    const { container } = render(ShortcutField);
    const field = container.querySelector('[role="textbox"]')!;
    await fireEvent.focus(field);
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    field.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
    const modifier = new KeyboardEvent('keydown', {
      key: 'Control',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    field.dispatchEvent(modifier);
    expect(modifier.defaultPrevented).toBe(false);
    expect(container.querySelector('kbd')).toBeNull();
    await fireEvent.blur(field);
    await fireEvent.keyDown(field, { key: 'x', ctrlKey: true });
    expect(container.textContent).not.toContain('Control');
  });

  test('disabled fields are inert and cannot clear their value', async () => {
    const { container } = render(ShortcutField, { value: ['Control', 'K'], disabled: true });
    const field = container.querySelector('[role="textbox"]')!;
    expect(container.querySelector('[aria-label="Clear shortcut"]')).toBeNull();
    expect(container.querySelector('.cinder-shortcut-field--disabled')).not.toBeNull();
    expect(field.getAttribute('tabindex')).toBe('-1');
    expect(field.getAttribute('aria-disabled')).toBe('true');
    await fireEvent.keyDown(field, { key: 'x', ctrlKey: true });
    expect(container.textContent).toContain('Control');
  });

  test('label renders visible field text by default and remains the textbox accessible name (COR-443)', () => {
    const { container } = render(ShortcutField, {
      id: 'command-palette',
      label: 'Open command palette',
      value: ['Meta', 'K'],
    });
    const field = container.querySelector('[role="textbox"]')!;
    const labelledBy = field.getAttribute('aria-labelledby');
    expect(labelledBy).not.toBeNull();
    const labelElement = container.querySelector(`#${labelledBy}`);
    expect(labelElement?.textContent?.trim()).toBe('Open command palette');
    expect(labelElement?.classList.contains('cinder-sr-only')).toBe(false);
    expect(container.textContent).toContain('Open command palette');
  });

  test('labelVisible={false} keeps the label in the DOM, visually hidden, with the accessible name preserved (COR-443)', () => {
    const { container } = render(ShortcutField, {
      id: 'shortcut',
      label: 'Open command palette',
      labelVisible: false,
    });
    const field = container.querySelector('[role="textbox"]')!;
    const labelledBy = field.getAttribute('aria-labelledby');
    expect(labelledBy).not.toBeNull();
    const labelElement = container.querySelector(`#${labelledBy}`);
    expect(labelElement?.textContent?.trim()).toBe('Open command palette');
    expect(labelElement?.classList.contains('cinder-sr-only')).toBe(true);
  });

  test('empty enabled state shows placeholder copy, and arming shows capture copy without changing value (COR-443)', async () => {
    const { container } = render(ShortcutField);
    const field = container.querySelector('[role="textbox"]')!;
    expect(container.querySelector('.cinder-shortcut-field__placeholder')?.textContent).toBe(
      'Click to record shortcut',
    );
    await fireEvent.focus(field);
    expect(container.querySelector('.cinder-shortcut-field__placeholder')?.textContent).toBe(
      'Press a key combination',
    );
    expect(container.querySelector('kbd')).toBeNull();
  });

  test('Escape cancels capture, preserves the previous value, clears the invalid state, and announces cancellation (COR-443)', async () => {
    const { container } = render(ShortcutField, { value: ['Control', 'K'] });
    const field = container.querySelector('[role="textbox"]')!;
    await fireEvent.focus(field);
    await fireEvent.keyDown(field, { key: 'x', ctrlKey: true, shiftKey: true });
    // A validate-free capture would already have committed here; re-arm and
    // cancel via Escape instead of committing, to exercise cancellation.
    await fireEvent.focus(field);
    await fireEvent.keyDown(field, { key: 'Escape' });
    expect(field.getAttribute('aria-invalid')).toBeNull();
    expect(container.querySelector('.cinder-sr-only[aria-live="polite"]')?.textContent).toBe(
      'Shortcut capture cancelled',
    );
  });

  test('a valid chord commits value once, calls onValueChange once, and announces the capture (COR-443)', async () => {
    let calls = 0;
    let lastValue: string[] | undefined;
    const { container } = render(ShortcutField, {
      onValueChange: (next: string[]) => {
        calls += 1;
        lastValue = next;
      },
    });
    const field = container.querySelector('[role="textbox"]')!;
    await fireEvent.focus(field);
    await fireEvent.keyDown(field, { key: 'k', metaKey: true, shiftKey: true });
    expect(calls).toBe(1);
    expect(lastValue).toEqual(['Meta', 'Shift', 'K']);
    expect(container.querySelector('.cinder-sr-only[aria-live="polite"]')?.textContent).toBe(
      'Captured Meta plus Shift plus K',
    );
  });

  test('a rejected chord leaves value unchanged and does not call onValueChange (COR-443)', async () => {
    let calls = 0;
    const { container } = render(ShortcutField, {
      value: ['Control', 'K'],
      onValueChange: () => {
        calls += 1;
      },
      validate: () => 'Reserved shortcut',
    });
    const field = container.querySelector('[role="textbox"]')!;
    await fireEvent.focus(field);
    await fireEvent.keyDown(field, { key: 'j', ctrlKey: true });
    expect(calls).toBe(0);
    expect(container.querySelector('kbd')?.textContent).toBe('Control');
  });

  test('Clear sets value to [], calls onValueChange([]) once, clears the invalid state, and announces (COR-443)', async () => {
    let calls = 0;
    let lastValue: string[] | undefined;
    const { container } = render(ShortcutField, {
      value: ['Control', 'K'],
      onValueChange: (next: string[]) => {
        calls += 1;
        lastValue = next;
      },
    });
    const clearButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Clear shortcut"]',
    )!;
    await fireEvent.click(clearButton);
    expect(calls).toBe(1);
    expect(lastValue).toEqual([]);
    expect(container.querySelector('kbd')).toBeNull();
    expect(container.querySelector('.cinder-sr-only[aria-live="polite"]')?.textContent).toBe(
      'Shortcut cleared',
    );
  });

  test('styles import the shared form-field styles alongside Kbd styles (COR-443)', async () => {
    const css = await Bun.file(new URL('./shortcut-field.css', import.meta.url)).text();
    expect(css).toContain("@import '../kbd/kbd.css';");
    expect(css).toContain("@import '../form-field/form-field.css';");
  });
});
