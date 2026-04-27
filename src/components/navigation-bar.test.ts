/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: NavigationBar } = await import('./navigation-bar.svelte');
// createRawSnippet must be imported dynamically so Bun's svelte plugin (which patches
// the svelte package to resolve to the client build) applies before this import resolves.
const { createRawSnippet } = await import('svelte');

/** Creates a Svelte 5 Snippet that renders text content. */
function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

describe('NavigationBar', () => {
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
});
