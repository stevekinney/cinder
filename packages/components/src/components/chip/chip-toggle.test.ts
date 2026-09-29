/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: Chip } = await import('./chip.svelte');

afterEach(() => cleanup());

describe('Chip toggle mode', () => {
  test('toggle mode renders a button root with aria-pressed="false"', () => {
    const { container } = render(Chip, { mode: 'toggle', label: 'Filter', pressed: false });
    const chip = container.querySelector('.cinder-chip');
    expect(chip?.tagName.toLowerCase()).toBe('button');
    expect(chip?.getAttribute('aria-pressed')).toBe('false');
    expect(chip?.getAttribute('data-cinder-mode')).toBe('toggle');
  });

  test('toggle mode renders aria-pressed="true" when pressed=true', () => {
    const { container } = render(Chip, { mode: 'toggle', label: 'Filter', pressed: true });
    const chip = container.querySelector('.cinder-chip');
    expect(chip?.getAttribute('aria-pressed')).toBe('true');
  });

  test('toggle mode click calls onPressedChange with toggled value', async () => {
    const onPressedChange = mock((v: boolean) => v);
    const { container } = render(Chip, {
      mode: 'toggle',
      label: 'Filter',
      pressed: false,
      onPressedChange,
    });
    const chip = container.querySelector('button.cinder-chip')!;
    await fireEvent.click(chip);
    expect(onPressedChange).toHaveBeenCalledWith(true);
  });

  test('toggle mode consumer onclick fires first; preventDefault suppresses onPressedChange', async () => {
    const order: string[] = [];
    const onclick = mock((e: MouseEvent) => {
      order.push('onclick');
      e.preventDefault();
    });
    const onPressedChange = mock(() => {
      order.push('onPressedChange');
    });
    const { container } = render(Chip, {
      mode: 'toggle',
      label: 'Filter',
      pressed: false,
      onclick,
      onPressedChange,
    });
    await fireEvent.click(container.querySelector('button.cinder-chip')!);
    expect(order).toEqual(['onclick']);
    expect(onPressedChange).not.toHaveBeenCalled();
  });

  test('toggle mode disabled prevents onPressedChange', async () => {
    const onPressedChange = mock(() => {});
    const { container } = render(Chip, {
      mode: 'toggle',
      label: 'Filter',
      pressed: false,
      disabled: true,
      onPressedChange,
    });
    const button = container.querySelector('button.cinder-chip')!;
    expect(button.hasAttribute('disabled')).toBe(true);
    // fireEvent bypasses native disabled suppression; real browsers block the click entirely.
    await fireEvent.click(button);
    expect(onPressedChange).not.toHaveBeenCalled();
  });

  test('toggle mode forwards aria-label prop to the button', () => {
    const { container } = render(Chip, {
      mode: 'toggle',
      label: 'Filter',
      pressed: false,
      'aria-label': 'Toggle dark mode',
    });
    const chip = container.querySelector('button.cinder-chip');
    expect(chip?.getAttribute('aria-label')).toBe('Toggle dark mode');
  });

  test('toggle mode does not set aria-label when not provided', () => {
    const { container } = render(Chip, { mode: 'toggle', label: 'Filter', pressed: false });
    const chip = container.querySelector('button.cinder-chip');
    expect(chip?.getAttribute('aria-label')).toBeNull();
  });

  test('toggle mode empty aria-label prop is treated as absent', () => {
    const { container } = render(Chip, {
      mode: 'toggle',
      label: 'Filter',
      pressed: false,
      'aria-label': '',
    });
    const chip = container.querySelector('button.cinder-chip');
    expect(chip?.getAttribute('aria-label')).toBeNull();
  });
});
