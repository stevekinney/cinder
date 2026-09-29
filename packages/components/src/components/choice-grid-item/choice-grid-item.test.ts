/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
// ChoiceGridItem requires the ChoiceGrid context, so it is exercised through a
// fixture that wraps it in a real ChoiceGrid parent.
const { default: Wrapper } = await import('../../test/fixtures/choice-grid-fixture.svelte');

afterEach(() => {
  cleanup();
});

const items = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B', disabled: true },
  { value: 'c', label: 'C', state: 'correct' as const },
];

describe('ChoiceGridItem', () => {
  test('renders role="radio" with aria-checked in single-select mode', () => {
    const { container } = render(Wrapper, { value: 'a', ariaLabel: 'Pick one', items });
    const first = container.querySelectorAll('[role="radio"]')[0];
    expect(first?.getAttribute('aria-checked')).toBe('true');
  });

  test('renders role="checkbox" in multi-select mode', () => {
    const { container } = render(Wrapper, {
      multiple: true,
      values: ['a'],
      ariaLabel: 'Pick some',
      items,
    });
    expect(container.querySelectorAll('[role="checkbox"]').length).toBe(items.length);
  });

  test('a disabled item carries aria-disabled and is not focusable', () => {
    const { container } = render(Wrapper, { ariaLabel: 'Pick one', items });
    const disabled = container.querySelectorAll('[role="radio"]')[1];
    expect(disabled?.getAttribute('aria-disabled')).toBe('true');
    expect(disabled?.getAttribute('tabindex')).toBe('-1');
  });

  test('a feedback state is stamped as data-cinder-state', () => {
    const { container } = render(Wrapper, { ariaLabel: 'Pick one', items });
    const correct = container.querySelectorAll('[role="radio"]')[2];
    expect(correct?.getAttribute('data-cinder-state')).toBe('correct');
  });

  test('neutral items omit the data-cinder-state attribute', () => {
    const { container } = render(Wrapper, { ariaLabel: 'Pick one', items });
    const neutral = container.querySelectorAll('[role="radio"]')[0];
    expect(neutral?.hasAttribute('data-cinder-state')).toBe(false);
  });

  test('clicking an item selects it', async () => {
    const { container } = render(Wrapper, { ariaLabel: 'Pick one', items });
    const second = requiredInstance(container.querySelectorAll('[role="radio"]')[0], HTMLElement);
    await fireEvent.click(second);
    expect(second.getAttribute('aria-checked')).toBe('true');
  });

  test('clicking a disabled item does not select it', async () => {
    const { container } = render(Wrapper, { ariaLabel: 'Pick one', items });
    const disabled = requiredInstance(container.querySelectorAll('[role="radio"]')[1], HTMLElement);
    await fireEvent.click(disabled);
    expect(disabled.getAttribute('aria-checked')).toBe('false');
  });

  test('renders its label content', () => {
    const { container } = render(Wrapper, { ariaLabel: 'Pick one', items });
    expect(container.querySelector('.cinder-choice-grid-item__content')?.textContent).toContain(
      'A',
    );
  });

  test('size="sm" is stamped as data-cinder-size, and states keep the same attribute', () => {
    const { container } = render(Wrapper, { ariaLabel: 'Pick one', items, size: 'sm' });
    const correct = container.querySelectorAll('[role="radio"]')[2];
    expect(correct?.getAttribute('data-cinder-size')).toBe('sm');
    expect(correct?.getAttribute('data-cinder-state')).toBe('correct');
  });
});

// ---------------------------------------------------------------------------
// Compact size CSS contract (COR-330)
//
// happy-dom performs no real layout, so the sizing contract itself — fine
// vs. coarse pointer block-size, and that no state rule changes cell
// dimensions — is asserted against the authored CSS text, the same pattern
// slider.test.ts uses for its disabled-state contrast contract.
// ---------------------------------------------------------------------------

describe('ChoiceGridItem size CSS contract', () => {
  const styles = readFileSync(new URL('./choice-grid-item.css', import.meta.url), 'utf8');

  test('fine pointer: size="sm" matches the button sm block-size, padding, and font-size tokens', () => {
    expect(styles).toMatch(
      /\.cinder-choice-grid-item\[data-cinder-size='sm'\]\s*\{[^}]*block-size:\s*var\(--cinder-button-height-sm\);/,
    );
    expect(styles).toMatch(
      /\.cinder-choice-grid-item\[data-cinder-size='sm'\]\s*\{[^}]*padding:\s*var\(--cinder-button-padding-y-sm\)\s*var\(--cinder-button-padding-x-sm\);/,
    );
    expect(styles).toMatch(
      /\.cinder-choice-grid-item\[data-cinder-size='sm'\] \.cinder-choice-grid-item__content\s*\{[^}]*font-size:\s*var\(--cinder-button-font-size-sm\);/,
    );
  });

  test('coarse pointer: size="sm" floors at a 44px touch target instead of the fine-pointer height', () => {
    const coarseBlock = styles.match(/@media \(pointer: coarse\)\s*\{([\s\S]*?)\n {2}\}/)?.[1];
    expect(coarseBlock, 'expected an @media (pointer: coarse) block').toBeDefined();
    expect(coarseBlock).toMatch(/min-block-size:\s*44px;/);
    expect(coarseBlock).toMatch(/min-inline-size:\s*44px;/);
  });

  test('no selection/hover/focus/disabled/feedback rule sets block-size, padding, or font-size', () => {
    // Every state selector in this stylesheet: selected, disabled, and the
    // three feedback states. `size="sm"`'s own rules are excluded by name.
    const stateSelectors = [
      /\.cinder-choice-grid-item:focus-visible\s*\{[^}]*\}/,
      /\.cinder-choice-grid-item\[data-cinder-selected\]\s*\{[^}]*\}/,
      /\.cinder-choice-grid-item\[data-cinder-disabled\]\s*\{[^}]*\}/,
      /\.cinder-choice-grid-item\[data-cinder-state='correct'\]\s*\{[^}]*\}/,
      /\.cinder-choice-grid-item\[data-cinder-state='incorrect'\]\s*\{[^}]*\}/,
      /\.cinder-choice-grid-item\[data-cinder-state='pending'\]\s*\{[^}]*\}/,
    ];
    for (const selector of stateSelectors) {
      const rule = styles.match(selector)?.[0];
      expect(rule, `expected to find rule for ${selector}`).toBeDefined();
      expect(rule).not.toMatch(/block-size:|padding:|font-size:/);
    }
  });
});
