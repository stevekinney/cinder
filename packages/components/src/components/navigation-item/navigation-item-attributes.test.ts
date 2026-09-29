/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { createRawSnippet } = await import('svelte');
const { render, fireEvent } = await import('@testing-library/svelte');
const { default: NavigationItem } = await import('./navigation-item.svelte');
const { default: AttributeEdgeCases } =
  await import('./navigation-item-attribute-edge-cases.test.svelte');

function emptySnippet() {
  return createRawSnippet(() => ({
    render: () => '<span data-testid="navigation-item-content"></span>',
  }));
}

describe('NavigationItem native attribute passthrough', () => {
  test('link arm forwards data-testid to the anchor element', () => {
    const { container } = render(NavigationItem, {
      props: { href: '/home', 'data-testid': 'nav-home', children: emptySnippet() },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('data-testid')).toBe('nav-home');
  });

  test('button arm forwards data-testid to the button element', () => {
    const { container } = render(NavigationItem, {
      props: { onclick: () => {}, 'data-testid': 'nav-btn', children: emptySnippet() },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('data-testid')).toBe('nav-btn');
  });

  test('link arm forwards id to the anchor element', () => {
    const { container } = render(NavigationItem, {
      props: { href: '/about', id: 'nav-about', children: emptySnippet() },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('id')).toBe('nav-about');
  });

  test('button arm forwards id to the button element', () => {
    const { container } = render(NavigationItem, {
      props: { onclick: () => {}, id: 'nav-action', children: emptySnippet() },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('id')).toBe('nav-action');
  });

  test('link arm: component-controlled aria-current cannot be clobbered by rest', () => {
    const { container } = render(AttributeEdgeCases, { props: { mode: 'link-aria-current' } });
    const anchor = container.querySelector('a');
    // Component derives aria-current="page" from active=true; it overrides any consumer value.
    expect(anchor?.getAttribute('aria-current')).toBe('page');
  });

  test('button arm: component-controlled aria-current cannot be clobbered by rest', () => {
    const { container } = render(AttributeEdgeCases, { props: { mode: 'button-aria-current' } });
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-current')).toBe('page');
  });

  test('link arm: data-cinder-navigation-item is always present regardless of rest spread', () => {
    const { container } = render(NavigationItem, {
      props: { href: '/home', children: emptySnippet() },
    });
    expect(container.querySelector('a')?.hasAttribute('data-cinder-navigation-item')).toBe(true);
  });

  test('button arm: data-cinder-navigation-item is always present regardless of rest spread', () => {
    const { container } = render(NavigationItem, {
      props: { onclick: () => {}, children: emptySnippet() },
    });
    expect(container.querySelector('button')?.hasAttribute('data-cinder-navigation-item')).toBe(
      true,
    );
  });

  test('href={undefined} renders the button arm and clicking it does not throw', async () => {
    // The `href !== undefined` discriminant routes `href={undefined}` (a common SPA
    // `href={maybeRoute}` pattern) into the button arm. Without a consumer onclick the
    // click handler must not crash — the optional call guards against it.
    const { container } = render(AttributeEdgeCases, { props: { mode: 'undefined-href' } });
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    // Must not throw even though no onclick was provided.
    await fireEvent.click(requiredInstance(button, HTMLButtonElement));
    expect(button?.hasAttribute('data-cinder-navigation-item')).toBe(true);
  });

  test('enabled link honors a consumer-supplied tabindex', () => {
    const { container } = render(NavigationItem, {
      props: { href: '/home', tabindex: 0, children: emptySnippet() },
    });
    expect(container.querySelector('a')?.getAttribute('tabindex')).toBe('0');
  });

  test('disabled link forces tabindex=-1 over any consumer value', () => {
    const { container } = render(NavigationItem, {
      props: { href: '/home', disabled: true, tabindex: 0, children: emptySnippet() },
    });
    expect(container.querySelector('a')?.getAttribute('tabindex')).toBe('-1');
  });

  test('button arm renders type="button" and a consumer cannot override it via type', () => {
    const { container } = render(AttributeEdgeCases, { props: { mode: 'button-type' } });
    expect(container.querySelector('button')?.getAttribute('type')).toBe('button');
  });
});
