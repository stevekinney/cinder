/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent, waitFor } = await import('@testing-library/svelte');
const { default: AvatarGroup } = await import('./avatar-group.svelte');
const { AvatarGroup: RootAvatarGroup } = await import('../../index.ts');

const collaborators = [
  { id: 'ada', name: 'Ada Lovelace', src: '/ada.png' },
  { id: 'grace', name: 'Grace Hopper', src: '/grace.png' },
  { id: 'katherine', name: 'Katherine Johnson', src: '/katherine.png' },
  { id: 'dorothy', name: 'Dorothy Vaughan', src: '/dorothy.png' },
  { id: 'mary', name: 'Mary Jackson', src: '/mary.png' },
  { id: 'annie', name: 'Annie Easley', src: '/annie.png' },
];

function itemElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.cinder-avatar-group__item'));
}

function avatarItems(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      '.cinder-avatar-group__item:not(.cinder-avatar-group__overflow)',
    ),
  );
}

describe('AvatarGroup', () => {
  test('renders five visible avatars and one overflow indicator by default', () => {
    const { container, getByRole } = render(AvatarGroup, { avatars: collaborators });

    expect(avatarItems(container)).toHaveLength(5);
    expect(getByRole('listitem', { name: '1 more collaborators' }).textContent?.trim()).toBe('+1');
  });

  test('honors maxVisible and reports the hidden count', () => {
    const { container, getByRole } = render(AvatarGroup, {
      avatars: collaborators,
      maxVisible: 3,
    });

    expect(avatarItems(container)).toHaveLength(3);
    expect(getByRole('listitem', { name: '3 more collaborators' }).textContent?.trim()).toBe('+3');
  });

  test('renders only overflow when maxVisible normalizes to zero', () => {
    const { container, getByRole } = render(AvatarGroup, {
      avatars: collaborators,
      maxVisible: 0,
    });

    expect(avatarItems(container)).toHaveLength(0);
    expect(itemElements(container)).toHaveLength(1);
    expect(getByRole('listitem', { name: '6 more collaborators' }).textContent?.trim()).toBe('+6');
  });

  test('falls back to default maxVisible for non-finite values', async () => {
    const { container, rerender } = render(AvatarGroup, {
      avatars: collaborators,
      maxVisible: Number.NaN,
    });

    expect(avatarItems(container)).toHaveLength(5);
    await rerender({ avatars: collaborators, maxVisible: Number.POSITIVE_INFINITY });
    expect(avatarItems(container)).toHaveLength(5);
  });

  test('renders duplicate names without ids as distinct items and tooltips', async () => {
    const { container } = render(AvatarGroup, {
      avatars: [{ name: 'Alex Kim' }, { name: 'Alex Kim' }],
    });

    const triggers = container.querySelectorAll<HTMLElement>('.cinder-avatar-group__trigger');
    const tooltips = container.querySelectorAll<HTMLElement>('[role="tooltip"]');
    expect(triggers).toHaveLength(2);
    expect(tooltips).toHaveLength(2);
    expect(tooltips[0]?.id).not.toBe(tooltips[1]?.id);
  });

  test('forwards size and shape to the root and child avatars', () => {
    const { container } = render(AvatarGroup, {
      avatars: collaborators.slice(0, 2),
      size: 'lg',
      shape: 'square',
    });

    const root = container.querySelector<HTMLElement>('.cinder-avatar-group');
    const avatars = container.querySelectorAll<HTMLElement>('.cinder-avatar');
    expect(root?.getAttribute('data-cinder-size')).toBe('lg');
    expect(root?.getAttribute('data-cinder-shape')).toBe('square');
    expect(avatars[0]?.getAttribute('data-cinder-size')).toBe('lg');
    expect(avatars[0]?.getAttribute('data-cinder-shape')).toBe('square');
  });

  test('sets the overlap custom property while preserving caller styles', () => {
    const { container } = render(AvatarGroup, {
      avatars: collaborators.slice(0, 2),
      overlap: '0.75rem',
      style: 'color: red;',
    });

    const root = container.querySelector<HTMLElement>('.cinder-avatar-group');
    expect(root?.getAttribute('style')).toContain('--cinder-avatar-group-overlap: 0.75rem');
    expect(root?.getAttribute('style')).toContain('color: red');
  });

  test('computes deterministic first-on-top and last-on-top z-index values', async () => {
    const { container, rerender } = render(AvatarGroup, {
      avatars: collaborators.slice(0, 3),
      zOrder: 'first-on-top',
    });

    expect(
      avatarItems(container).map((item) =>
        item.style.getPropertyValue('--cinder-avatar-group-index'),
      ),
    ).toEqual(['3', '2', '1']);

    await rerender({ avatars: collaborators.slice(0, 3), zOrder: 'last-on-top' });
    expect(
      avatarItems(container).map((item) =>
        item.style.getPropertyValue('--cinder-avatar-group-index'),
      ),
    ).toEqual(['1', '2', '3']);
  });

  test('uses terminal overflow stack value except for overflow-only mode', async () => {
    const { container, rerender } = render(AvatarGroup, {
      avatars: collaborators,
      maxVisible: 3,
    });

    expect(
      container
        .querySelector<HTMLElement>('.cinder-avatar-group__overflow')
        ?.style.getPropertyValue('--cinder-avatar-group-index'),
    ).toBe('4');

    await rerender({ avatars: collaborators, maxVisible: 0 });
    expect(
      container
        .querySelector<HTMLElement>('.cinder-avatar-group__overflow')
        ?.style.getPropertyValue('--cinder-avatar-group-index'),
    ).toBe('0');
  });

  test('uses the lowest overflow stack value when the first avatar is on top', () => {
    const { container } = render(AvatarGroup, {
      avatars: collaborators,
      maxVisible: 3,
      zOrder: 'first-on-top',
    });

    expect(
      container
        .querySelector<HTMLElement>('.cinder-avatar-group__overflow')
        ?.style.getPropertyValue('--cinder-avatar-group-index'),
    ).toBe('0');
  });

  test('wires each named avatar trigger to a tooltip with the collaborator name', async () => {
    const { container } = render(AvatarGroup, { avatars: collaborators.slice(0, 2) });

    await waitFor(() => {
      const triggers = container.querySelectorAll<HTMLElement>('.cinder-avatar-group__trigger');
      const tooltips = container.querySelectorAll<HTMLElement>('[role="tooltip"]');

      expect(triggers).toHaveLength(2);
      expect(tooltips).toHaveLength(2);
      triggers.forEach((trigger, index) => {
        const tooltip = tooltips[index];
        expect(tooltip?.getAttribute('role')).toBe('tooltip');
        expect(tooltip?.textContent?.trim()).toBeTruthy();
        expect(trigger.hasAttribute('aria-label')).toBe(false);
        expect(trigger.hasAttribute('aria-describedby')).toBe(false);
      });
    });
  });

  test('shows a named avatar tooltip on focus and hides it on Escape', async () => {
    const { container } = render(AvatarGroup, { avatars: collaborators.slice(0, 1) });

    const trigger = container.querySelector<HTMLElement>('.cinder-avatar-group__trigger');
    expect(trigger).not.toBeNull();
    trigger?.focus();
    await fireEvent.focusIn(trigger!);

    await waitFor(() => {
      const tooltip = container.querySelector<HTMLElement>('[role="tooltip"]');
      expect(tooltip?.getAttribute('aria-hidden')).toBe('false');
    });

    await fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      const tooltip = container.querySelector<HTMLElement>('[role="tooltip"]');
      expect(tooltip?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  test('raises the focused item above overlapped siblings', async () => {
    const css = await Bun.file(new URL('./avatar-group.css', import.meta.url)).text();

    expect(css).toContain('.cinder-avatar-group__item:focus-within');
    expect(css).toContain('z-index: calc(var(--cinder-avatar-group-index, 0) + 100);');
  });

  test('malformed runtime items without a name render without a tooltip', () => {
    const { container } = render(AvatarGroup, {
      avatars: [{ id: 'missing-name' } as unknown as (typeof collaborators)[number]],
    });

    const trigger = container.querySelector<HTMLElement>('.cinder-avatar-group__trigger');
    expect(trigger).not.toBeNull();
    expect(trigger?.hasAttribute('tabindex')).toBe(false);
    expect(trigger?.hasAttribute('aria-label')).toBe(false);
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
  });

  test('keeps tooltip nodes inside listitems and only listitems directly under the list', () => {
    const { container } = render(AvatarGroup, { avatars: collaborators.slice(0, 2) });

    const list = container.querySelector<HTMLElement>('.cinder-avatar-group');
    expect(list?.getAttribute('role')).toBe('list');
    for (const child of Array.from(list?.children ?? [])) {
      expect(child.getAttribute('role')).toBe('listitem');
    }
    for (const tooltip of container.querySelectorAll('[role="tooltip"]')) {
      expect(tooltip.closest('[role="listitem"]')).not.toBeNull();
    }
  });

  test('does not create a focusable tooltip trigger for an empty trimmed name', () => {
    const { container } = render(AvatarGroup, { avatars: [{ name: '   ' }] });

    const trigger = container.querySelector<HTMLElement>('.cinder-avatar-group__trigger');
    expect(trigger?.hasAttribute('tabindex')).toBe(false);
    expect(trigger?.hasAttribute('aria-label')).toBe(false);
    expect(trigger?.hasAttribute('aria-describedby')).toBe(false);
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
  });

  test('keeps exactly one accessible name on overflow indicators', () => {
    const { getByRole } = render(AvatarGroup, {
      avatars: collaborators,
      maxVisible: 1,
      overflowLabel: 'Hidden collaborators',
    });

    expect(getByRole('listitem', { name: 'Hidden collaborators' }).textContent?.trim()).toBe('+5');
  });

  test('merges custom class and prevents rest props from overriding fixed role', () => {
    const { container } = render(AvatarGroup, {
      avatars: collaborators.slice(0, 1),
      class: 'custom-avatar-group',
      role: 'presentation',
      'data-test-id': 'collaborators',
    });

    const root = container.querySelector<HTMLElement>('.cinder-avatar-group');
    expect(root?.classList.contains('custom-avatar-group')).toBe(true);
    expect(root?.getAttribute('role')).toBe('list');
    expect(root?.getAttribute('data-test-id')).toBe('collaborators');
  });

  test('root barrel exports AvatarGroup', () => {
    expect(RootAvatarGroup).toBe(AvatarGroup);
  });
});
