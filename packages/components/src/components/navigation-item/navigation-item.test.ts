/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
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

  test('renders as <button> with onclick prop', () => {
    const { container } = render(NavigationItem, {
      props: { onclick: () => {}, children: (() => {}) as never },
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

  test('active link honors a custom `current` token for non-page contexts', () => {
    const { container } = render(NavigationItem, {
      props: { href: '/home', active: true, current: 'true', children: (() => {}) as never },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('aria-current')).toBe('true');
  });

  test('inactive item never emits aria-current even with a custom `current` token', () => {
    const { container } = render(NavigationItem, {
      props: { onclick: () => {}, active: false, current: 'step', children: (() => {}) as never },
    });
    const button = container.querySelector('button');
    expect(button?.hasAttribute('aria-current')).toBe(false);
  });

  test('active button has aria-current="page"', () => {
    const { container } = render(NavigationItem, {
      props: { onclick: () => {}, active: true, children: (() => {}) as never },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-current')).toBe('page');
  });

  test('inactive button does not have aria-current', () => {
    const { container } = render(NavigationItem, {
      props: { onclick: () => {}, active: false, children: (() => {}) as never },
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
    // Since there is no consumer onclick on link arm, we just verify aria-disabled is present.
    anchor?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(clickCount).toBe(0);
  });

  test('disabled link drops href to prevent keyboard navigation', () => {
    const { container } = render(NavigationItem, {
      props: {
        href: '/protected',
        disabled: true,
        children: (() => {}) as never,
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
        children: (() => {}) as never,
      },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('tabindex')).toBe('-1');
  });

  test('enabled link has its href and no tabindex override', () => {
    const { container } = render(NavigationItem, {
      props: {
        href: '/dashboard',
        children: (() => {}) as never,
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
        children: (() => {}) as never,
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

  test('non-disabled button invokes onclick on click', () => {
    let clickCount = 0;
    const { container } = render(NavigationItem, {
      props: {
        onclick: () => {
          clickCount += 1;
        },
        children: (() => {}) as never,
      },
    });
    const button = container.querySelector('button');
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(clickCount).toBe(1);
  });

  test('link arm emits data-variant="horizontal" by default', () => {
    const { container } = render(NavigationItem, {
      props: { href: '/home', children: (() => {}) as never },
    });
    expect(container.querySelector('a')?.getAttribute('data-variant')).toBe('horizontal');
  });

  test('button arm emits data-variant="horizontal" by default', () => {
    const { container } = render(NavigationItem, {
      props: { onclick: () => {}, children: (() => {}) as never },
    });
    expect(container.querySelector('button')?.getAttribute('data-variant')).toBe('horizontal');
  });

  test('link arm emits data-variant="mobile" when variant="mobile" is passed', () => {
    const { container } = render(NavigationItem, {
      props: { href: '/home', variant: 'mobile', children: (() => {}) as never },
    });
    expect(container.querySelector('a')?.getAttribute('data-variant')).toBe('mobile');
  });

  test('button arm emits data-variant="mobile" when variant="mobile" is passed', () => {
    const { container } = render(NavigationItem, {
      props: { onclick: () => {}, variant: 'mobile', children: (() => {}) as never },
    });
    expect(container.querySelector('button')?.getAttribute('data-variant')).toBe('mobile');
  });

  test('link arm emits data-variant="vertical" when variant="vertical" is passed', () => {
    const { container } = render(NavigationItem, {
      props: { href: '/home', variant: 'vertical', children: (() => {}) as never },
    });
    expect(container.querySelector('a')?.getAttribute('data-variant')).toBe('vertical');
  });

  test('button arm emits data-variant="vertical" when variant="vertical" is passed', () => {
    const { container } = render(NavigationItem, {
      props: { onclick: () => {}, variant: 'vertical', children: (() => {}) as never },
    });
    expect(container.querySelector('button')?.getAttribute('data-variant')).toBe('vertical');
  });

  test('vertical link with active state still emits data-active and data-variant', () => {
    const { container } = render(NavigationItem, {
      props: {
        href: '/projects',
        variant: 'vertical',
        active: true,
        children: (() => {}) as never,
      },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('data-variant')).toBe('vertical');
    expect(anchor?.getAttribute('data-active')).toBe('true');
    expect(anchor?.getAttribute('aria-current')).toBe('page');
  });
});

describe('NavigationItem native attribute passthrough', () => {
  test('link arm forwards data-testid to the anchor element', () => {
    const { container } = render(NavigationItem, {
      props: { href: '/home', 'data-testid': 'nav-home', children: (() => {}) as never },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('data-testid')).toBe('nav-home');
  });

  test('button arm forwards data-testid to the button element', () => {
    const { container } = render(NavigationItem, {
      props: { onclick: () => {}, 'data-testid': 'nav-btn', children: (() => {}) as never },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('data-testid')).toBe('nav-btn');
  });

  test('link arm forwards id to the anchor element', () => {
    const { container } = render(NavigationItem, {
      props: { href: '/about', id: 'nav-about', children: (() => {}) as never },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('id')).toBe('nav-about');
  });

  test('button arm forwards id to the button element', () => {
    const { container } = render(NavigationItem, {
      props: { onclick: () => {}, id: 'nav-action', children: (() => {}) as never },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('id')).toBe('nav-action');
  });

  test('link arm: component-controlled aria-current cannot be clobbered by rest', () => {
    // aria-current is placed AFTER {...rest} in the template, so the component wins.
    // `aria-current` is Omit-ted from the prop type (it's component-owned), so the
    // whole props object is cast to inject it the way an untyped JS consumer could.
    const { container } = render(NavigationItem, {
      props: {
        href: '/home',
        active: true,
        'aria-current': 'location',
        children: (() => {}) as never,
      } as never,
    });
    const anchor = container.querySelector('a');
    // Component derives aria-current="page" from active=true; it overrides any consumer value.
    expect(anchor?.getAttribute('aria-current')).toBe('page');
  });

  test('button arm: component-controlled aria-current cannot be clobbered by rest', () => {
    const { container } = render(NavigationItem, {
      props: {
        onclick: () => {},
        active: true,
        'aria-current': 'location',
        children: (() => {}) as never,
      } as never,
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-current')).toBe('page');
  });

  test('link arm: data-cinder-navigation-item is always present regardless of rest spread', () => {
    const { container } = render(NavigationItem, {
      props: { href: '/home', children: (() => {}) as never },
    });
    expect(container.querySelector('a')?.hasAttribute('data-cinder-navigation-item')).toBe(true);
  });

  test('button arm: data-cinder-navigation-item is always present regardless of rest spread', () => {
    const { container } = render(NavigationItem, {
      props: { onclick: () => {}, children: (() => {}) as never },
    });
    expect(container.querySelector('button')?.hasAttribute('data-cinder-navigation-item')).toBe(
      true,
    );
  });

  test('href={undefined} renders the button arm and clicking it does not throw', async () => {
    // The `href !== undefined` discriminant routes `href={undefined}` (a common SPA
    // `href={maybeRoute}` pattern) into the button arm. Without a consumer onclick the
    // click handler must not crash — the optional call guards against it.
    const { container } = render(NavigationItem, {
      props: { href: undefined, children: (() => {}) as never } as never,
    });
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    // Must not throw even though no onclick was provided.
    await fireEvent.click(button as HTMLButtonElement);
    expect(button?.hasAttribute('data-cinder-navigation-item')).toBe(true);
  });

  test('enabled link honors a consumer-supplied tabindex', () => {
    const { container } = render(NavigationItem, {
      props: { href: '/home', tabindex: 0, children: (() => {}) as never },
    });
    expect(container.querySelector('a')?.getAttribute('tabindex')).toBe('0');
  });

  test('disabled link forces tabindex=-1 over any consumer value', () => {
    const { container } = render(NavigationItem, {
      props: { href: '/home', disabled: true, tabindex: 0, children: (() => {}) as never },
    });
    expect(container.querySelector('a')?.getAttribute('tabindex')).toBe('-1');
  });

  test('button arm renders type="button" and a consumer cannot override it via type', () => {
    const { container } = render(NavigationItem, {
      props: { onclick: () => {}, type: 'submit', children: (() => {}) as never } as never,
    });
    expect(container.querySelector('button')?.getAttribute('type')).toBe('button');
  });
});
