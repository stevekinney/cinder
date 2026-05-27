/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { default: Chip } = await import('./chip.svelte');
const { createRawSnippet } = await import('svelte');

const chipCss = await Bun.file(new URL('./chip.css', import.meta.url)).text();

afterEach(() => cleanup());

function iconSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<svg><title>${text}</title></svg>`,
  }));
}

function appendChipStyles() {
  const style = document.createElement('style');
  style.textContent = chipCss;
  document.head.append(style);
  return () => style.remove();
}

function rootSurface(chip: Element) {
  const style = getComputedStyle(chip);
  return {
    backgroundColor: style.backgroundColor,
    borderColor: style.borderColor,
    borderRadius: style.borderRadius,
  };
}

function cssRuleBody(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return chipCss.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`))?.[1] ?? '';
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

  test('toggle mode renders aria-pressed="true" when pressed=true', () => {
    const { container } = render(Chip, { mode: 'toggle', label: 'Filter', pressed: true });
    const chip = container.querySelector('.cinder-chip');
    expect(chip?.getAttribute('aria-pressed')).toBe('true');
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
    // fireEvent bypasses native disabled suppression; real browsers block the click entirely.
    await fireEvent.click(button);
    expect(onpressedchange).not.toHaveBeenCalled();
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

  test('all modes share the same root class without mode-specific surface classes', () => {
    const display = render(Chip, { label: 'Display chip' });
    const toggle = render(Chip, { mode: 'toggle', label: 'Toggle chip', pressed: false });
    const removable = render(Chip, { mode: 'removable', label: 'Removable chip' });

    const chips = [display.container, toggle.container, removable.container].map((container) => {
      const chip = container.querySelector('.cinder-chip');
      expect(chip).not.toBeNull();
      return chip as Element;
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

  test('removable mode disabled sets data-cinder-disabled on the root span', () => {
    const { container } = render(Chip, {
      mode: 'removable',
      label: 'JavaScript',
      disabled: true,
    });
    const chip = container.querySelector('.cinder-chip');
    expect(chip?.hasAttribute('data-cinder-disabled')).toBe(true);
  });

  test('applies data-cinder-variant and data-cinder-size attributes', () => {
    const { container } = render(Chip, { label: 'Tag', variant: 'success', size: 'sm' });
    const chip = container.querySelector('.cinder-chip');
    expect(chip?.getAttribute('data-cinder-variant')).toBe('success');
    expect(chip?.getAttribute('data-cinder-size')).toBe('sm');
  });

  test.each(['sm', 'md'] as const)('renders data-cinder-size="%s"', (size) => {
    const { container } = render(Chip, { label: 'Tag', size });
    const chip = container.querySelector('.cinder-chip');
    expect(chip?.getAttribute('data-cinder-size')).toBe(size);
  });

  test('class prop merges with cinder-chip', () => {
    const { container } = render(Chip, { label: 'Tag', class: 'my-custom-class' });
    const chip = container.querySelector('.cinder-chip');
    expect(chip?.getAttribute('class')).toContain('cinder-chip');
    expect(chip?.getAttribute('class')).toContain('my-custom-class');
  });

  test('leadingIcon renders inside .cinder-chip__icon with aria-hidden on the wrapper', () => {
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

  test('density="toolbar" sets data-cinder-density="toolbar" on the root', () => {
    const { container } = render(Chip, { label: 'Tag', density: 'toolbar' });
    const chip = container.querySelector('.cinder-chip');
    expect(chip?.getAttribute('data-cinder-density')).toBe('toolbar');
  });

  test('omitting density does not set data-cinder-density', () => {
    const { container } = render(Chip, { label: 'Tag' });
    const chip = container.querySelector('.cinder-chip');
    expect(chip?.hasAttribute('data-cinder-density')).toBe(false);
  });

  test('resting display, toggle, and removable roots share the same computed surface', () => {
    const removeChipStyles = appendChipStyles();
    try {
      const display = render(Chip, { label: 'Display chip' });
      const toggle = render(Chip, { mode: 'toggle', label: 'Toggle chip', pressed: false });
      const removable = render(Chip, { mode: 'removable', label: 'Removable chip' });

      const chips = [display.container, toggle.container, removable.container].map((container) => {
        const chip = container.querySelector('.cinder-chip');
        expect(chip).not.toBeNull();
        return chip as Element;
      });
      const surfaces = chips.map(rootSurface);

      expect(surfaces[1]).toEqual(surfaces[0]);
      expect(surfaces[2]).toEqual(surfaces[0]);
    } finally {
      removeChipStyles();
    }
  });

  test('neutral pressed toggle stays on the shared selected-surface recipe', () => {
    const body = cssRuleBody(".cinder-chip[aria-pressed='true'][data-cinder-variant='neutral']");
    expect(body).toContain('background: var(--cinder-surface-pressed)');
    expect(body).toContain('color: var(--cinder-text)');
    expect(body).toContain('border-color: var(--cinder-border-strong)');
    expect(body).not.toContain('background: var(--cinder-text)');
    expect(body).not.toContain('color: var(--cinder-surface-inset)');
  });

  test('remove button hover uses a circular hover surface without overriding variant color', () => {
    const body = cssRuleBody('.cinder-chip__remove:hover:not(:disabled)');
    expect(body).toContain('background-color: var(--cinder-surface-hover)');
    expect(body).not.toContain('color: var(--cinder-text)');
    expect(chipCss).toContain('border-radius: var(--cinder-radius-full)');
  });
});
