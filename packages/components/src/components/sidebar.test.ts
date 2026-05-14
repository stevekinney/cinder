/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
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

  test('renders <nav> inside the aside with matching aria-label', () => {
    const { container } = render(Sidebar, {
      props: { ariaLabel: 'Workspace', navigation: listSnippet('items') },
    });
    const nav = container.querySelector('aside nav.cinder-sidebar__nav');
    expect(nav).not.toBeNull();
    expect(nav?.getAttribute('aria-label')).toBe('Workspace');
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
  });
});
