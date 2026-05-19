/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: NavigationBar } = await import('./navigation-bar.svelte');
// createRawSnippet must be imported dynamically so Bun's svelte plugin (which patches
// the svelte package to resolve to the client build) applies before this import resolves.
const { createRawSnippet } = await import('svelte');

/** Creates a Svelte 5 Snippet that renders text content. */
function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

/**
 * Creates a toggle button snippet that wires aria-expanded, aria-controls, and onclick
 * from the snippet parameter. The setup closure captures the click handler from the
 * initial render. Attribute updates (aria-expanded) after interaction are observable
 * via the items region's data-open attribute, which Svelte binds directly in the template.
 */
function toggleSnippet(buttonId = 'toggle-btn') {
  return createRawSnippet<
    [
      {
        'aria-expanded': string;
        'aria-controls': string;
        onclick: (event: MouseEvent) => void;
      },
    ]
  >((getAttrs) => ({
    render: () => `<button type="button" id="${buttonId}">Menu</button>`,
    setup(element: Element) {
      const attrs = getAttrs();
      element.setAttribute('aria-expanded', attrs['aria-expanded']);
      element.setAttribute('aria-controls', attrs['aria-controls']);
      element.addEventListener('click', attrs.onclick as EventListener);
    },
  }));
}

function keyboardNavigationSnippet(clicks: Record<string, number>) {
  return createRawSnippet(() => ({
    render: () => `
      <div>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="home" data-active="true">Home</button>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="docs"><span data-testid="docs-label">Docs</span></button>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="billing" aria-disabled="true">Billing</button>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="settings">Settings</button>
      </div>
    `,
    setup(element: Element) {
      for (const button of element.querySelectorAll<HTMLButtonElement>('.cinder-navigation-item')) {
        button.addEventListener('click', () => {
          const key = button.dataset['key'];
          if (key) clicks[key] = (clicks[key] ?? 0) + 1;
        });
      }
    },
  }));
}

describe('NavigationBar', () => {
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

  // ── navAriaLabel prop ────────────────────────────────────────────────────

  test('navAriaLabel defaults to "Main navigation"', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
    });
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Main navigation');
  });

  test('navAriaLabel prop is applied to <nav>', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      navAriaLabel: 'Site navigation',
    });
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Site navigation');
  });

  test('rest-prop aria-label does not override navAriaLabel', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      navAriaLabel: 'Primary nav',
      'aria-label': 'Should be ignored',
    } as any);
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Primary nav');
  });

  // ── Rest props forwarding ────────────────────────────────────────────────

  test('rest props are forwarded: id, data-foo, and custom class all appear on <nav>', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      id: 'my-nav',
      'data-foo': 'bar',
      class: 'extra-class',
    } as any);
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

  // ── mobileMenuOpen defaults ──────────────────────────────────────────────

  test('mobileMenuOpen defaults to false; items region has data-open="false"', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      menuToggle: toggleSnippet(),
    });
    expect(
      container.querySelector('.cinder-navigation-bar__items')?.getAttribute('data-open'),
    ).toBe('false');
  });

  // ── menuToggle snippet and ARIA ──────────────────────────────────────────

  test('with menuToggle, toggle button receives aria-expanded="false" initially', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      menuToggle: toggleSnippet(),
    });
    const toggle = container.querySelector('#toggle-btn');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
  });

  test('aria-controls value equals the items region id', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      menuToggle: toggleSnippet(),
    });
    const toggle = container.querySelector('#toggle-btn');
    const itemsRegion = container.querySelector('.cinder-navigation-bar__items');
    expect(toggle?.getAttribute('aria-controls')).toBe(itemsRegion?.getAttribute('id'));
  });

  test('clicking the toggle sets data-open="true" on the items region', async () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      menuToggle: toggleSnippet(),
    });
    const toggle = container.querySelector('#toggle-btn') as HTMLElement;
    await fireEvent.click(toggle);
    expect(
      container.querySelector('.cinder-navigation-bar__items')?.getAttribute('data-open'),
    ).toBe('true');
  });

  test('clicking the toggle a second time closes the menu', async () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      menuToggle: toggleSnippet(),
    });
    const toggle = container.querySelector('#toggle-btn') as HTMLElement;
    await fireEvent.click(toggle);
    await fireEvent.click(toggle);
    expect(
      container.querySelector('.cinder-navigation-bar__items')?.getAttribute('data-open'),
    ).toBe('false');
  });

  // ── Escape key handling ──────────────────────────────────────────────────

  test('pressing Escape on <nav> while open closes the menu', async () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      menuToggle: toggleSnippet(),
    });
    const toggle = container.querySelector('#toggle-btn') as HTMLElement;
    const nav = container.querySelector('nav') as HTMLElement;

    await fireEvent.click(toggle);
    expect(
      container.querySelector('.cinder-navigation-bar__items')?.getAttribute('data-open'),
    ).toBe('true');

    await fireEvent.keyDown(nav, { key: 'Escape' });
    expect(
      container.querySelector('.cinder-navigation-bar__items')?.getAttribute('data-open'),
    ).toBe('false');
  });

  test('pressing Escape on <nav> while closed does not error and data-open stays false', async () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      menuToggle: toggleSnippet(),
    });
    const nav = container.querySelector('nav') as HTMLElement;
    await fireEvent.keyDown(nav, { key: 'Escape' });
    expect(
      container.querySelector('.cinder-navigation-bar__items')?.getAttribute('data-open'),
    ).toBe('false');
  });

  test('pressing Escape outside the navbar does not close the menu', async () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      menuToggle: toggleSnippet(),
    });
    const toggle = container.querySelector('#toggle-btn') as HTMLElement;
    await fireEvent.click(toggle);

    // Dispatch Escape on document.body — outside the nav element.
    await fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(
      container.querySelector('.cinder-navigation-bar__items')?.getAttribute('data-open'),
    ).toBe('true');
  });

  // ── items snippet receives variant context ───────────────────────────────

  test('items snippet receives { variant } equal to "horizontal" when menu is closed', () => {
    let capturedVariant: string | undefined;
    const captureSnippet = createRawSnippet<[{ variant: string }]>((getCtx) => ({
      render: () => `<span></span>`,
      setup() {
        capturedVariant = getCtx().variant;
      },
    }));

    render(NavigationBar, {
      items: captureSnippet as any,
      menuToggle: toggleSnippet(),
    });

    expect(capturedVariant).toBe('horizontal');
  });

  test('opening the menu sets data-open="true" on the items region (mobileMenuOpen=true drives variant="mobile")', async () => {
    // In Svelte's createRawSnippet, setup() runs once at mount. Reactive snippet parameter
    // changes cannot be directly observed via the setup closure. Instead we verify the
    // full state chain: click → mobileMenuOpen=true → data-open='true' on the items region.
    // The variant derivation ($derived(menuToggle !== undefined && mobileMenuOpen ? 'mobile' : 'horizontal'))
    // is deterministic — when data-open='true', variant was 'mobile'. Initial variant='horizontal'
    // is confirmed directly via the captured closure in the test above this one.
    let capturedVariant: string | undefined;
    const captureSnippet = createRawSnippet<[{ variant: string }]>((getCtx) => ({
      render: () => `<span></span>`,
      setup() {
        capturedVariant = getCtx().variant;
      },
    }));

    const { container } = render(NavigationBar, {
      items: captureSnippet as any,
      menuToggle: toggleSnippet(),
    });

    // At mount, variant is 'horizontal' (menu closed).
    expect(capturedVariant).toBe('horizontal');

    const toggle = container.querySelector('#toggle-btn') as HTMLElement;
    await fireEvent.click(toggle);

    // After click: mobileMenuOpen=true → data-open='true' on the items region.
    // The variant derivation passes 'mobile' to items when open.
    expect(
      container.querySelector('.cinder-navigation-bar__items')?.getAttribute('data-open'),
    ).toBe('true');
  });

  // ── data-collapsible cannot be overridden via rest ───────────────────────

  test('consumer data-collapsible rest prop cannot override internal value', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      menuToggle: toggleSnippet(),
      'data-collapsible': 'false',
    } as any);
    expect(container.querySelector('nav')?.getAttribute('data-collapsible')).toBe('true');
  });

  // ── Composed onkeydown ───────────────────────────────────────────────────

  test('rest-prop onkeydown is composed: spy fires AND menu closes on Escape', async () => {
    let spyFired = false;
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      menuToggle: toggleSnippet(),
      onkeydown: () => {
        spyFired = true;
      },
    } as any);

    const toggle = container.querySelector('#toggle-btn') as HTMLElement;
    const nav = container.querySelector('nav') as HTMLElement;
    await fireEvent.click(toggle);
    await fireEvent.keyDown(nav, { key: 'Escape' });

    expect(spyFired).toBe(true);
    expect(
      container.querySelector('.cinder-navigation-bar__items')?.getAttribute('data-open'),
    ).toBe('false');
  });

  test('rest-prop onkeydown that calls preventDefault cancels the Escape close', async () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      menuToggle: toggleSnippet(),
      onkeydown: (e: KeyboardEvent) => {
        e.preventDefault();
      },
    } as any);

    const toggle = container.querySelector('#toggle-btn') as HTMLElement;
    const nav = container.querySelector('nav') as HTMLElement;
    await fireEvent.click(toggle);
    await fireEvent.keyDown(nav, { key: 'Escape' });

    expect(
      container.querySelector('.cinder-navigation-bar__items')?.getAttribute('data-open'),
    ).toBe('true');
  });

  test('ArrowRight moves focus to the navigation item on the right', async () => {
    const clicks: Record<string, number> = {};
    const { container } = render(NavigationBar, {
      items: keyboardNavigationSnippet(clicks),
    });
    const home = container.querySelector('[data-key="home"]') as HTMLElement;
    const docs = container.querySelector('[data-key="docs"]') as HTMLElement;

    home.focus();
    await fireEvent.keyDown(home, { key: 'ArrowRight' });

    expect(document.activeElement).toBe(docs);
  });

  test('ArrowLeft moves focus to the navigation item on the left', async () => {
    const clicks: Record<string, number> = {};
    const { container } = render(NavigationBar, {
      items: keyboardNavigationSnippet(clicks),
    });
    const docs = container.querySelector('[data-key="docs"]') as HTMLElement;
    const home = container.querySelector('[data-key="home"]') as HTMLElement;

    docs.focus();
    await fireEvent.keyDown(docs, { key: 'ArrowLeft' });

    expect(document.activeElement).toBe(home);
  });

  test('arrow-key navigation skips disabled navigation items', async () => {
    const clicks: Record<string, number> = {};
    const { container } = render(NavigationBar, {
      items: keyboardNavigationSnippet(clicks),
    });
    const docs = container.querySelector('[data-key="docs"]') as HTMLElement;
    const settings = container.querySelector('[data-key="settings"]') as HTMLElement;

    docs.focus();
    await fireEvent.keyDown(docs, { key: 'ArrowRight' });

    expect(document.activeElement).toBe(settings);
  });

  test('arrow-key navigation from a disabled navigation item uses its DOM position', async () => {
    const clicks: Record<string, number> = {};
    const { container } = render(NavigationBar, {
      items: keyboardNavigationSnippet(clicks),
    });
    const billing = container.querySelector('[data-key="billing"]') as HTMLElement;
    const settings = container.querySelector('[data-key="settings"]') as HTMLElement;

    billing.focus();
    await fireEvent.keyDown(billing, { key: 'ArrowRight' });

    expect(document.activeElement).toBe(settings);
  });

  test('Space selects the focused navigation item', async () => {
    const clicks: Record<string, number> = {};
    const { container } = render(NavigationBar, {
      items: keyboardNavigationSnippet(clicks),
    });
    const docs = container.querySelector('[data-key="docs"]') as HTMLElement;

    docs.focus();
    await fireEvent.keyDown(docs, { key: ' ' });

    expect(clicks['docs']).toBe(1);
  });

  test('Enter selects the focused navigation item', async () => {
    const clicks: Record<string, number> = {};
    const { container } = render(NavigationBar, {
      items: keyboardNavigationSnippet(clicks),
    });
    const docs = container.querySelector('[data-key="docs"]') as HTMLElement;

    docs.focus();
    await fireEvent.keyDown(docs, { key: 'Enter' });

    expect(clicks['docs']).toBe(1);
  });

  test('Space does not select a navigation item when the event starts inside a descendant', async () => {
    const clicks: Record<string, number> = {};
    const { container } = render(NavigationBar, {
      items: keyboardNavigationSnippet(clicks),
    });
    const docsLabel = container.querySelector('[data-testid="docs-label"]') as HTMLElement;

    await fireEvent.keyDown(docsLabel, { key: ' ' });

    expect(clicks['docs']).toBeUndefined();
  });
});
