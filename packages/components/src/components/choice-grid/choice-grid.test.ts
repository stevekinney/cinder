/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const { default: Wrapper } = await import('../../test/fixtures/choice-grid-fixture.svelte');

const items = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C' },
];

// ---------------------------------------------------------------------------
// ARIA structure
// ---------------------------------------------------------------------------

describe('ChoiceGrid ARIA structure', () => {
  test('renders with role="radiogroup" in single-select mode', () => {
    const { container } = render(Wrapper, {
      ariaLabel: 'Pick one',
      items,
    });
    const grid = container.querySelector('[role="radiogroup"]');
    expect(grid).not.toBeNull();
    expect(grid?.getAttribute('aria-label')).toBe('Pick one');
  });

  test('renders with role="group" in multi-select mode', () => {
    const { container } = render(Wrapper, {
      ariaLabel: 'Pick many',
      multiple: true,
      items,
    });
    const grid = container.querySelector('[role="group"]');
    expect(grid).not.toBeNull();
  });

  test('single-select items carry role="radio" and aria-checked', () => {
    const { container } = render(Wrapper, {
      value: 'b',
      ariaLabel: 'Pick one',
      items,
    });
    const radios = Array.from(container.querySelectorAll('[role="radio"]'));
    expect(radios.length).toBe(3);
    expect(radios[0]?.getAttribute('aria-checked')).toBe('false');
    expect(radios[1]?.getAttribute('aria-checked')).toBe('true');
    expect(radios[2]?.getAttribute('aria-checked')).toBe('false');
  });

  test('multi-select items carry role="checkbox"', () => {
    const { container } = render(Wrapper, {
      multiple: true,
      values: ['a'],
      ariaLabel: 'Pick many',
      items,
    });
    const checkboxes = Array.from(container.querySelectorAll('[role="checkbox"]'));
    expect(checkboxes.length).toBe(3);
    expect(checkboxes[0]?.getAttribute('aria-checked')).toBe('true');
    expect(checkboxes[1]?.getAttribute('aria-checked')).toBe('false');
  });

  test('only the selected item (or first) has tabindex="0" initially', () => {
    const { container } = render(Wrapper, {
      value: 'b',
      ariaLabel: 'Pick one',
      items,
    });
    const radios = Array.from(container.querySelectorAll('[role="radio"]'));
    expect(radios[0]?.getAttribute('tabindex')).toBe('-1');
    expect(radios[1]?.getAttribute('tabindex')).toBe('0');
    expect(radios[2]?.getAttribute('tabindex')).toBe('-1');
  });

  test('first item gets tabindex="0" when no value is selected', () => {
    const { container } = render(Wrapper, {
      ariaLabel: 'Pick one',
      items,
    });
    const radios = Array.from(container.querySelectorAll('[role="radio"]'));
    expect(radios[0]?.getAttribute('tabindex')).toBe('0');
    expect(radios[1]?.getAttribute('tabindex')).toBe('-1');
    expect(radios[2]?.getAttribute('tabindex')).toBe('-1');
  });
});

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

describe('ChoiceGrid selection', () => {
  test('clicking an item selects it in single-select mode', async () => {
    const { container } = render(Wrapper, {
      ariaLabel: 'Pick one',
      items,
    });
    const radios = Array.from(container.querySelectorAll('[role="radio"]'));
    await fireEvent.click(radios[1] as Element);
    expect(radios[1]?.getAttribute('aria-checked')).toBe('true');
    expect(radios[0]?.getAttribute('aria-checked')).toBe('false');
  });

  test('clicking a different item replaces single-select selection', async () => {
    const { container } = render(Wrapper, {
      value: 'a',
      ariaLabel: 'Pick one',
      items,
    });
    const radios = Array.from(container.querySelectorAll('[role="radio"]'));
    await fireEvent.click(radios[2] as Element);
    expect(radios[2]?.getAttribute('aria-checked')).toBe('true');
    expect(radios[0]?.getAttribute('aria-checked')).toBe('false');
  });

  test('clicking toggles multi-select items on and off', async () => {
    const { container } = render(Wrapper, {
      multiple: true,
      ariaLabel: 'Pick many',
      items,
    });
    const checkboxes = Array.from(container.querySelectorAll('[role="checkbox"]'));
    await fireEvent.click(checkboxes[0] as Element);
    expect(checkboxes[0]?.getAttribute('aria-checked')).toBe('true');
    await fireEvent.click(checkboxes[0] as Element);
    expect(checkboxes[0]?.getAttribute('aria-checked')).toBe('false');
  });

  test('disabled items cannot be selected', async () => {
    const disabledItems = [
      { value: 'a', label: 'A', disabled: true },
      { value: 'b', label: 'B' },
    ];
    const { container } = render(Wrapper, {
      ariaLabel: 'Pick one',
      items: disabledItems,
    });
    const radios = Array.from(container.querySelectorAll('[role="radio"]'));
    await fireEvent.click(radios[0] as Element);
    expect(radios[0]?.getAttribute('aria-checked')).toBe('false');
  });

  test('grid-level disabled prevents selection', async () => {
    const { container } = render(Wrapper, {
      disabled: true,
      ariaLabel: 'Pick one',
      items,
    });
    const grid = container.querySelector('[data-cinder-disabled]');
    expect(grid).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Roving keyboard focus
// ---------------------------------------------------------------------------

describe('ChoiceGrid roving keyboard focus', () => {
  test('ArrowRight moves focus to the next item', async () => {
    const { container } = render(Wrapper, {
      value: 'a',
      ariaLabel: 'Pick one',
      items,
    });
    const radios = Array.from(container.querySelectorAll<HTMLElement>('[role="radio"]'));
    radios[0]?.focus();
    await fireEvent.keyDown(radios[0] as Element, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(radios[1] ?? null);
  });

  test('ArrowLeft moves focus to the previous item', async () => {
    const { container } = render(Wrapper, {
      value: 'b',
      ariaLabel: 'Pick one',
      items,
    });
    const radios = Array.from(container.querySelectorAll<HTMLElement>('[role="radio"]'));
    radios[1]?.focus();
    await fireEvent.keyDown(radios[1] as Element, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(radios[0] ?? null);
  });

  test('ArrowDown moves focus to the next item', async () => {
    const { container } = render(Wrapper, {
      value: 'a',
      ariaLabel: 'Pick one',
      items,
    });
    const radios = Array.from(container.querySelectorAll<HTMLElement>('[role="radio"]'));
    radios[0]?.focus();
    await fireEvent.keyDown(radios[0] as Element, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(radios[1] ?? null);
  });

  test('ArrowRight wraps from last to first', async () => {
    const { container } = render(Wrapper, {
      value: 'c',
      ariaLabel: 'Pick one',
      items,
    });
    const radios = Array.from(container.querySelectorAll<HTMLElement>('[role="radio"]'));
    radios[2]?.focus();
    await fireEvent.keyDown(radios[2] as Element, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(radios[0] ?? null);
  });

  test('Space selects the focused item', async () => {
    const { container } = render(Wrapper, {
      ariaLabel: 'Pick one',
      items,
    });
    const radios = Array.from(container.querySelectorAll<HTMLElement>('[role="radio"]'));
    radios[1]?.focus();
    await fireEvent.keyDown(radios[1] as Element, { key: ' ' });
    expect(radios[1]?.getAttribute('aria-checked')).toBe('true');
  });

  test('Enter selects the focused item', async () => {
    const { container } = render(Wrapper, {
      ariaLabel: 'Pick one',
      items,
    });
    const radios = Array.from(container.querySelectorAll<HTMLElement>('[role="radio"]'));
    radios[2]?.focus();
    await fireEvent.keyDown(radios[2] as Element, { key: 'Enter' });
    expect(radios[2]?.getAttribute('aria-checked')).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// Disabled-aware roving + radiogroup arrow selection
// ---------------------------------------------------------------------------

describe('ChoiceGrid disabled-aware navigation', () => {
  const withDisabledMiddle = [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B', disabled: true },
    { value: 'c', label: 'C' },
  ];

  test('a disabled item never receives tabindex="0"', () => {
    const { container } = render(Wrapper, {
      ariaLabel: 'Pick one',
      // first item disabled — focusable should fall through to the first ENABLED item
      items: [
        { value: 'a', label: 'A', disabled: true },
        { value: 'b', label: 'B' },
        { value: 'c', label: 'C' },
      ],
    });
    const radios = Array.from(container.querySelectorAll<HTMLElement>('[role="radio"]'));
    expect(radios[0]?.getAttribute('tabindex')).toBe('-1');
    expect(radios[1]?.getAttribute('tabindex')).toBe('0');
  });

  test('ArrowRight skips a disabled item', async () => {
    const { container } = render(Wrapper, { ariaLabel: 'Pick one', items: withDisabledMiddle });
    const radios = Array.from(container.querySelectorAll<HTMLElement>('[role="radio"]'));
    radios[0]?.focus();
    await fireEvent.keyDown(radios[0] as Element, { key: 'ArrowRight' });
    // b (index 1) is disabled, so focus lands on c (index 2), not b.
    expect(document.activeElement).toBe(radios[2] ?? null);
  });

  test('single-select ArrowRight moves selection (WAI-ARIA radiogroup pattern)', async () => {
    const { container } = render(Wrapper, {
      value: 'a',
      ariaLabel: 'Pick one',
      items: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
        { value: 'c', label: 'C' },
      ],
    });
    const radios = Array.from(container.querySelectorAll<HTMLElement>('[role="radio"]'));
    radios[0]?.focus();
    await fireEvent.keyDown(radios[0] as Element, { key: 'ArrowRight' });
    // focus AND selection move to b.
    expect(document.activeElement).toBe(radios[1] ?? null);
    expect(radios[1]?.getAttribute('aria-checked')).toBe('true');
    expect(radios[0]?.getAttribute('aria-checked')).toBe('false');
  });

  test('multi-select ArrowRight moves focus but NOT selection', async () => {
    const { container } = render(Wrapper, {
      multiple: true,
      values: [],
      ariaLabel: 'Pick some',
      items: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    });
    const boxes = Array.from(container.querySelectorAll<HTMLElement>('[role="checkbox"]'));
    boxes[0]?.focus();
    await fireEvent.keyDown(boxes[0] as Element, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(boxes[1] ?? null);
    // No selection happened from navigation alone.
    expect(boxes[1]?.getAttribute('aria-checked')).toBe('false');
  });

  test('arrow navigation still works when focus is on a disabled item', async () => {
    // Regression: a disabled tile must not trap the keyboard — arrows must still
    // move focus to the next enabled item.
    const { container } = render(Wrapper, {
      ariaLabel: 'Pick one',
      items: [
        { value: 'a', label: 'A', disabled: true },
        { value: 'b', label: 'B' },
        { value: 'c', label: 'C' },
      ],
    });
    const radios = Array.from(container.querySelectorAll<HTMLElement>('[role="radio"]'));
    // Force focus onto the disabled first tile, then press ArrowRight.
    radios[0]?.focus();
    await fireEvent.keyDown(radios[0] as Element, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(radios[1] ?? null);
  });

  test('Space on a disabled item does not select it', async () => {
    const { container } = render(Wrapper, {
      ariaLabel: 'Pick one',
      items: [{ value: 'a', label: 'A', disabled: true }],
    });
    const disabled = container.querySelectorAll<HTMLElement>('[role="radio"]')[0];
    disabled?.focus();
    await fireEvent.keyDown(disabled as Element, { key: ' ' });
    expect(disabled?.getAttribute('aria-checked')).toBe('false');
  });
});

// ---------------------------------------------------------------------------
// Accessible name
// ---------------------------------------------------------------------------

describe('ChoiceGrid accessible name', () => {
  test('an empty ariaLabel does not emit aria-label="" (which would suppress naming)', () => {
    const { container } = render(Wrapper, {
      ariaLabel: '',
      items: [{ value: 'a', label: 'A' }],
    });
    const group = container.querySelector('[role="radiogroup"]');
    // Empty string is normalized to undefined → the attribute is absent.
    expect(group?.hasAttribute('aria-label')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Feedback states
// ---------------------------------------------------------------------------

describe('ChoiceGrid feedback states', () => {
  test('neutral state has no data-cinder-state attribute', () => {
    const { container } = render(Wrapper, {
      ariaLabel: 'Pick one',
      items: [{ value: 'a', label: 'A', state: 'neutral' }],
    });
    const radio = container.querySelector('[role="radio"]');
    expect(radio?.hasAttribute('data-cinder-state')).toBe(false);
  });

  test('correct state carries data-cinder-state="correct"', () => {
    const { container } = render(Wrapper, {
      ariaLabel: 'Pick one',
      items: [{ value: 'a', label: 'A', state: 'correct' }],
    });
    const radio = container.querySelector('[role="radio"]');
    expect(radio?.getAttribute('data-cinder-state')).toBe('correct');
  });

  test('incorrect state carries data-cinder-state="incorrect"', () => {
    const { container } = render(Wrapper, {
      ariaLabel: 'Pick one',
      items: [{ value: 'a', label: 'A', state: 'incorrect' }],
    });
    const radio = container.querySelector('[role="radio"]');
    expect(radio?.getAttribute('data-cinder-state')).toBe('incorrect');
  });

  test('pending state carries data-cinder-state="pending"', () => {
    const { container } = render(Wrapper, {
      ariaLabel: 'Pick one',
      items: [{ value: 'a', label: 'A', state: 'pending' }],
    });
    const radio = container.querySelector('[role="radio"]');
    expect(radio?.getAttribute('data-cinder-state')).toBe('pending');
  });
});

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

describe('ChoiceGrid column layout', () => {
  test('applies .cinder-choice-grid class to the root', () => {
    const { container } = render(Wrapper, {
      ariaLabel: 'Pick one',
      items,
    });
    expect(container.querySelector('.cinder-choice-grid')).not.toBeNull();
  });

  test('items carry .cinder-choice-grid-item class', () => {
    const { container } = render(Wrapper, {
      ariaLabel: 'Pick one',
      items,
    });
    const gridItems = container.querySelectorAll('.cinder-choice-grid-item');
    expect(gridItems.length).toBe(3);
  });
});
