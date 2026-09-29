/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: Chip } = await import('./chip.svelte');
const { default: RuntimeChip } = await import('./chip-javascript-consumer.svelte');

afterEach(() => cleanup());

function iconSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<svg><title>${text}</title></svg>`,
  }));
}

describe('Chip attributes and ARIA', () => {
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
    });
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

  describe('native attribute passthrough', () => {
    test('display mode forwards aria-describedby to the root span', () => {
      const { container } = render(Chip, {
        label: 'Tag',
        'aria-describedby': 'hint-text',
      });
      const chip = container.querySelector('.cinder-chip');
      expect(chip?.getAttribute('aria-describedby')).toBe('hint-text');
    });

    test('display mode forwards tabindex to the root span', () => {
      const { container } = render(Chip, {
        label: 'Tag',
        tabindex: 0,
      });
      const chip = container.querySelector('.cinder-chip');
      expect(chip?.getAttribute('tabindex')).toBe('0');
    });

    test('display mode: consumer cannot clobber data-cinder-mode via native spread', () => {
      const { container } = render(Chip, {
        label: 'Tag',
        'data-cinder-mode': 'toggle',
      });
      const chip = container.querySelector('.cinder-chip');
      // Component's explicit data-cinder-mode="display" must override the spread value.
      expect(chip?.getAttribute('data-cinder-mode')).toBe('display');
    });

    test('toggle mode forwards aria-describedby to the root button', () => {
      const { container } = render(Chip, {
        mode: 'toggle',
        label: 'Filter',
        pressed: false,
        'aria-describedby': 'filter-hint',
      });
      const chip = container.querySelector('button.cinder-chip');
      expect(chip?.getAttribute('aria-describedby')).toBe('filter-hint');
    });

    test('toggle mode: consumer cannot clobber aria-pressed via native spread', () => {
      // `aria-pressed` is Omit-ted from ChipToggleProps (component-owned), so it's
      // Injected by the untyped JavaScript consumer fixture.
      const { container } = render(RuntimeChip, {
        props: {
          mode: 'toggle',
          label: 'Filter',
          pressed: true,
          'aria-pressed': 'false',
        },
      });
      const chip = container.querySelector('button.cinder-chip');
      // Component's explicit aria-pressed={pressed} (true) must override the spread value.
      expect(chip?.getAttribute('aria-pressed')).toBe('true');
    });

    test('toggle mode: consumer cannot turn the chip into a form submitter via type', () => {
      // `type` is Omit-ted and `type="button"` is rendered AFTER {...rest}, so a bypassed
      // `type="submit"` cannot make a toggle chip submit an enclosing form.
      const { container } = render(RuntimeChip, {
        props: {
          mode: 'toggle',
          label: 'Filter',
          pressed: false,
          type: 'submit',
        },
      });
      expect(container.querySelector('button.cinder-chip')?.getAttribute('type')).toBe('button');
    });

    test('removable mode forwards aria-describedby to the root span', () => {
      const { container } = render(Chip, {
        mode: 'removable',
        label: 'JavaScript',
        'aria-describedby': 'remove-hint',
      });
      const chip = container.querySelector('span.cinder-chip');
      expect(chip?.getAttribute('aria-describedby')).toBe('remove-hint');
    });

    test('removable mode forwards id to the root span', () => {
      const { container } = render(Chip, {
        mode: 'removable',
        label: 'JavaScript',
        id: 'chip-removable',
      });
      const chip = container.querySelector('span.cinder-chip');
      expect(chip?.getAttribute('id')).toBe('chip-removable');
    });
  });

  describe('Chip removable mode ARIA group', () => {
    test('outer span carries role=group and aria-label matching the label prop', () => {
      const { container } = render(Chip, { mode: 'removable', label: 'JavaScript' });
      const root = container.querySelector('[role="group"]');
      expect(root).not.toBeNull();
      expect(root?.tagName.toLowerCase()).toBe('span');
      expect(root?.getAttribute('aria-label')).toBe('JavaScript');
    });

    test('group aria-label matches the label prop value', () => {
      const { container } = render(Chip, { mode: 'removable', label: 'TypeScript' });
      const root = container.querySelector('span.cinder-chip');
      expect(root?.getAttribute('role')).toBe('group');
      expect(root?.getAttribute('aria-label')).toBe('TypeScript');
    });
  });
});
