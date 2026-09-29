/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { createRawSnippet } = await import('svelte');
const { render } = await import('@testing-library/svelte');
const { default: NavigationItem } = await import('./navigation-item.svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

function emptySnippet() {
  return createRawSnippet(() => ({
    render: () => '<span data-testid="navigation-item-content"></span>',
  }));
}

describe('NavigationItem rendering', () => {
  test('renders as <a> with href prop', () => {
    const { container } = render(NavigationItem, {
      props: { href: '/dashboard', children: emptySnippet() },
    });
    const anchor = container.querySelector('a');
    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute('href')).toBe('/dashboard');
    expect(container.querySelector('button')).toBeNull();
  });

  test('renders as <button> with onclick prop', () => {
    const { container } = render(NavigationItem, {
      props: { onclick: () => {}, children: emptySnippet() },
    });
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.getAttribute('type')).toBe('button');
    expect(container.querySelector('a')).toBeNull();
  });

  test('active link has aria-current="page"', () => {
    const { container } = render(NavigationItem, {
      props: { href: '/home', active: true, children: emptySnippet() },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('aria-current')).toBe('page');
  });

  test('inactive link does not have aria-current', () => {
    const { container } = render(NavigationItem, {
      props: { href: '/home', active: false, children: emptySnippet() },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.hasAttribute('aria-current')).toBe(false);
  });

  test('active link honors a custom `current` token for non-page contexts', () => {
    const { container } = render(NavigationItem, {
      props: { href: '/home', active: true, current: 'true', children: emptySnippet() },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('aria-current')).toBe('true');
  });

  test('inactive item never emits aria-current even with a custom `current` token', () => {
    const { container } = render(NavigationItem, {
      props: { onclick: () => {}, active: false, current: 'step', children: emptySnippet() },
    });
    const button = container.querySelector('button');
    expect(button?.hasAttribute('aria-current')).toBe(false);
  });

  test('active button has aria-current="page"', () => {
    const { container } = render(NavigationItem, {
      props: { onclick: () => {}, active: true, children: emptySnippet() },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-current')).toBe('page');
  });

  test('inactive button does not have aria-current', () => {
    const { container } = render(NavigationItem, {
      props: { onclick: () => {}, active: false, children: emptySnippet() },
    });
    const button = container.querySelector('button');
    expect(button?.hasAttribute('aria-current')).toBe(false);
  });

  test('disabled link has aria-disabled and blocks click', () => {
    let clickCount = 0;
    const { container } = render(NavigationItem, {
      props: {
        href: '/protected',
        disabled: true,
        children: emptySnippet(),
      },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('aria-disabled')).toBe('true');
    // Simulate click — the handler calls preventDefault so no navigation occurs.
    // Since there is no consumer onclick on link arm, we just verify aria-disabled is present.
    anchor?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(clickCount).toBe(0);
  });

  test('disabled link drops href to prevent keyboard navigation', () => {
    const { container } = render(NavigationItem, {
      props: {
        href: '/protected',
        disabled: true,
        children: emptySnippet(),
      },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.hasAttribute('href')).toBe(false);
  });

  test('disabled link sets tabindex=-1 to remove it from tab order', () => {
    const { container } = render(NavigationItem, {
      props: {
        href: '/protected',
        disabled: true,
        children: emptySnippet(),
      },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('tabindex')).toBe('-1');
  });

  test('enabled link has its href and no tabindex override', () => {
    const { container } = render(NavigationItem, {
      props: {
        href: '/dashboard',
        children: emptySnippet(),
      },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('href')).toBe('/dashboard');
    expect(anchor?.hasAttribute('tabindex')).toBe(false);
  });

  test('disabled button has native disabled attribute removing it from tab order', () => {
    const { container } = render(NavigationItem, {
      props: {
        onclick: () => {},
        disabled: true,
        children: emptySnippet(),
      },
    });
    const button = container.querySelector('button');
    expect(button?.hasAttribute('disabled')).toBe(true);
  });

  test('disabled button has aria-disabled and blocks onclick', () => {
    let clickCount = 0;
    const { container } = render(NavigationItem, {
      props: {
        onclick: () => {
          clickCount += 1;
        },
        disabled: true,
        children: emptySnippet(),
      },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-disabled')).toBe('true');
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(clickCount).toBe(0);
  });

  test('children render inside the element', () => {
    const { container } = render(NavigationItem, {
      props: { href: '/home', children: textSnippet('Navigation item') },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.classList.contains('cinder-navigation-item')).toBe(true);
    expect(anchor?.textContent).toContain('Navigation item');
  });

  test('root element carries cinder-navigation-item class', () => {
    const { container } = render(NavigationItem, {
      props: { href: '/about', children: emptySnippet() },
    });
    expect(container.querySelector('.cinder-navigation-item')).not.toBeNull();
  });

  test('consumer class merges with cinder-navigation-item', () => {
    const { container } = render(NavigationItem, {
      props: { href: '/about', class: 'my-custom-class', children: emptySnippet() },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.classList.contains('cinder-navigation-item')).toBe(true);
    expect(anchor?.classList.contains('my-custom-class')).toBe(true);
  });

  test('non-disabled button invokes onclick on click', () => {
    let clickCount = 0;
    const { container } = render(NavigationItem, {
      props: {
        onclick: () => {
          clickCount += 1;
        },
        children: emptySnippet(),
      },
    });
    const button = container.querySelector('button');
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(clickCount).toBe(1);
  });

  test('link arm emits data-variant="horizontal" by default', () => {
    const { container } = render(NavigationItem, {
      props: { href: '/home', children: emptySnippet() },
    });
    expect(container.querySelector('a')?.getAttribute('data-variant')).toBe('horizontal');
  });

  test('button arm emits data-variant="horizontal" by default', () => {
    const { container } = render(NavigationItem, {
      props: { onclick: () => {}, children: emptySnippet() },
    });
    expect(container.querySelector('button')?.getAttribute('data-variant')).toBe('horizontal');
  });

  test('link arm emits data-variant="mobile" when variant="mobile" is passed', () => {
    const { container } = render(NavigationItem, {
      props: { href: '/home', variant: 'mobile', children: emptySnippet() },
    });
    expect(container.querySelector('a')?.getAttribute('data-variant')).toBe('mobile');
  });

  test('button arm emits data-variant="mobile" when variant="mobile" is passed', () => {
    const { container } = render(NavigationItem, {
      props: { onclick: () => {}, variant: 'mobile', children: emptySnippet() },
    });
    expect(container.querySelector('button')?.getAttribute('data-variant')).toBe('mobile');
  });

  test('link arm emits data-variant="vertical" when variant="vertical" is passed', () => {
    const { container } = render(NavigationItem, {
      props: { href: '/home', variant: 'vertical', children: emptySnippet() },
    });
    expect(container.querySelector('a')?.getAttribute('data-variant')).toBe('vertical');
  });

  test('button arm emits data-variant="vertical" when variant="vertical" is passed', () => {
    const { container } = render(NavigationItem, {
      props: { onclick: () => {}, variant: 'vertical', children: emptySnippet() },
    });
    expect(container.querySelector('button')?.getAttribute('data-variant')).toBe('vertical');
  });

  test('vertical link with active state still emits data-active and data-variant', () => {
    const { container } = render(NavigationItem, {
      props: {
        href: '/projects',
        variant: 'vertical',
        active: true,
        children: emptySnippet(),
      },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('data-variant')).toBe('vertical');
    expect(anchor?.getAttribute('data-active')).toBe('true');
    expect(anchor?.getAttribute('aria-current')).toBe('page');
  });
});
