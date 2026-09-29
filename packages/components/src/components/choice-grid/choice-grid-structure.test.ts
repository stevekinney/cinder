/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { render, cleanup } = await import('@testing-library/svelte');

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
  test('composes the shared Grid root', async () => {
    const { container } = render(Wrapper, { ariaLabel: 'Choices', items: [items[0]!] });

    expect(container.querySelector('.cinder-choice-grid.cinder-grid')).not.toBeNull();
  });
  test('maps fixed columns to the shared Grid layout variable', () => {
    const { container } = render(Wrapper, {
      ariaLabel: 'Choices',
      columns: 3,
      items,
    });
    const root = container.querySelector<HTMLElement>('.cinder-choice-grid');
    expect(root?.style.getPropertyValue('--cinder-grid-columns')).toBe('repeat(3, minmax(0, 1fr))');
  });

  test('maps responsive minimum width to the shared Grid layout variable', () => {
    const { container } = render(Wrapper, {
      ariaLabel: 'Choices',
      items,
    });
    const root = container.querySelector<HTMLElement>('.cinder-choice-grid');
    expect(root?.style.getPropertyValue('--cinder-grid-min-item-width')).toBe('10rem');
  });
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

// ---------------------------------------------------------------------------
// Compact size (COR-330)
// ---------------------------------------------------------------------------

describe('ChoiceGrid size', () => {
  test('omitting size preserves current appearance: no data-cinder-size attribute anywhere', () => {
    const { container } = render(Wrapper, { ariaLabel: 'Choices', items });
    expect(container.querySelector('.cinder-choice-grid')?.hasAttribute('data-cinder-size')).toBe(
      false,
    );
    for (const item of container.querySelectorAll('.cinder-choice-grid-item')) {
      expect(item.hasAttribute('data-cinder-size')).toBe(false);
    }
  });

  test('size="sm" is propagated from the grid root to every item', () => {
    const { container } = render(Wrapper, { ariaLabel: 'Choices', items, size: 'sm' });
    expect(container.querySelector('.cinder-choice-grid')?.getAttribute('data-cinder-size')).toBe(
      'sm',
    );
    const gridItems = container.querySelectorAll('.cinder-choice-grid-item');
    expect(gridItems.length).toBe(3);
    for (const item of gridItems) {
      expect(item.getAttribute('data-cinder-size')).toBe('sm');
    }
  });

  test('size="sm" defaults minColumnWidth to 6rem for columns="responsive"', () => {
    const { container } = render(Wrapper, { ariaLabel: 'Choices', items, size: 'sm' });
    const root = container.querySelector<HTMLElement>('.cinder-choice-grid');
    expect(root?.style.getPropertyValue('--cinder-grid-min-item-width')).toBe('6rem');
  });

  test('an explicit minColumnWidth wins over the size="sm" default', () => {
    const { container } = render(Wrapper, {
      ariaLabel: 'Choices',
      items,
      size: 'sm',
      minColumnWidth: '8rem',
    });
    const root = container.querySelector<HTMLElement>('.cinder-choice-grid');
    expect(root?.style.getPropertyValue('--cinder-grid-min-item-width')).toBe('8rem');
  });

  test('without size="sm", minColumnWidth keeps defaulting to 10rem', () => {
    const { container } = render(Wrapper, { ariaLabel: 'Choices', items });
    const root = container.querySelector<HTMLElement>('.cinder-choice-grid');
    expect(root?.style.getPropertyValue('--cinder-grid-min-item-width')).toBe('10rem');
  });
});
