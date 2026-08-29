/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { setupHappyDom } from '../../test/happy-dom.ts';
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
  });
  test('Escape exits capture and validation rejects reserved combinations', async () => {
    let invalid = false;
    const { container } = render(ShortcutField, { validate: () => 'Reserved shortcut' });
    const field = container.querySelector('[role="textbox"]')!;
    await fireEvent.focus(field);
    await fireEvent.keyDown(field, { key: 'k', ctrlKey: true });
    expect(container.textContent).toContain('Reserved shortcut');
    await fireEvent.keyDown(field, { key: 'Escape' });
    expect(invalid).toBe(false);
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
      bubbles: true,
      cancelable: true,
    });
    field.dispatchEvent(modifier);
    expect(modifier.defaultPrevented).toBe(false);
    await fireEvent.blur(field);
    await fireEvent.keyDown(field, { key: 'x', ctrlKey: true });
    expect(container.textContent).not.toContain('Control');
  });

  test('disabled fields are inert and cannot clear their value', async () => {
    const { container } = render(ShortcutField, { value: ['Control', 'K'], disabled: true });
    const field = container.querySelector('[role="textbox"]')!;
    expect(container.querySelector('[aria-label="Clear shortcut"]')).toBeNull();
    await fireEvent.keyDown(field, { key: 'x', ctrlKey: true });
    expect(container.textContent).toContain('Control');
  });
});
