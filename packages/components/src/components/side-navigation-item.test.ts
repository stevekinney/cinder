/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: SideNavigationItem } = await import('./side-navigation-item.svelte');

function labelSnippet(text = 'Dashboard') {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

describe('SideNavigationItem', () => {
  test('renders <li class="cinder-side-navigation__item"> wrapping a NavigationItem', () => {
    const { container } = render(SideNavigationItem, {
      props: { href: '/dashboard', children: labelSnippet() },
    });
    const li = container.querySelector('li.cinder-side-navigation__item');
    expect(li).not.toBeNull();
    expect(li?.querySelector('.cinder-navigation-item')).not.toBeNull();
  });

  test('NavigationItem link arm: renders <a> inside the <li>', () => {
    const { container } = render(SideNavigationItem, {
      props: { href: '/settings', children: labelSnippet('Settings') },
    });
    const anchor = container.querySelector('li > a');
    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute('href')).toBe('/settings');
  });

  test('NavigationItem button arm: renders <button> inside the <li>', () => {
    const { container } = render(SideNavigationItem, {
      props: { onclick: () => {}, children: labelSnippet('Action') },
    });
    const button = container.querySelector('li > button');
    expect(button).not.toBeNull();
    expect(button?.getAttribute('type')).toBe('button');
  });

  test('forwards active prop to NavigationItem', () => {
    const { container } = render(SideNavigationItem, {
      props: { href: '/dashboard', active: true, children: labelSnippet() },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('aria-current')).toBe('page');
  });

  test('forwards disabled prop to NavigationItem', () => {
    const { container } = render(SideNavigationItem, {
      props: { href: '/admin', disabled: true, children: labelSnippet() },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('aria-disabled')).toBe('true');
  });

  test('forwards class prop to inner NavigationItem, not the <li>', () => {
    const { container } = render(SideNavigationItem, {
      props: { href: '/dashboard', class: 'custom-item', children: labelSnippet() },
    });
    const navItem = container.querySelector('.cinder-navigation-item');
    expect(navItem?.classList.contains('custom-item')).toBe(true);
    const li = container.querySelector('li');
    expect(li?.classList.contains('custom-item')).toBe(false);
  });

  test('listItemClass merges onto the outer <li>', () => {
    const { container } = render(SideNavigationItem, {
      props: { href: '/dashboard', listItemClass: 'pinned', children: labelSnippet() },
    });
    const li = container.querySelector('li');
    expect(li?.classList.contains('cinder-side-navigation__item')).toBe(true);
    expect(li?.classList.contains('pinned')).toBe(true);
  });

  test('cinder-navigation-item class present on the rendered NavigationItem', () => {
    const { container } = render(SideNavigationItem, {
      props: { href: '/dashboard', children: labelSnippet() },
    });
    expect(container.querySelector('.cinder-navigation-item')).not.toBeNull();
  });
});
