/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: Chip } = await import('./chip.svelte');

afterEach(() => cleanup());

describe('Chip removable mode', () => {
  test('removable mode empty removeAriaLabel falls back to generated label', () => {
    const { container } = render(Chip, {
      mode: 'removable',
      label: 'JavaScript',
      removeAriaLabel: '',
    });
    const removeBtn = container.querySelector('button.cinder-chip__remove');
    expect(removeBtn?.getAttribute('aria-label')).toBe('Remove JavaScript');
  });

  test('removable mode renders span root with remove button', () => {
    const { container } = render(Chip, { mode: 'removable', label: 'JavaScript' });
    const chip = container.querySelector('.cinder-chip');
    expect(chip?.tagName.toLowerCase()).toBe('span');
    expect(chip?.getAttribute('data-cinder-mode')).toBe('removable');
    const removeBtn = chip?.querySelector('button.cinder-chip__remove');
    expect(removeBtn).not.toBeNull();
    expect(removeBtn?.getAttribute('type')).toBe('button');
    expect(removeBtn?.getAttribute('aria-label')).toBe('Remove JavaScript');
  });

  test('removable mode names its role="group" with the label by default', () => {
    const { container } = render(Chip, { mode: 'removable', label: 'JavaScript' });
    const chip = container.querySelector('.cinder-chip');
    expect(chip?.getAttribute('role')).toBe('group');
    expect(chip?.getAttribute('aria-label')).toBe('JavaScript');
  });

  // Regression: removable mode forwards `aria-label` through `rest` (it is not a
  // bespoke key). A consumer-supplied `aria-label` must win over the default
  // `label`-derived group name — an explicit `aria-label={label}` after the
  // spread silently clobbered it.
  test('removable mode lets a consumer-supplied aria-label override the default group name', () => {
    const { container } = render(Chip, {
      mode: 'removable',
      label: 'JavaScript',
      'aria-label': 'Programming language: JavaScript',
    });
    const chip = container.querySelector('.cinder-chip');
    expect(chip?.getAttribute('aria-label')).toBe('Programming language: JavaScript');
  });

  test('all modes share the same root class without mode-specific surface classes', () => {
    const display = render(Chip, { label: 'Display chip' });
    const toggle = render(Chip, { mode: 'toggle', label: 'Toggle chip', pressed: false });
    const removable = render(Chip, { mode: 'removable', label: 'Removable chip' });

    const chips = [display.container, toggle.container, removable.container].map((container) => {
      const chip = container.querySelector('.cinder-chip');
      expect(chip).not.toBeNull();
      return requiredInstance(chip, Element);
    });
    expect(chips).toHaveLength(3);
    expect(chips.map((chip) => chip.getAttribute('data-cinder-mode'))).toEqual([
      'display',
      'toggle',
      'removable',
    ]);
    expect(chips.every((chip) => chip.classList.contains('cinder-chip'))).toBe(true);
    expect(chips.flatMap((chip) => Array.from(chip.classList))).not.toContain('cinder-chip--mode');
    expect(chips.map((chip) => chip.tagName.toLowerCase())).toEqual(['span', 'button', 'span']);
  });

  test('removable mode click calls onRemove', async () => {
    const onRemove = mock(() => {});
    const { container } = render(Chip, { mode: 'removable', label: 'JavaScript', onRemove });
    await fireEvent.click(container.querySelector('button.cinder-chip__remove')!);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  test('removable mode respects removeAriaLabel', () => {
    const { container } = render(Chip, {
      mode: 'removable',
      label: 'JavaScript',
      removeAriaLabel: 'Dismiss JavaScript tag',
    });
    const removeBtn = container.querySelector('button.cinder-chip__remove');
    expect(removeBtn?.getAttribute('aria-label')).toBe('Dismiss JavaScript tag');
  });

  test('removable mode hides the remove glyph from assistive technology', () => {
    const { container } = render(Chip, { mode: 'removable', label: 'JavaScript' });
    const removeGlyph = container.querySelector('button.cinder-chip__remove span');
    expect(removeGlyph?.textContent).toBe('×');
    expect(removeGlyph?.getAttribute('aria-hidden')).toBe('true');
  });

  test('removable mode with empty label renders aria-label "Remove "', () => {
    const { container } = render(Chip, { mode: 'removable', label: '' });
    const removeBtn = container.querySelector('button.cinder-chip__remove');
    expect(removeBtn?.getAttribute('aria-label')).toBe('Remove ');
  });

  test('removable mode removeAriaLabel overrides even with empty label', () => {
    const { container } = render(Chip, {
      mode: 'removable',
      label: '',
      removeAriaLabel: 'Remove this item',
    });
    const removeBtn = container.querySelector('button.cinder-chip__remove');
    expect(removeBtn?.getAttribute('aria-label')).toBe('Remove this item');
  });

  test('removable mode disabled prevents onRemove', async () => {
    const onRemove = mock(() => {});
    const { container } = render(Chip, {
      mode: 'removable',
      label: 'JavaScript',
      disabled: true,
      onRemove,
    });
    const removeBtn = container.querySelector('button.cinder-chip__remove')!;
    expect(removeBtn.hasAttribute('disabled')).toBe(true);
    await fireEvent.click(removeBtn);
    expect(onRemove).not.toHaveBeenCalled();
  });

  test('removable mode disabled sets data-cinder-disabled on the root span', () => {
    const { container } = render(Chip, {
      mode: 'removable',
      label: 'JavaScript',
      disabled: true,
    });
    const chip = container.querySelector('.cinder-chip');
    expect(chip?.hasAttribute('data-cinder-disabled')).toBe(true);
  });
});
