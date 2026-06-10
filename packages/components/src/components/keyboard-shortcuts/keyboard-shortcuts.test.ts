/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: KeyboardShortcuts } = await import('./keyboard-shortcuts.svelte');

afterEach(() => {
  cleanup();
});

const sampleGroups = [
  {
    label: 'Editing',
    shortcuts: [
      { action: 'Save document', keys: ['Ctrl', 'S'] },
      { action: 'Undo', keys: ['Ctrl', 'Z'] },
    ],
  },
  {
    label: 'Navigation',
    shortcuts: [
      { action: 'Go to top', keys: ['Home'] },
      { action: 'Go to bottom', keys: ['End'] },
    ],
  },
];

describe('KeyboardShortcuts', () => {
  test('renders all group headings', () => {
    const { container } = render(KeyboardShortcuts, { groups: sampleGroups });
    const headings = container.querySelectorAll('.cinder-keyboard-shortcuts__group-label');
    expect(headings.length).toBe(2);
    expect(headings[0]?.textContent).toBe('Editing');
    expect(headings[1]?.textContent).toBe('Navigation');
  });

  test('renders action labels', () => {
    const { container } = render(KeyboardShortcuts, { groups: sampleGroups });
    const actions = container.querySelectorAll('.cinder-keyboard-shortcuts__action');
    const actionTexts = Array.from(actions).map((el) => el.textContent?.trim());
    expect(actionTexts).toContain('Save document');
    expect(actionTexts).toContain('Undo');
    expect(actionTexts).toContain('Go to top');
  });

  test('renders screen-reader accessible key labels', () => {
    const { container } = render(KeyboardShortcuts, { groups: sampleGroups });
    // The sr-only spans contain the accessible combo text.
    const srLabels = container.querySelectorAll('.cinder-sr-only');
    const labelTexts = Array.from(srLabels).map((el) => el.textContent?.trim());
    expect(labelTexts).toContain('Ctrl plus S');
    expect(labelTexts).toContain('Ctrl plus Z');
  });

  test('renders custom keysLabel when provided', () => {
    const groups = [
      {
        label: 'Playback',
        shortcuts: [
          {
            action: 'Play or pause',
            keys: ['Space'],
            keysLabel: 'Space bar',
          },
        ],
      },
    ];
    const { container } = render(KeyboardShortcuts, { groups });
    const srLabels = container.querySelectorAll('.cinder-sr-only');
    const labelTexts = Array.from(srLabels).map((el) => el.textContent?.trim());
    expect(labelTexts).toContain('Space bar');
  });

  test('renders Kbd elements for each key', () => {
    const { container } = render(KeyboardShortcuts, { groups: sampleGroups });
    const kbdElements = container.querySelectorAll('kbd');
    // Ctrl, S, Ctrl, Z, Home, End = 6 kbd elements
    expect(kbdElements.length).toBe(6);
  });

  test('renders optional heading when provided', () => {
    const { container } = render(KeyboardShortcuts, {
      groups: sampleGroups,
      heading: 'Keyboard Shortcuts',
    });
    const heading = container.querySelector('.cinder-keyboard-shortcuts__heading');
    expect(heading?.textContent).toBe('Keyboard Shortcuts');
  });

  test('does not render heading element when not provided', () => {
    const { container } = render(KeyboardShortcuts, { groups: sampleGroups });
    expect(container.querySelector('.cinder-keyboard-shortcuts__heading')).toBeNull();
  });

  test('each group section has aria-labelledby pointing to its heading', () => {
    const { container } = render(KeyboardShortcuts, { groups: sampleGroups });
    const sections = container.querySelectorAll('section.cinder-keyboard-shortcuts__group');
    for (const section of sections) {
      const labelledBy = section.getAttribute('aria-labelledby');
      expect(labelledBy).not.toBeNull();
      const referencedElement = container.querySelector(`#${labelledBy}`);
      expect(referencedElement).not.toBeNull();
    }
  });

  test('applies custom class', () => {
    const { container } = render(KeyboardShortcuts, {
      groups: sampleGroups,
      class: 'my-shortcuts',
    });
    const root = container.querySelector('.cinder-keyboard-shortcuts');
    expect(root?.classList.contains('my-shortcuts')).toBe(true);
  });

  test('renders separator between keys in a combo', () => {
    const { container } = render(KeyboardShortcuts, { groups: sampleGroups });
    const separators = container.querySelectorAll('.cinder-keyboard-shortcuts__separator');
    // Each 2-key combo has 1 separator: Ctrl+S, Ctrl+Z = 2 separators
    expect(separators.length).toBeGreaterThanOrEqual(2);
  });

  test('renders with empty groups array without error', () => {
    const { container } = render(KeyboardShortcuts, { groups: [] });
    expect(container.querySelector('.cinder-keyboard-shortcuts')).not.toBeNull();
  });

  test('duplicate group labels get unique heading ids (aria-labelledby stays valid)', () => {
    const { container } = render(KeyboardShortcuts, {
      groups: [
        { label: 'General', shortcuts: [{ action: 'Save', keys: ['Ctrl', 'S'] }] },
        { label: 'General', shortcuts: [{ action: 'Open', keys: ['Ctrl', 'O'] }] },
      ],
    });
    const headings = [
      ...container.querySelectorAll<HTMLElement>('.cinder-keyboard-shortcuts__group-label'),
    ];
    const ids = headings.map((h) => h.id);
    expect(ids.length).toBe(2);
    expect(new Set(ids).size).toBe(2); // distinct ids despite identical labels
    const sections = [...container.querySelectorAll('.cinder-keyboard-shortcuts__group')];
    for (const section of sections) {
      expect(ids).toContain(section.getAttribute('aria-labelledby') ?? '');
    }
  });

  test('duplicate shortcut actions within a group render distinct rows', () => {
    const { container } = render(KeyboardShortcuts, {
      groups: [
        {
          label: 'Editing',
          shortcuts: [
            { action: 'Cycle', keys: ['Tab'] },
            { action: 'Cycle', keys: ['Shift', 'Tab'] },
          ],
        },
      ],
    });
    expect(container.querySelectorAll('.cinder-keyboard-shortcuts__row').length).toBe(2);
  });
});
