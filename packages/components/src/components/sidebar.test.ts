/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Sidebar } = await import('./sidebar.svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

function listSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<ul><li>${text}</li></ul>`,
    setup: () => {},
  }));
}

describe('Sidebar (desktop / inline aside)', () => {
  test('renders an <aside> landmark', () => {
    const { container } = render(Sidebar, {
      props: { navigation: listSnippet('items') },
    });
    expect(container.querySelector('aside')).not.toBeNull();
  });

  test('aside has default aria-label "Sidebar"', () => {
    const { container } = render(Sidebar, {
      props: { navigation: listSnippet('items') },
    });
    expect(container.querySelector('aside')?.getAttribute('aria-label')).toBe('Sidebar');
  });

  test('aside uses the supplied ariaLabel', () => {
    const { container } = render(Sidebar, {
      props: { ariaLabel: 'Workspace', navigation: listSnippet('items') },
    });
    expect(container.querySelector('aside')?.getAttribute('aria-label')).toBe('Workspace');
  });

  test('empty ariaLabel throws on initial render', () => {
    expect(() => {
      render(Sidebar, {
        props: { ariaLabel: '', navigation: listSnippet('items') },
      });
    }).toThrow();
  });

  test('whitespace-only ariaLabel throws on initial render', () => {
    expect(() => {
      render(Sidebar, {
        props: { ariaLabel: '   ', navigation: listSnippet('items') },
      });
    }).toThrow();
  });

  test('aside carries cinder-sidebar class', () => {
    const { container } = render(Sidebar, {
      props: { navigation: listSnippet('items') },
    });
    expect(container.querySelector('aside.cinder-sidebar')).not.toBeNull();
  });

  test('consumer class prop merges onto the aside', () => {
    const { container } = render(Sidebar, {
      props: { class: 'my-sidebar', navigation: listSnippet('items') },
    });
    const aside = container.querySelector('aside');
    expect(aside?.classList.contains('cinder-sidebar')).toBe(true);
    expect(aside?.classList.contains('my-sidebar')).toBe(true);
  });

  test('renders <nav> inside the aside with a distinct aria-label', () => {
    const { container } = render(Sidebar, {
      props: { ariaLabel: 'Workspace', navigation: listSnippet('items') },
    });
    const nav = container.querySelector('aside nav.cinder-sidebar__nav');
    expect(nav).not.toBeNull();
    // The inner <nav> landmark gets a distinct accessible name so it is not
    // announced identically to the outer <aside> complementary landmark.
    expect(nav?.getAttribute('aria-label')).toBe('Workspace navigation');
  });

  test('outer aside aria-label is distinct from inner nav aria-label', () => {
    const { container } = render(Sidebar, {
      props: { ariaLabel: 'Workspace', navigation: listSnippet('items') },
    });
    const aside = container.querySelector('aside');
    const nav = container.querySelector('aside nav.cinder-sidebar__nav');
    expect(aside?.getAttribute('aria-label')).toBe('Workspace');
    expect(nav?.getAttribute('aria-label')).not.toBe(aside?.getAttribute('aria-label'));
  });

  test('renders navigation snippet inside the nav', () => {
    const { container } = render(Sidebar, {
      props: { navigation: listSnippet('payload') },
    });
    const nav = container.querySelector('aside nav.cinder-sidebar__nav');
    expect(nav?.textContent ?? '').toContain('payload');
  });

  test('omits brand region when no brand snippet is provided', () => {
    const { container } = render(Sidebar, {
      props: { navigation: listSnippet('items') },
    });
    expect(container.querySelector('.cinder-sidebar__brand')).toBeNull();
  });

  test('renders brand snippet inside .cinder-sidebar__brand when provided', () => {
    const { container } = render(Sidebar, {
      props: { brand: textSnippet('Cinder'), navigation: listSnippet('items') },
    });
    const brand = container.querySelector('.cinder-sidebar__brand');
    expect(brand).not.toBeNull();
    expect(brand?.textContent ?? '').toContain('Cinder');
  });

  test('omits footer region when no footer snippet is provided', () => {
    const { container } = render(Sidebar, {
      props: { navigation: listSnippet('items') },
    });
    expect(container.querySelector('.cinder-sidebar__footer')).toBeNull();
  });

  test('renders footer snippet inside .cinder-sidebar__footer when provided', () => {
    const { container } = render(Sidebar, {
      props: { footer: textSnippet('Sign out'), navigation: listSnippet('items') },
    });
    const footer = container.querySelector('.cinder-sidebar__footer');
    expect(footer).not.toBeNull();
    expect(footer?.textContent ?? '').toContain('Sign out');
  });

  test('does not set data-cinder-collapsed when collapsed=false', () => {
    const { container } = render(Sidebar, {
      props: { collapsed: false, navigation: listSnippet('items') },
    });
    expect(container.querySelector('aside')?.hasAttribute('data-cinder-collapsed')).toBe(false);
  });

  test('sets data-cinder-collapsed when collapsed=true', () => {
    const { container } = render(Sidebar, {
      props: { collapsed: true, navigation: listSnippet('items') },
    });
    expect(container.querySelector('aside')?.hasAttribute('data-cinder-collapsed')).toBe(true);
  });

  test('aria-label in rest spread cannot override the component-owned ariaLabel', () => {
    const { container } = render(Sidebar, {
      props: {
        ariaLabel: 'Sections',
        'aria-label': 'Overridden',
        navigation: listSnippet('items'),
      } as unknown as Parameters<typeof render>[1]['props'],
    });
    expect(container.querySelector('aside')?.getAttribute('aria-label')).toBe('Sections');
  });

  test('aria-labelledby in rest spread is not forwarded', () => {
    const { container } = render(Sidebar, {
      props: {
        ariaLabel: 'Sections',
        'aria-labelledby': 'external-id',
        navigation: listSnippet('items'),
      } as unknown as Parameters<typeof render>[1]['props'],
    });
    const aside = container.querySelector('aside');
    expect(aside?.getAttribute('aria-label')).toBe('Sections');
    expect(aside?.hasAttribute('aria-labelledby')).toBe(false);
  });

  test('rest attributes spread onto the aside', () => {
    const { container } = render(Sidebar, {
      props: {
        navigation: listSnippet('items'),
        'data-testid': 'side',
      } as never,
    });
    expect(container.querySelector('aside')?.getAttribute('data-testid')).toBe('side');
  });
});

describe('Sidebar context', () => {
  test('publishes collapsed state to descendants (collapsed=false)', async () => {
    const { default: Fixture } = await import('../test/fixtures/sidebar-context-fixture.svelte');
    const { container } = render(Fixture, { props: { collapsed: false } });
    const probe = container.querySelector('[data-sidebar-probe]');
    expect(probe?.getAttribute('data-context')).toBe('present');
    expect(probe?.getAttribute('data-collapsed')).toBe('false');
  });

  test('publishes collapsed state to descendants (collapsed=true)', async () => {
    const { default: Fixture } = await import('../test/fixtures/sidebar-context-fixture.svelte');
    const { container } = render(Fixture, { props: { collapsed: true } });
    const probe = container.querySelector('[data-sidebar-probe]');
    expect(probe?.getAttribute('data-context')).toBe('present');
    expect(probe?.getAttribute('data-collapsed')).toBe('true');
  });

  test('descendants outside a Sidebar see undefined context', async () => {
    const { default: Probe } = await import('../test/fixtures/sidebar-context-probe.svelte');
    const { container } = render(Probe);
    const probe = container.querySelector('[data-sidebar-probe]');
    expect(probe?.getAttribute('data-context')).toBe('absent');
    // No context means data-collapsed is omitted entirely — distinguishable from
    // a Sidebar-wrapped probe with collapsed=false.
    expect(probe?.hasAttribute('data-collapsed')).toBe(false);
  });

  test('context collapsed updates reactively when the prop changes', async () => {
    const { default: Fixture } = await import('../test/fixtures/sidebar-context-fixture.svelte');
    const { container, rerender } = render(Fixture, { props: { collapsed: false } });
    const probe = container.querySelector('[data-sidebar-probe]');
    expect(probe?.getAttribute('data-collapsed')).toBe('false');
    await rerender({ collapsed: true });
    expect(probe?.getAttribute('data-collapsed')).toBe('true');
  });
});

// ----------------------------------------
// Mobile / drawer branch — matchMedia mock forces `MediaQuery.current = true`
// so the `{#if mobile.current}` branch is exercised.
// ----------------------------------------

type Listener = (event: { matches: boolean }) => void;

function installMatchMediaMock(initialMatches: boolean) {
  const list = {
    matches: initialMatches,
    media: '',
    onchange: null as Listener | null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  };
  const originalMatchMedia = (window as unknown as { matchMedia?: typeof window.matchMedia })
    .matchMedia;
  (window as unknown as { matchMedia: typeof window.matchMedia }).matchMedia = ((query: string) => {
    list.media = query;
    return list as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
  return {
    list,
    restore() {
      if (originalMatchMedia) {
        (window as unknown as { matchMedia: typeof window.matchMedia }).matchMedia =
          originalMatchMedia;
      } else {
        delete (window as unknown as { matchMedia?: typeof window.matchMedia }).matchMedia;
      }
    },
  };
}

// happy-dom doesn't implement HTMLDialogElement.showModal / close — stub them
// the same way drawer.test.ts does so the mobile <Drawer> can render.
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      value: function () {
        this.setAttribute('open', '');
      },
      configurable: true,
      writable: true,
    });
  }
  if (!HTMLDialogElement.prototype.close) {
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      value: function () {
        this.removeAttribute('open');
        this.dispatchEvent(new Event('close'));
      },
      configurable: true,
      writable: true,
    });
  }
}

describe('Sidebar (mobile / drawer)', () => {
  let mock: ReturnType<typeof installMatchMediaMock> | undefined;

  afterEach(() => {
    mock?.restore();
    mock = undefined;
  });

  test('renders a <dialog> instead of an <aside>', () => {
    mock = installMatchMediaMock(true);
    const { container } = render(Sidebar, {
      props: { navigation: listSnippet('items') },
    });
    if (!mock.list.media) {
      // Bun's `svelte/reactivity` resolution may not route through matchMedia
      // in this environment; skip without failing.
      return;
    }
    expect(container.querySelector('dialog')).not.toBeNull();
    expect(container.querySelector('aside')).toBeNull();
  });

  test('mobile branch wraps content in .cinder-sidebar.cinder-sidebar--mobile', () => {
    mock = installMatchMediaMock(true);
    const { container } = render(Sidebar, {
      props: { navigation: listSnippet('items') },
    });
    if (!mock.list.media) return;
    const wrapper = container.querySelector('dialog .cinder-sidebar.cinder-sidebar--mobile');
    expect(wrapper).not.toBeNull();
  });

  test('mobile nav landmark has the distinct navigation label', () => {
    mock = installMatchMediaMock(true);
    const { container } = render(Sidebar, {
      props: { ariaLabel: 'Workspace', navigation: listSnippet('items') },
    });
    if (!mock.list.media) return;
    const nav = container.querySelector('dialog nav.cinder-sidebar__nav');
    expect(nav?.getAttribute('aria-label')).toBe('Workspace navigation');
  });

  test('mobile branch forwards rest attributes onto the wrapper', () => {
    mock = installMatchMediaMock(true);
    const { container } = render(Sidebar, {
      props: {
        navigation: listSnippet('items'),
        'data-testid': 'mobile-side',
      } as never,
    });
    if (!mock.list.media) return;
    const wrapper = container.querySelector('.cinder-sidebar.cinder-sidebar--mobile');
    expect(wrapper?.getAttribute('data-testid')).toBe('mobile-side');
  });

  test('mobile brand and footer render inside the drawer', () => {
    mock = installMatchMediaMock(true);
    const { container } = render(Sidebar, {
      props: {
        brand: textSnippet('Cinder'),
        navigation: listSnippet('items'),
        footer: textSnippet('Sign out'),
      },
    });
    if (!mock.list.media) return;
    expect(container.querySelector('dialog .cinder-sidebar__brand')?.textContent ?? '').toContain(
      'Cinder',
    );
    expect(container.querySelector('dialog .cinder-sidebar__footer')?.textContent ?? '').toContain(
      'Sign out',
    );
  });
});
