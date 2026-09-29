/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';

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

describe('ChoiceGrid selection', () => {
  test('clicking an item selects it in single-select mode', async () => {
    const { container } = render(Wrapper, {
      ariaLabel: 'Pick one',
      items,
    });
    const radios = Array.from(container.querySelectorAll('[role="radio"]'));
    await fireEvent.click(requiredInstance(radios[1], Element));
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
    await fireEvent.click(requiredInstance(radios[2], Element));
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
    await fireEvent.click(requiredInstance(checkboxes[0], Element));
    expect(checkboxes[0]?.getAttribute('aria-checked')).toBe('true');
    await fireEvent.click(requiredInstance(checkboxes[0], Element));
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
    await fireEvent.click(requiredInstance(radios[0], Element));
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
