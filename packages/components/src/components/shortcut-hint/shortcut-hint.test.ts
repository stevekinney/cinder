/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { createRawSnippet } = await import('svelte');
const { default: ShortcutHint } = await import('./shortcut-hint.svelte');

afterEach(() => {
  cleanup();
});

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

describe('ShortcutHint', () => {
  test('renders Kbd elements for each key', () => {
    const { container } = render(ShortcutHint, { keys: ['Ctrl', 'S'] });
    const kbds = container.querySelectorAll('kbd');
    expect(kbds.length).toBe(2);
    expect(kbds[0]?.textContent).toBe('Ctrl');
    expect(kbds[1]?.textContent).toBe('S');
  });

  test('renders a single key', () => {
    const { container } = render(ShortcutHint, { keys: ['Space'] });
    const kbds = container.querySelectorAll('kbd');
    expect(kbds.length).toBe(1);
    expect(kbds[0]?.textContent).toBe('Space');
  });

  test('exposes the key combo as sr-only text and hides the visual keycaps', () => {
    const { container } = render(ShortcutHint, { keys: ['Ctrl', 'Shift', 'P'] });
    // The visual keycaps are hidden from assistive technology…
    expect(
      container.querySelector('.cinder-shortcut-hint__keys')?.getAttribute('aria-hidden'),
    ).toBe('true');
    // …and a single sr-only text node carries the spoken representation.
    expect(container.querySelector('.cinder-sr-only')?.textContent).toBe('Ctrl plus Shift plus P');
  });

  test('uses custom keysLabel for the sr-only text when provided', () => {
    const { container } = render(ShortcutHint, {
      keys: ['Space'],
      keysLabel: 'Space bar',
    });
    expect(container.querySelector('.cinder-sr-only')?.textContent).toBe('Space bar');
  });

  test('renders separator between keys', () => {
    const { container } = render(ShortcutHint, { keys: ['Ctrl', 'S'] });
    const separators = container.querySelectorAll('.cinder-shortcut-hint__separator');
    // Ctrl + S = 1 separator
    expect(separators.length).toBe(1);
  });

  test('does not render separator for single key', () => {
    const { container } = render(ShortcutHint, { keys: ['Escape'] });
    const separators = container.querySelectorAll('.cinder-shortcut-hint__separator');
    expect(separators.length).toBe(0);
  });

  test('renders children alongside keys', () => {
    const { container } = render(ShortcutHint, {
      keys: ['Ctrl', 'S'],
      children: textSnippet('Save'),
    });
    const label = container.querySelector('.cinder-shortcut-hint__label');
    expect(label?.textContent?.trim()).toBe('Save');
  });

  test('applies custom class', () => {
    const { container } = render(ShortcutHint, {
      keys: ['Ctrl', 'S'],
      class: 'my-hint',
    });
    const root = container.querySelector('.cinder-shortcut-hint');
    expect(root?.classList.contains('my-hint')).toBe(true);
  });

  test('renders without children', () => {
    const { container } = render(ShortcutHint, { keys: ['F1'] });
    expect(container.querySelector('.cinder-shortcut-hint')).not.toBeNull();
    expect(container.querySelector('.cinder-shortcut-hint__label')).toBeNull();
  });

  test('renders keys before children when keysPosition=before', () => {
    const { container } = render(ShortcutHint, {
      keys: ['Ctrl', 'S'],
      keysPosition: 'before',
      children: textSnippet('Save'),
    });
    const root = container.querySelector('.cinder-shortcut-hint');
    const children = root ? Array.from(root.children) : [];
    // Keys (visual keycaps + sr-only text) come before the label.
    const keysIndex = children.findIndex((c) => c.classList.contains('cinder-shortcut-hint__keys'));
    const labelIndex = children.findIndex((c) =>
      c.classList.contains('cinder-shortcut-hint__label'),
    );
    expect(keysIndex).toBeGreaterThanOrEqual(0);
    expect(keysIndex).toBeLessThan(labelIndex);
  });

  test('renders keys after children by default', () => {
    const { container } = render(ShortcutHint, {
      keys: ['Ctrl', 'S'],
      children: textSnippet('Save'),
    });
    const root = container.querySelector('.cinder-shortcut-hint');
    const children = root ? Array.from(root.children) : [];
    // Label comes before the keys (visual keycaps + sr-only text) by default.
    const labelIndex = children.findIndex((c) =>
      c.classList.contains('cinder-shortcut-hint__label'),
    );
    const keysIndex = children.findIndex((c) => c.classList.contains('cinder-shortcut-hint__keys'));
    expect(labelIndex).toBeGreaterThanOrEqual(0);
    expect(labelIndex).toBeLessThan(keysIndex);
  });
});
