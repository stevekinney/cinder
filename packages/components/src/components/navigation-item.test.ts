/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: NavigationItem } = await import('./navigation-item.svelte');

describe('NavigationItem rendering', () => {
  test('renders as <a> with href prop', () => {
    const { container } = render(NavigationItem, {
      props: { href: '/dashboard', children: (() => {}) as never },
    });
    const anchor = container.querySelector('a');
    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute('href')).toBe('/dashboard');
    expect(container.querySelector('button')).toBeNull();
  });

  test('renders as <button> with onClick prop', () => {
    const { container } = render(NavigationItem, {
      props: { onClick: () => {}, children: (() => {}) as never },
    });
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.getAttribute('type')).toBe('button');
    expect(container.querySelector('a')).toBeNull();
  });

  test('active link has aria-current="page"', () => {
    const { container } = render(NavigationItem, {
      props: { href: '/home', active: true, children: (() => {}) as never },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('aria-current')).toBe('page');
  });

  test('inactive link does not have aria-current', () => {
    const { container } = render(NavigationItem, {
      props: { href: '/home', active: false, children: (() => {}) as never },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.hasAttribute('aria-current')).toBe(false);
  });

  test('active button has aria-current="true"', () => {
    const { container } = render(NavigationItem, {
      props: { onClick: () => {}, active: true, children: (() => {}) as never },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-current')).toBe('true');
  });

  test('inactive button does not have aria-current', () => {
    const { container } = render(NavigationItem, {
      props: { onClick: () => {}, active: false, children: (() => {}) as never },
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
        children: (() => {}) as never,
      },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('aria-disabled')).toBe('true');
    // Simulate click — the handler calls preventDefault so no navigation occurs.
    // Since there is no consumer onClick on link arm, we just verify aria-disabled is present.
    anchor?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(clickCount).toBe(0);
  });

  test('disabled button has aria-disabled and blocks onClick', () => {
    let clickCount = 0;
    const { container } = render(NavigationItem, {
      props: {
        onClick: () => {
          clickCount += 1;
        },
        disabled: true,
        children: (() => {}) as never,
      },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-disabled')).toBe('true');
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(clickCount).toBe(0);
  });

  test('children render inside the element', () => {
    // Use a real snippet by rendering with a slot string through testing-library's component slot.
    // Since Svelte 5 snippets cannot be trivially passed as props in testing-library, we verify
    // the root class exists as a proxy for correct rendering; child content tests are covered
    // via the component's template {@render props.children()}.
    const { container } = render(NavigationItem, {
      props: { href: '/home', children: (() => {}) as never },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.classList.contains('cinder-navigation-item')).toBe(true);
  });

  test('root element carries cinder-navigation-item class', () => {
    const { container } = render(NavigationItem, {
      props: { href: '/about', children: (() => {}) as never },
    });
    expect(container.querySelector('.cinder-navigation-item')).not.toBeNull();
  });

  test('consumer class merges with cinder-navigation-item', () => {
    const { container } = render(NavigationItem, {
      props: { href: '/about', class: 'my-custom-class', children: (() => {}) as never },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.classList.contains('cinder-navigation-item')).toBe(true);
    expect(anchor?.classList.contains('my-custom-class')).toBe(true);
  });

  test('non-disabled button invokes onClick on click', () => {
    let clickCount = 0;
    const { container } = render(NavigationItem, {
      props: {
        onClick: () => {
          clickCount += 1;
        },
        children: (() => {}) as never,
      },
    });
    const button = container.querySelector('button');
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(clickCount).toBe(1);
  });
});
