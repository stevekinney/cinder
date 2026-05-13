/// <reference lib="dom" />
import { describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Chip } = await import('./chip.svelte');
const { createRawSnippet } = await import('svelte');

function iconSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<svg aria-hidden="true"><title>${text}</title></svg>`,
  }));
}

describe('Chip', () => {
  test('display mode renders a span root with data-cinder-mode="display"', () => {
    const { container } = render(Chip, { label: 'Hello' });
    const chip = container.querySelector('.cinder-chip');
    expect(chip?.tagName.toLowerCase()).toBe('span');
    expect(chip?.getAttribute('data-cinder-mode')).toBe('display');
    expect(chip?.querySelector('button')).toBeNull();
  });

  test('toggle mode renders a button root with aria-pressed="false"', () => {
    const { container } = render(Chip, { mode: 'toggle', label: 'Filter', pressed: false });
    const chip = container.querySelector('.cinder-chip');
    expect(chip?.tagName.toLowerCase()).toBe('button');
    expect(chip?.getAttribute('aria-pressed')).toBe('false');
    expect(chip?.getAttribute('data-cinder-mode')).toBe('toggle');
  });

  test('toggle mode click calls onpressedchange with toggled value', async () => {
    const onpressedchange = mock((v: boolean) => v);
    const { container } = render(Chip, {
      mode: 'toggle',
      label: 'Filter',
      pressed: false,
      onpressedchange,
    });
    const chip = container.querySelector('button.cinder-chip')!;
    await fireEvent.click(chip);
    expect(onpressedchange).toHaveBeenCalledWith(true);
  });

  test('toggle mode consumer onclick fires first; preventDefault suppresses onpressedchange', async () => {
    const order: string[] = [];
    const onclick = mock((e: MouseEvent) => {
      order.push('onclick');
      e.preventDefault();
    });
    const onpressedchange = mock(() => {
      order.push('onpressedchange');
    });
    const { container } = render(Chip, {
      mode: 'toggle',
      label: 'Filter',
      pressed: false,
      onclick,
      onpressedchange,
    });
    await fireEvent.click(container.querySelector('button.cinder-chip')!);
    expect(order).toEqual(['onclick']);
    expect(onpressedchange).not.toHaveBeenCalled();
  });

  test('toggle mode disabled prevents onpressedchange', async () => {
    const onpressedchange = mock(() => {});
    const { container } = render(Chip, {
      mode: 'toggle',
      label: 'Filter',
      pressed: false,
      disabled: true,
      onpressedchange,
    });
    const button = container.querySelector('button.cinder-chip')!;
    expect(button.hasAttribute('disabled')).toBe(true);
    await fireEvent.click(button);
    expect(onpressedchange).not.toHaveBeenCalled();
  });

  test('removable mode renders span root with remove button', () => {
    const { container } = render(Chip, { mode: 'removable', label: 'JavaScript' });
    const chip = container.querySelector('.cinder-chip');
    expect(chip?.tagName.toLowerCase()).toBe('span');
    expect(chip?.getAttribute('data-cinder-mode')).toBe('removable');
    const removeBtn = chip?.querySelector('button.cinder-chip__remove');
    expect(removeBtn).not.toBeNull();
    expect(removeBtn?.getAttribute('aria-label')).toBe('Remove JavaScript');
  });

  test('removable mode click calls onremove', async () => {
    const onremove = mock(() => {});
    const { container } = render(Chip, { mode: 'removable', label: 'JavaScript', onremove });
    await fireEvent.click(container.querySelector('button.cinder-chip__remove')!);
    expect(onremove).toHaveBeenCalledTimes(1);
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

  test('removable mode disabled prevents onremove', async () => {
    const onremove = mock(() => {});
    const { container } = render(Chip, {
      mode: 'removable',
      label: 'JavaScript',
      disabled: true,
      onremove,
    });
    const removeBtn = container.querySelector('button.cinder-chip__remove')!;
    expect(removeBtn.hasAttribute('disabled')).toBe(true);
    await fireEvent.click(removeBtn);
    expect(onremove).not.toHaveBeenCalled();
  });

  test('applies data-cinder-variant and data-cinder-size attributes', () => {
    const { container } = render(Chip, { label: 'Tag', variant: 'success', size: 'sm' });
    const chip = container.querySelector('.cinder-chip');
    expect(chip?.getAttribute('data-cinder-variant')).toBe('success');
    expect(chip?.getAttribute('data-cinder-size')).toBe('sm');
  });

  test('class prop merges with cinder-chip', () => {
    const { container } = render(Chip, { label: 'Tag', class: 'my-custom-class' });
    const chip = container.querySelector('.cinder-chip');
    expect(chip?.getAttribute('class')).toContain('cinder-chip');
    expect(chip?.getAttribute('class')).toContain('my-custom-class');
  });

  test('leadingIcon renders inside .cinder-chip__icon with aria-hidden', () => {
    const { container } = render(Chip, {
      label: 'Tag',
      leadingIcon: iconSnippet('star'),
    });
    const iconWrapper = container.querySelector('.cinder-chip__icon');
    expect(iconWrapper).not.toBeNull();
    expect(iconWrapper?.getAttribute('aria-hidden')).toBe('true');
    expect(iconWrapper?.querySelector('svg')).not.toBeNull();
  });

  test('forwards id and title attributes', () => {
    const { container } = render(Chip, {
      label: 'Tag',
      id: 'my-chip',
      title: 'My chip title',
    });
    const chip = container.querySelector('.cinder-chip');
    expect(chip?.getAttribute('id')).toBe('my-chip');
    expect(chip?.getAttribute('title')).toBe('My chip title');
  });

  test('forwards data-* attributes but not data-cinder-* overrides', () => {
    const { container } = render(Chip, {
      label: 'Tag',
      'data-test-id': 'chip-test',
      'data-cinder-variant': 'danger',
    } as any);
    const chip = container.querySelector('.cinder-chip');
    expect(chip?.getAttribute('data-test-id')).toBe('chip-test');
    expect(chip?.getAttribute('data-cinder-variant')).toBe('neutral');
  });

  test.each(['neutral', 'success', 'warning', 'danger', 'info', 'accent'] as const)(
    'renders data-cinder-variant="%s"',
    (variant) => {
      const { container } = render(Chip, { label: 'Tag', variant });
      const chip = container.querySelector('.cinder-chip');
      expect(chip?.getAttribute('data-cinder-variant')).toBe(variant);
    },
  );
});
