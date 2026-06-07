/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

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
    const second = container.querySelectorAll('[role="radio"]')[0] as HTMLElement;
    await fireEvent.click(second);
    expect(second.getAttribute('aria-checked')).toBe('true');
  });

  test('clicking a disabled item does not select it', async () => {
    const { container } = render(Wrapper, { ariaLabel: 'Pick one', items });
    const disabled = container.querySelectorAll('[role="radio"]')[1] as HTMLElement;
    await fireEvent.click(disabled);
    expect(disabled.getAttribute('aria-checked')).toBe('false');
  });

  test('renders its label content', () => {
    const { container } = render(Wrapper, { ariaLabel: 'Pick one', items });
    expect(container.querySelector('.cinder-choice-grid-item__content')?.textContent).toContain(
      'A',
    );
  });
});
