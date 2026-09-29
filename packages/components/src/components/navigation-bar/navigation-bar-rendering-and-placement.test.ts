/// <reference lib="dom" />
import { setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { textSnippet } from './navigation-bar-snippet-helpers.ts';
setupHappyDom();
const { render, cleanup } = await import('@testing-library/svelte');
const { resetEscapeStack } = await import('../../_internal/overlay.ts');
const { default: NavigationBar } = await import('./navigation-bar.svelte');

const navigationBarSource = readFileSync(
  new URL('./navigation-bar.svelte', import.meta.url),
  'utf8',
);
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  resetEscapeStack();
});

afterEach(() => cleanup());

describe('NavigationBar', () => {
  test('guards responsive portal focus and effective disabled targets', () => {
    expect(navigationBarSource).toContain("item.matches(':disabled')");
    expect(navigationBarSource).toContain('pendingTabFocus');
    expect(navigationBarSource).toContain('pendingTabFocusTarget');
    expect(navigationBarSource).toContain(
      'isMobileLayout && (mobileMenuOpen || exitState.renderPanel)',
    );
    expect(navigationBarSource).toContain(
      "classNames('cinder-navigation-bar__portal-scope', 'cinder-navigation-bar', className)",
    );
    expect(navigationBarSource).toContain("window.addEventListener('resize'");
  });
  test('omits toggle handlers during SSR and supplies them after hydration', () => {
    expect([
      ...navigationBarSource.matchAll(
        /\.\.\.\(browser \? \{ onclick: handleToggle, onkeydown: handleToggleKeyDown \} : \{\}\)/g,
      ),
    ]).toHaveLength(2);
    expect(navigationBarSource).not.toContain('onclick: browser ? handleToggle : undefined');
  });

  // ── Legacy tests (preserved) ────────────────────────────────────────────

  test('root element is <nav>', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('nav items'),
    });
    expect(container.querySelector('nav')).not.toBeNull();
  });

  test('renders items snippet', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('my nav items'),
    });
    expect(container.querySelector('.cinder-navigation-bar__items')?.textContent).toContain(
      'my nav items',
    );
  });

  test('renders brand snippet when provided', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      brand: textSnippet('my brand'),
    });
    expect(container.querySelector('.cinder-navigation-bar__brand')?.textContent).toContain(
      'my brand',
    );
  });

  test('does not render brand section when brand is not provided', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
    });
    expect(container.querySelector('.cinder-navigation-bar__brand')).toBeNull();
  });

  test('renders actions snippet when provided', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      actions: textSnippet('my actions'),
    });
    expect(container.querySelector('.cinder-navigation-bar__actions')?.textContent).toContain(
      'my actions',
    );
  });

  test('does not render actions section when actions is not provided', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
    });
    expect(container.querySelector('.cinder-navigation-bar__actions')).toBeNull();
  });

  test('applies class prop alongside cinder-navigation-bar', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      class: 'my-custom-class',
    });
    const nav = container.querySelector('nav');
    expect(nav?.getAttribute('class')).toContain('cinder-navigation-bar');
    expect(nav?.getAttribute('class')).toContain('my-custom-class');
  });

  test('spreads rest attributes onto <nav>', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      id: 'main-nav',
    });
    expect(container.querySelector('nav')?.getAttribute('id')).toBe('main-nav');
  });

  // ── label prop ────────────────────────────────────────────────────

  test('label defaults to "Main navigation"', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
    });
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Main navigation');
  });

  test('label prop is applied to <nav>', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      label: 'Site navigation',
    });
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Site navigation');
  });

  test('rest-prop aria-label does not override label', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      label: 'Primary nav',
      'aria-label': 'Should be ignored',
    });
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Primary nav');
  });

  // ── Rest props forwarding ────────────────────────────────────────────────

  test('rest props are forwarded: id, data-foo, and custom class all appear on <nav>', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      id: 'my-nav',
      'data-foo': 'bar',
      class: 'extra-class',
    });
    const nav = container.querySelector('nav');
    expect(nav?.getAttribute('id')).toBe('my-nav');
    expect(nav?.getAttribute('data-foo')).toBe('bar');
    expect(nav?.getAttribute('class')).toContain('cinder-navigation-bar');
    expect(nav?.getAttribute('class')).toContain('extra-class');
  });

  // ── Without menuToggle ───────────────────────────────────────────────────

  test('without menuToggle, no toggle wrapper is rendered and data-collapsible is false', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
    });
    expect(container.querySelector('.cinder-navigation-bar__menu-toggle')).toBeNull();
    expect(container.querySelector('nav')?.getAttribute('data-collapsible')).toBe('false');
  });

  test('without menuToggle, no MutationObserver is attached to watch source availability', () => {
    // Regression test: `observePortalSourceAvailability` used to run for every mounted
    // NavigationBar, even ones that can never enter mobile/portal layout because
    // `menuToggle` is undefined (`isCollapsible` is false). That attached an unnecessary
    // MutationObserver on desktop/non-collapsible variants.
    const originalMutationObserver = globalThis.MutationObserver;
    let constructedCount = 0;
    class CountingMutationObserver extends originalMutationObserver {
      constructor(...args: ConstructorParameters<typeof MutationObserver>) {
        super(...args);
        constructedCount += 1;
      }
    }
    globalThis.MutationObserver = CountingMutationObserver;

    try {
      render(NavigationBar, { items: textSnippet('items') });
      expect(constructedCount).toBe(0);
    } finally {
      globalThis.MutationObserver = originalMutationObserver;
    }
  });
});
