/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: SideNavigation } = await import('./side-navigation.svelte');

function emptySnippet() {
  return createRawSnippet(() => ({
    render: () => `<li></li>`,
    setup: () => {},
  }));
}

describe('SideNavigation', () => {
  test('renders a <nav> element', () => {
    const { container } = render(SideNavigation, {
      props: { ariaLabel: 'Sections', children: emptySnippet() },
    });
    expect(container.querySelector('nav')).not.toBeNull();
  });

  test('nav has aria-label matching the ariaLabel prop', () => {
    const { container } = render(SideNavigation, {
      props: { ariaLabel: 'Workspace', children: emptySnippet() },
    });
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Workspace');
  });

  test('empty ariaLabel throws on initial render', () => {
    expect(() => {
      render(SideNavigation, {
        props: { ariaLabel: '', children: emptySnippet() },
      });
    }).toThrow();
  });

  test('whitespace-only ariaLabel throws on initial render', () => {
    expect(() => {
      render(SideNavigation, {
        props: { ariaLabel: '   ', children: emptySnippet() },
      });
    }).toThrow();
  });

  test('renders a <ul> with class cinder-side-navigation__list', () => {
    const { container } = render(SideNavigation, {
      props: { ariaLabel: 'Sections', children: emptySnippet() },
    });
    const list = container.querySelector('ul.cinder-side-navigation__list');
    expect(list).not.toBeNull();
  });

  test('nav carries cinder-side-navigation class', () => {
    const { container } = render(SideNavigation, {
      props: { ariaLabel: 'Sections', children: emptySnippet() },
    });
    expect(container.querySelector('nav.cinder-side-navigation')).not.toBeNull();
  });

  test('consumer class prop merges onto the <nav>', () => {
    const { container } = render(SideNavigation, {
      props: { ariaLabel: 'Sections', class: 'my-nav', children: emptySnippet() },
    });
    const nav = container.querySelector('nav');
    expect(nav?.classList.contains('cinder-side-navigation')).toBe(true);
    expect(nav?.classList.contains('my-nav')).toBe(true);
  });

  test('rest attributes spread onto the <nav>', () => {
    const { container } = render(SideNavigation, {
      props: {
        ariaLabel: 'Sections',
        'data-testid': 'side-nav',
        children: emptySnippet(),
      } as never,
    });
    expect(container.querySelector('nav')?.getAttribute('data-testid')).toBe('side-nav');
  });

  test('children snippet renders inside the <ul>', () => {
    const snippet = createRawSnippet(() => ({
      render: () => `<li class="test-child"></li>`,
      setup: () => {},
    }));
    const { container } = render(SideNavigation, {
      props: { ariaLabel: 'Sections', children: snippet },
    });
    const list = container.querySelector('ul.cinder-side-navigation__list');
    expect(list?.querySelector('.test-child')).not.toBeNull();
  });

  test('aria-label in rest spread cannot override the required ariaLabel prop', () => {
    // Cast through unknown to simulate an untyped JS consumer passing aria-label in rest.
    const { container } = render(SideNavigation, {
      props: {
        ariaLabel: 'Sections',
        'aria-label': 'Overridden',
        children: emptySnippet(),
      } as unknown as Parameters<typeof render>[1]['props'],
    });
    // The component writes aria-label={validatedLabel} after {...rest}, so the required
    // label always wins.
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Sections');
  });
});
