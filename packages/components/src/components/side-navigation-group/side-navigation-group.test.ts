/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet, mount, unmount } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: SideNavigationGroup } = await import('./side-navigation-group.svelte');
const { default: SideNavigation } = await import('../side-navigation/side-navigation.svelte');
const { default: SideNavigationItem } =
  await import('../side-navigation-item/side-navigation-item.svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

function itemSnippet() {
  return createRawSnippet(() => ({
    render: () => `<li><a href="/test">Test</a></li>`,
    setup: () => {},
  }));
}

describe('SideNavigationGroup', () => {
  test('empty label throws on initial render', () => {
    expect(() => {
      render(SideNavigationGroup, {
        props: { label: '', children: itemSnippet() },
      });
    }).toThrow();
  });

  test('whitespace-only label throws on initial render', () => {
    expect(() => {
      render(SideNavigationGroup, {
        props: { label: '   ', children: itemSnippet() },
      });
    }).toThrow();
  });

  test('header trigger renders as <button type="button"> with label text', () => {
    const { container } = render(SideNavigationGroup, {
      props: { label: 'Settings', children: itemSnippet() },
    });
    const button = container.querySelector('button.cinder-side-navigation-group__trigger');
    expect(button).not.toBeNull();
    expect(button?.getAttribute('type')).toBe('button');
    expect(button?.textContent).toContain('Settings');
  });

  test('defaults to expanded=true: aria-expanded="true" and panel is visible', () => {
    const { container } = render(SideNavigationGroup, {
      props: { label: 'Settings', children: itemSnippet() },
    });
    const button = container.querySelector('.cinder-side-navigation-group__trigger');
    const panel = container.querySelector('.cinder-side-navigation-group__panel');
    expect(button?.getAttribute('aria-expanded')).toBe('true');
    expect(panel?.hasAttribute('hidden')).toBe(false);
  });

  test('defaults to expanded=true: data-cinder-expanded present on root <li>', () => {
    const { container } = render(SideNavigationGroup, {
      props: { label: 'Settings', children: itemSnippet() },
    });
    const li = container.querySelector('li.cinder-side-navigation-group');
    expect(li?.hasAttribute('data-cinder-expanded')).toBe(true);
  });

  test('expanded=false: aria-expanded="false", panel has hidden attribute, no data-cinder-expanded', () => {
    const { container } = render(SideNavigationGroup, {
      props: { label: 'Settings', expanded: false, children: itemSnippet() },
    });
    const button = container.querySelector('.cinder-side-navigation-group__trigger');
    const panel = container.querySelector('.cinder-side-navigation-group__panel');
    const li = container.querySelector('li.cinder-side-navigation-group');
    expect(button?.getAttribute('aria-expanded')).toBe('false');
    expect(panel?.hasAttribute('hidden')).toBe(true);
    expect(li?.hasAttribute('data-cinder-expanded')).toBe(false);
  });

  test('clicking trigger toggles aria-expanded from true to false', async () => {
    const { container } = render(SideNavigationGroup, {
      props: { label: 'Settings', children: itemSnippet() },
    });
    const button = container.querySelector(
      '.cinder-side-navigation-group__trigger',
    ) as HTMLButtonElement;
    expect(button?.getAttribute('aria-expanded')).toBe('true');
    await fireEvent.click(button);
    expect(button?.getAttribute('aria-expanded')).toBe('false');
  });

  test('clicking trigger toggles aria-expanded from false to true', async () => {
    const { container } = render(SideNavigationGroup, {
      props: { label: 'Settings', expanded: false, children: itemSnippet() },
    });
    const button = container.querySelector(
      '.cinder-side-navigation-group__trigger',
    ) as HTMLButtonElement;
    expect(button?.getAttribute('aria-expanded')).toBe('false');
    await fireEvent.click(button);
    expect(button?.getAttribute('aria-expanded')).toBe('true');
  });

  test('aria-controls on trigger equals id on panel <ul>', () => {
    const { container } = render(SideNavigationGroup, {
      props: { label: 'Settings', children: itemSnippet() },
    });
    const button = container.querySelector('.cinder-side-navigation-group__trigger');
    const panel = container.querySelector('.cinder-side-navigation-group__panel');
    const ariaControls = button?.getAttribute('aria-controls');
    expect(ariaControls).toBeTruthy();
    expect(ariaControls).toBe(panel?.id);
  });

  test('when id prop is provided, headerId and panelId are derived from it', () => {
    const { container } = render(SideNavigationGroup, {
      props: { label: 'Settings', id: 'my-group', children: itemSnippet() },
    });
    const button = container.querySelector('.cinder-side-navigation-group__trigger');
    const panel = container.querySelector('.cinder-side-navigation-group__panel');
    expect(button?.id).toBe('my-group-trigger');
    expect(panel?.id).toBe('my-group-panel');
    expect(button?.getAttribute('aria-controls')).toBe('my-group-panel');
  });

  test('when id prop is omitted, generated id still links trigger and panel', () => {
    const { container } = render(SideNavigationGroup, {
      props: { label: 'Settings', children: itemSnippet() },
    });
    const button = container.querySelector('.cinder-side-navigation-group__trigger');
    const panel = container.querySelector('.cinder-side-navigation-group__panel');
    expect(button?.id).toBeTruthy();
    expect(panel?.id).toBeTruthy();
    expect(button?.getAttribute('aria-controls')).toBe(panel?.id);
  });

  test('panel <ul> has aria-labelledby referencing trigger id', () => {
    const { container } = render(SideNavigationGroup, {
      props: { label: 'Settings', id: 'labeled-group', children: itemSnippet() },
    });
    const button = container.querySelector('.cinder-side-navigation-group__trigger');
    const panel = container.querySelector('.cinder-side-navigation-group__panel');
    expect(panel?.getAttribute('aria-labelledby')).toBe(button?.id);
  });

  test('disabled=true: trigger has disabled attribute', () => {
    const { container } = render(SideNavigationGroup, {
      props: { label: 'Settings', disabled: true, children: itemSnippet() },
    });
    const button = container.querySelector(
      '.cinder-side-navigation-group__trigger',
    ) as HTMLButtonElement;
    expect(button?.disabled).toBe(true);
  });

  test('disabled=true: clicking trigger does not change aria-expanded (defaults true)', async () => {
    const { container } = render(SideNavigationGroup, {
      props: { label: 'Settings', disabled: true, children: itemSnippet() },
    });
    const button = container.querySelector(
      '.cinder-side-navigation-group__trigger',
    ) as HTMLButtonElement;
    expect(button?.getAttribute('aria-expanded')).toBe('true');
    await fireEvent.click(button);
    expect(button?.getAttribute('aria-expanded')).toBe('true');
  });

  test('disabled=true: clicking trigger does not toggle when initially collapsed', async () => {
    const { container } = render(SideNavigationGroup, {
      props: { label: 'Settings', disabled: true, expanded: false, children: itemSnippet() },
    });
    const button = container.querySelector(
      '.cinder-side-navigation-group__trigger',
    ) as HTMLButtonElement;
    await fireEvent.click(button);
    expect(button?.getAttribute('aria-expanded')).toBe('false');
  });

  test('icon snippet renders inside .cinder-side-navigation-group__icon with aria-hidden', () => {
    const { container } = render(SideNavigationGroup, {
      props: { label: 'Settings', icon: textSnippet('icon'), children: itemSnippet() },
    });
    const iconWrapper = container.querySelector('.cinder-side-navigation-group__icon');
    expect(iconWrapper).not.toBeNull();
    expect(iconWrapper?.getAttribute('aria-hidden')).toBe('true');
    expect(iconWrapper?.textContent).toContain('icon');
  });

  test('badge snippet renders inside .cinder-side-navigation-group__badge', () => {
    const { container } = render(SideNavigationGroup, {
      props: { label: 'Settings', badge: textSnippet('3'), children: itemSnippet() },
    });
    const badge = container.querySelector('.cinder-side-navigation-group__badge');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain('3');
  });

  test('bind:expanded — clicking trigger calls the setter with the toggled value', async () => {
    let expandedValue = true;
    const { container } = render(SideNavigationGroup, {
      props: {
        label: 'Settings',
        get expanded() {
          return expandedValue;
        },
        set expanded(value: boolean) {
          expandedValue = value;
        },
        children: itemSnippet(),
      },
    });
    const button = container.querySelector(
      '.cinder-side-navigation-group__trigger',
    ) as HTMLButtonElement;
    await fireEvent.click(button);
    expect(expandedValue).toBe(false);
  });

  test('bind:expanded — parent-driven state change re-renders aria-expanded', async () => {
    let expandedValue = true;
    const { container, rerender } = render(SideNavigationGroup, {
      props: {
        label: 'Settings',
        get expanded() {
          return expandedValue;
        },
        set expanded(value: boolean) {
          expandedValue = value;
        },
        children: itemSnippet(),
      },
    });
    expandedValue = false;
    await rerender({
      label: 'Settings',
      get expanded() {
        return expandedValue;
      },
      set expanded(value: boolean) {
        expandedValue = value;
      },
      children: itemSnippet(),
    });
    const button = container.querySelector('.cinder-side-navigation-group__trigger');
    expect(button?.getAttribute('aria-expanded')).toBe('false');
  });

  test('composition smoke: SideNavigation + SideNavigationGroup produces valid markup', () => {
    const groupChildren = createRawSnippet(() => ({
      render: () => `<li class="item-wrapper"></li>`,
      setup: (node: Element) => {
        const instance = mount(SideNavigationItem, {
          target: node,
          props: {
            href: '/settings/general',
            children: createRawSnippet(() => ({
              render: () => `<span>General</span>`,
              setup: () => {},
            })),
          },
        });
        return () => unmount(instance);
      },
    }));

    const navChildren = createRawSnippet(() => ({
      render: () => `<div class="group-wrapper"></div>`,
      setup: (node: Element) => {
        const instance = mount(SideNavigationGroup, {
          target: node,
          props: {
            label: 'Settings',
            id: 'smoke-group',
            children: groupChildren,
          },
        });
        return () => unmount(instance);
      },
    }));

    const { container } = render(SideNavigation, {
      props: { ariaLabel: 'Sections', children: navChildren },
    });

    // Verify nav > ul structure
    expect(container.querySelector('nav.cinder-side-navigation')).not.toBeNull();
    expect(container.querySelector('nav > ul.cinder-side-navigation__list')).not.toBeNull();
    // Verify the group trigger is a button
    expect(
      container.querySelector('.cinder-side-navigation-group__trigger[type="button"]'),
    ).not.toBeNull();
    // Verify no duplication: leaf is the real NavigationItem anchor
    expect(container.querySelector('.cinder-navigation-item')).not.toBeNull();
  });
});

const { default: ContainsActiveHarness } = await import('./_contains-active-harness.svelte');

function groupRoot(container: HTMLElement): HTMLElement {
  return container.querySelector('li.cinder-side-navigation-group') as HTMLElement;
}

describe('SideNavigationGroup — contains-active', () => {
  test('group with one active child item sets data-cinder-contains-active', () => {
    const { container } = render(ContainsActiveHarness, {
      props: { firstActive: true },
    });
    expect(groupRoot(container).hasAttribute('data-cinder-contains-active')).toBe(true);
  });

  test('group with no active child does not set the attribute', () => {
    const { container } = render(ContainsActiveHarness, {
      props: {},
    });
    expect(groupRoot(container).hasAttribute('data-cinder-contains-active')).toBe(false);
  });

  test("toggling a child's active prop adds then removes the attribute", async () => {
    const { container, rerender } = render(ContainsActiveHarness, {
      props: { firstActive: false },
    });
    expect(groupRoot(container).hasAttribute('data-cinder-contains-active')).toBe(false);

    await rerender({ firstActive: true });
    expect(groupRoot(container).hasAttribute('data-cinder-contains-active')).toBe(true);

    await rerender({ firstActive: false });
    expect(groupRoot(container).hasAttribute('data-cinder-contains-active')).toBe(false);
  });

  test('attribute persists while any child active, clears only at zero', async () => {
    const { container, rerender } = render(ContainsActiveHarness, {
      props: { firstActive: true, secondActive: true },
    });
    expect(groupRoot(container).hasAttribute('data-cinder-contains-active')).toBe(true);

    // One goes inactive — still contains an active child.
    await rerender({ firstActive: true, secondActive: false });
    expect(groupRoot(container).hasAttribute('data-cinder-contains-active')).toBe(true);

    // Both inactive — clears.
    await rerender({ firstActive: false, secondActive: false });
    expect(groupRoot(container).hasAttribute('data-cinder-contains-active')).toBe(false);
  });

  test('contains-active attribute and label element are both present (CSS hook target)', () => {
    // happy-dom cannot resolve computed styles, so this asserts the DOM hooks
    // the CSS targets exist together — not the computed weight itself (the bold
    // treatment is verified visually).
    const { container } = render(ContainsActiveHarness, {
      props: { firstActive: true },
    });
    const root = groupRoot(container);
    expect(root.hasAttribute('data-cinder-contains-active')).toBe(true);
    expect(root.querySelector('.cinder-side-navigation-group__label')).not.toBeNull();
  });

  test('unmounting the only active child clears the attribute (unregister decrements)', async () => {
    const { container, rerender } = render(ContainsActiveHarness, {
      props: { firstActive: false, secondActive: true, showSecond: true },
    });
    expect(groupRoot(container).hasAttribute('data-cinder-contains-active')).toBe(true);

    // Unmount the active item — its cleanup must unregister and drop the count
    // to zero, clearing the attribute.
    await rerender({ firstActive: false, secondActive: true, showSecond: false });
    expect(groupRoot(container).hasAttribute('data-cinder-contains-active')).toBe(false);
  });

  test('unmounting one of two active children keeps the attribute (count stays > 0)', async () => {
    const { container, rerender } = render(ContainsActiveHarness, {
      props: { firstActive: true, secondActive: true, showSecond: true },
    });
    expect(groupRoot(container).hasAttribute('data-cinder-contains-active')).toBe(true);

    // Unmount one active item; the other active item keeps the count at 1.
    await rerender({ firstActive: true, secondActive: true, showSecond: false });
    expect(groupRoot(container).hasAttribute('data-cinder-contains-active')).toBe(true);
  });

  test('item mounting with active=true reports immediately (no reactive lag)', () => {
    // Regression for the initial-mount race: the attribute must be present on
    // first render, not only after a subsequent reactive cycle.
    const { container } = render(ContainsActiveHarness, {
      props: { firstActive: true },
    });
    expect(groupRoot(container).hasAttribute('data-cinder-contains-active')).toBe(true);
  });

  test('item outside a group does not throw (optional context)', () => {
    expect(() => {
      render(SideNavigationItem, {
        props: { href: '/solo', active: true, children: textSnippet('Solo') },
      });
    }).not.toThrow();
  });
});
