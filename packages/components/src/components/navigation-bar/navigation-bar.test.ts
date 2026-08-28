/// <reference lib="dom" />
import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render, fireEvent, cleanup, waitFor } = await import('@testing-library/svelte');

// Unmount renders between tests; shared document.body otherwise leaks activeElement/nodes.
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const { default: NavigationBar } = await import('./navigation-bar.svelte');
// createRawSnippet must be imported dynamically so Bun's svelte plugin (which patches
// the svelte package to resolve to the client build) applies before this import resolves.
const { createRawSnippet, tick } = await import('svelte');

const navigationBarCss = readFileSync(new URL('./navigation-bar.css', import.meta.url), 'utf8');
const navigationBarSource = readFileSync(
  new URL('./navigation-bar.svelte', import.meta.url),
  'utf8',
);

class CapturingResizeObserver implements ResizeObserver {
  static lastCallback: ResizeObserverCallback | null = null;
  static lastObserver: CapturingResizeObserver | null = null;

  readonly observed: Element[] = [];

  constructor(callback: ResizeObserverCallback) {
    CapturingResizeObserver.lastCallback = callback;
    CapturingResizeObserver.lastObserver = this;
  }

  observe(target: Element): void {
    this.observed.push(target);
  }

  unobserve(): void {}

  disconnect(): void {}
}

async function withResizeObserver(run: () => void | Promise<void>): Promise<void> {
  const originalResizeObserver = globalThis.ResizeObserver;
  CapturingResizeObserver.lastCallback = null;
  CapturingResizeObserver.lastObserver = null;
  globalThis.ResizeObserver = CapturingResizeObserver as unknown as typeof ResizeObserver;

  try {
    await run();
  } finally {
    globalThis.ResizeObserver = originalResizeObserver;
  }
}

function emitNavigationBarResize(target: Element, width: number): void {
  const entry = {
    target,
    contentRect: { width, height: 0 },
  } as unknown as ResizeObserverEntry;
  CapturingResizeObserver.lastCallback?.([entry], CapturingResizeObserver.lastObserver!);
}

function getItemsRegion(container: HTMLElement): HTMLElement {
  return (container.querySelector('.cinder-navigation-bar__items') ??
    document.body.querySelector('.cinder-navigation-bar__items')) as HTMLElement;
}

async function openCollapsedMobileMenu(container: HTMLElement): Promise<HTMLElement> {
  await tick();
  const nav = container.querySelector('nav') as HTMLElement;
  const toggle = container.querySelector('#toggle-btn') as HTMLElement;

  emitNavigationBarResize(nav, 640);
  await tick();

  await fireEvent.click(toggle);
  expect(getItemsRegion(container).getAttribute('data-open')).toBe('true');

  return nav;
}

async function waitForMobilePanelPosition(container: HTMLElement): Promise<HTMLElement> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const itemsRegion = getItemsRegion(container);
    if (itemsRegion.hasAttribute('data-cinder-position-ready')) return itemsRegion;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('NavigationBar mobile panel did not finish positioning.');
}

async function setCollapsedMobileLayout(container: HTMLElement): Promise<void> {
  await tick();
  const nav = container.querySelector('nav') as HTMLElement;
  emitNavigationBarResize(nav, 640);
  await tick();
}

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
        onclick?: (event: MouseEvent) => void;
        onkeydown?: (event: KeyboardEvent) => void;
      },
    ]
  >((getAttrs) => ({
    render: () => `<button type="button" id="${buttonId}">Menu</button>`,
    setup(element: Element) {
      const attrs = getAttrs();
      element.setAttribute('aria-expanded', attrs['aria-expanded']);
      element.setAttribute('aria-controls', attrs['aria-controls']);
      if (attrs.onclick) {
        element.addEventListener('click', attrs.onclick as EventListener);
      }
      if (attrs.onkeydown) {
        element.addEventListener('keydown', attrs.onkeydown as EventListener);
      }
    },
  }));
}

function glyphToggleSnippet(buttonId = 'toggle-glyph-btn') {
  return createRawSnippet<
    [
      {
        'aria-expanded': string;
        'aria-controls': string;
        onclick?: (event: MouseEvent) => void;
        onkeydown?: (event: KeyboardEvent) => void;
      },
    ]
  >((getAttrs) => ({
    render: () =>
      `<button type="button" id="${buttonId}" aria-label="Open menu"><span aria-hidden="true">☰</span></button>`,
    setup(element: Element) {
      const attrs = getAttrs();
      element.setAttribute('aria-expanded', attrs['aria-expanded']);
      element.setAttribute('aria-controls', attrs['aria-controls']);
      if (attrs.onclick) {
        element.addEventListener('click', attrs.onclick as EventListener);
      }
      if (attrs.onkeydown) {
        element.addEventListener('keydown', attrs.onkeydown as EventListener);
      }
    },
  }));
}

function actionButtonSnippet() {
  return createRawSnippet(() => ({
    render: () => '<button type="button" id="nav-action">Account</button>',
  }));
}

function hiddenThenActionButtonSnippet() {
  return createRawSnippet(() => ({
    render: () =>
      '<div><input type="hidden" id="hidden-action"><button type="button" id="nav-action">Account</button></div>',
  }));
}

function cssHiddenThenActionButtonSnippet() {
  return createRawSnippet(() => ({
    render: () =>
      '<div><button type="button" style="display: none">Hidden</button><button type="button" id="nav-action">Account</button></div>',
  }));
}

function negativeThenActionButtonSnippet() {
  return createRawSnippet(() => ({
    render: () =>
      '<div><button type="button" id="skipped-action" tabindex="-1">Skipped</button><button type="button" id="nav-action">Account</button></div>',
  }));
}

function brandLinkSnippet() {
  return createRawSnippet(() => ({
    render: () => '<a href="/home" id="brand-link">Acme</a>',
  }));
}

function negativeFinalBrandSnippet() {
  return createRawSnippet(() => ({
    render: () =>
      '<div><a href="/home" id="brand-home">Home</a><button type="button" id="brand-skipped" tabindex="-1">Skipped</button></div>',
  }));
}

function multiControlBrandSnippet() {
  return createRawSnippet(() => ({
    render: () =>
      '<div><a href="/home" id="brand-home">Home</a><a href="/products" id="brand-products">Products</a></div>',
  }));
}

function svgBrandSnippet() {
  return createRawSnippet(() => ({
    render: () =>
      '<svg id="brand-svg" tabindex="0" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2 2 7h2v7h8V7h2z"></path></svg>',
  }));
}

/** A brand whose only focus target is a button inside its own open shadow root. */
function shadowBrandSnippet() {
  return createRawSnippet(() => ({
    render: () => '<div id="brand-shadow-host"></div>',
    setup(element: Element) {
      const shadow = element.attachShadow({ mode: 'open' });
      const button = document.createElement('button');
      button.type = 'button';
      button.id = 'brand-shadow-button';
      button.textContent = 'Shadow Brand';
      shadow.append(button);
    },
  }));
}

function positiveThenNormalBrandSnippet() {
  return createRawSnippet(() => ({
    render: () =>
      '<div><button type="button" id="brand-positive" tabindex="1">Positive</button><a href="/home" id="brand-normal">Acme</a></div>',
  }));
}

/** A brand whose only focus target is a positive-tabindex control. */
function positiveOnlyBrandSnippet() {
  return createRawSnippet(() => ({
    render: () => '<button type="button" id="brand-positive" tabindex="1">Positive</button>',
  }));
}

function disabledFirstNavigationSnippet() {
  return createRawSnippet(() => ({
    render: () => `
      <div>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item aria-disabled="true">Disabled</button>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="enabled">Enabled</button>
      </div>
    `,
  }));
}

function negativeFirstNavigationSnippet() {
  return createRawSnippet(() => ({
    render: () => `
      <div>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="skipped" tabindex="-1">Skipped</button>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="enabled">Enabled</button>
      </div>
    `,
  }));
}

function negativeFinalNavigationSnippet() {
  return createRawSnippet(() => ({
    render: () => `
      <div>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="enabled">Enabled</button>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="skipped" tabindex="-1">Skipped</button>
      </div>
    `,
  }));
}

function inlineControlBeforeNegativeNavigationSnippet() {
  return createRawSnippet(() => ({
    render: () => `
      <div>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="enabled">Enabled</button>
        <button type="button" id="inline-control">Inline control</button>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="skipped" tabindex="-1">Skipped</button>
      </div>
    `,
  }));
}

function positiveFirstNavigationSnippet() {
  return createRawSnippet(() => ({
    render: () => `
      <div>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="home" tabindex="2">Home</button>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="settings">Settings</button>
      </div>
    `,
  }));
}

function positiveThenNormalNavigationSnippet() {
  return createRawSnippet(() => ({
    render: () => `
      <div>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="positive" tabindex="1">Positive</button>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="normal">Normal</button>
      </div>
    `,
  }));
}

function normalThenPositiveNavigationSnippet() {
  return createRawSnippet(() => ({
    render: () => `
      <div>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="normal">Normal</button>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="positive" tabindex="1">Positive</button>
      </div>
    `,
  }));
}

function allExcludedNavigationSnippet() {
  return createRawSnippet(() => ({
    render: () => `
      <div>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item aria-disabled="true">Disabled</button>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item tabindex="-1">Excluded</button>
      </div>
    `,
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

function iconNavigationSnippet(clicks: Record<string, number>) {
  return createRawSnippet(() => ({
    render: () => `
      <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="home">
        <svg data-testid="home-icon" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 2 2 7h2v7h8V7h2z"></path>
        </svg>
        <span>Home</span>
      </button>
    `,
    setup(element: Element) {
      const button = element.matches('.cinder-navigation-item')
        ? (element as HTMLButtonElement)
        : element.querySelector<HTMLButtonElement>('.cinder-navigation-item');
      button?.addEventListener('click', () => {
        const key = button.dataset['key'];
        if (key) clicks[key] = (clicks[key] ?? 0) + 1;
      });
    },
  }));
}

function cancelingNavigationSnippet(clicks: Record<string, number>) {
  return createRawSnippet(() => ({
    render: () => `
      <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="docs">Docs</button>
    `,
    setup(element: Element) {
      const button = element.matches('.cinder-navigation-item')
        ? (element as HTMLButtonElement)
        : element.querySelector<HTMLButtonElement>('.cinder-navigation-item');
      button?.addEventListener('click', (event) => {
        event.preventDefault();
        const key = button.dataset['key'];
        if (key) clicks[key] = (clicks[key] ?? 0) + 1;
      });
    },
  }));
}

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
    globalThis.MutationObserver = CountingMutationObserver as unknown as typeof MutationObserver;

    try {
      render(NavigationBar, { items: textSnippet('items') });
      expect(constructedCount).toBe(0);
    } finally {
      globalThis.MutationObserver = originalMutationObserver;
    }
  });

  test('placement defaults to top and labelsVisible defaults to always', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
    });
    const nav = container.querySelector('nav');
    expect(nav?.getAttribute('data-cinder-placement')).toBe('top');
    expect(nav?.getAttribute('data-cinder-label-visibility')).toBe('always');
  });

  test('bottom placement emits bottom attributes and mobile item context without a menu toggle', () => {
    let capturedVariant: string | undefined;
    let capturedPlacement: string | undefined;
    let capturedShowLabels: string | undefined;
    const captureSnippet = createRawSnippet<
      [{ variant: string; placement?: string; labelsVisible?: string }]
    >((getCtx) => ({
      render: () => `<span></span>`,
      setup() {
        const context = getCtx();
        capturedVariant = context.variant;
        capturedPlacement = context.placement;
        capturedShowLabels = context.labelsVisible;
      },
    }));

    const { container } = render(NavigationBar, {
      items: captureSnippet,
      placement: 'bottom',
      labelsVisible: 'active',
      menuToggle: toggleSnippet(),
    });

    const nav = container.querySelector('nav');
    expect(nav?.getAttribute('data-cinder-placement')).toBe('bottom');
    expect(nav?.getAttribute('data-cinder-label-visibility')).toBe('active');
    expect(nav?.getAttribute('data-collapsible')).toBe('false');
    expect(container.querySelector('.cinder-navigation-bar__menu-toggle')).toBeNull();
    expect(capturedVariant).toBe('mobile');
    expect(capturedPlacement).toBe('bottom');
    expect(capturedShowLabels).toBe('active');
  });

  test('placement and label visibility data attributes cannot be clobbered by rest props', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      placement: 'bottom',
      labelsVisible: 'never',
      'data-cinder-placement': 'top',
      'data-cinder-label-visibility': 'always',
    } as any);
    const nav = container.querySelector('nav');
    expect(nav?.getAttribute('data-cinder-placement')).toBe('bottom');
    expect(nav?.getAttribute('data-cinder-label-visibility')).toBe('never');
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

  test('collapsible desktop layout does not apply inert when menu is closed', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: textSnippet('items'),
        menuToggle: toggleSnippet(),
      });

      await tick();
      const nav = container.querySelector('nav') as HTMLElement;
      const itemsRegion = container.querySelector('.cinder-navigation-bar__items') as HTMLElement;
      expect(CapturingResizeObserver.lastObserver?.observed).toContain(nav);

      emitNavigationBarResize(nav, 1024);
      await tick();

      expect(itemsRegion.hasAttribute('inert')).toBe(false);
    });
  });

  test('items region does not receive inert when menuToggle is present and menu is closed', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      menuToggle: toggleSnippet(),
    });

    const itemsRegion = container.querySelector('.cinder-navigation-bar__items');
    expect(itemsRegion).not.toBeNull();
    expect(itemsRegion?.hasAttribute('inert')).toBe(false);
  });

  test('collapsible mobile layout applies inert while closed and removes it when opened', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: textSnippet('items'),
        menuToggle: toggleSnippet(),
      });

      await tick();
      const nav = container.querySelector('nav') as HTMLElement;
      const itemsRegion = container.querySelector('.cinder-navigation-bar__items') as HTMLElement;

      emitNavigationBarResize(nav, 640);
      await tick();

      expect(itemsRegion.hasAttribute('inert')).toBe(true);

      const toggle = container.querySelector('#toggle-btn') as HTMLElement;
      await fireEvent.click(toggle);

      expect(itemsRegion.hasAttribute('inert')).toBe(false);
    });
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

  test('menu toggle clicks reach the consumer handler', async () => {
    let clicks = 0;
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      menuToggle: toggleSnippet(),
      onclick: () => {
        clicks += 1;
      },
    });
    await fireEvent.click(container.querySelector('#toggle-btn') as HTMLElement);
    expect(clicks).toBe(1);
  });

  test('menu toggle renders after the brand by default', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      brand: textSnippet('Acme'),
      menuToggle: toggleSnippet(),
    });
    const nav = container.querySelector('nav');
    const brand = container.querySelector('.cinder-navigation-bar__brand');
    const toggle = container.querySelector('.cinder-navigation-bar__menu-toggle');

    expect(nav?.getAttribute('data-cinder-menu-toggle-placement')).toBe('after-brand');
    expect(brand?.nextElementSibling).toBe(toggle);
  });

  test('menu toggle can render before the brand', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      brand: textSnippet('Acme'),
      menuToggle: toggleSnippet(),
      menuTogglePlacement: 'before-brand',
    });
    const nav = container.querySelector('nav');
    const brand = container.querySelector('.cinder-navigation-bar__brand');
    const toggle = container.querySelector('.cinder-navigation-bar__menu-toggle');

    expect(nav?.getAttribute('data-cinder-menu-toggle-placement')).toBe('before-brand');
    expect(toggle?.nextElementSibling).toBe(brand);
  });

  test('menu toggle placement data attribute cannot be clobbered by rest props', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      menuToggle: toggleSnippet(),
      menuTogglePlacement: 'before-brand',
      'data-cinder-menu-toggle-placement': 'after-brand',
    } as any);

    expect(container.querySelector('nav')?.getAttribute('data-cinder-menu-toggle-placement')).toBe(
      'before-brand',
    );
  });

  test('menu toggle can hide a decorative glyph from assistive technology', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      menuToggle: glyphToggleSnippet(),
    });
    const toggle = container.querySelector('#toggle-glyph-btn');
    const glyph = toggle?.querySelector('span');

    expect(toggle?.getAttribute('aria-label')).toBe('Open menu');
    expect(toggle?.textContent?.trim()).toBe('☰');
    expect(glyph?.getAttribute('aria-hidden')).toBe('true');
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
    const itemsRegion = container.querySelector('.cinder-navigation-bar__items');
    expect(itemsRegion?.getAttribute('data-open')).toBe('true');
    expect(itemsRegion).not.toBeNull();
    expect(itemsRegion?.hasAttribute('inert')).toBe(false);
  });

  test('keeps the floating-surface chrome class through the exit transition (CIN-376)', async () => {
    // Regression guard: gating `cinder-_floating-surface` purely on the live
    // `mobileMenuOpen` bindable dropped the class (and with it, the surface's
    // border/radius/shadow) the instant the toggle closed — before the
    // 200ms exit transition had even started.
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    window.getComputedStyle = ((target: Element) => {
      if (
        target instanceof HTMLElement &&
        target.classList.contains('cinder-navigation-bar__items')
      ) {
        return {
          transitionProperty: 'opacity, transform',
          transitionDuration: '80ms, 80ms',
          transitionDelay: '0ms, 0ms',
        } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(target);
    }) as typeof window.getComputedStyle;

    try {
      await withResizeObserver(async () => {
        const { container } = render(NavigationBar, {
          items: textSnippet('items'),
          menuToggle: toggleSnippet(),
        });

        const nav = await openCollapsedMobileMenu(container);
        const itemsRegion = getItemsRegion(container);
        expect(itemsRegion.classList.contains('cinder-_floating-surface')).toBe(true);

        const toggle = nav.querySelector('#toggle-btn') as HTMLElement;
        await fireEvent.click(toggle);

        const closingRegion = getItemsRegion(container);
        expect(closingRegion.hasAttribute('data-cinder-closing')).toBe(true);
        expect(closingRegion.classList.contains('cinder-_floating-surface')).toBe(true);
      });
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  test('keeps the mobile panel portaled through the exit transition (CIN-376)', async () => {
    // Regression guard: `itemsPortalScope`'s `disabled` flag used to key off
    // the live `mobileMenuOpen` bindable alone. Inside a transformed (or
    // otherwise containing-block-forming) ancestor, disabling the portal the
    // instant close begins moves the panel back inline while
    // `anchoredItems` keeps writing viewport-relative fixed `top`/`left`
    // coordinates for the rest of the exit (`exitState.isClosing`) — those
    // coordinates are then interpreted in the ancestor's coordinate system,
    // making the panel jump during the exit. The portal must stay attached
    // to `document.body` for as long as the panel is retained
    // (`exitState.renderPanel`), not just while `mobileMenuOpen` is live.
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    window.getComputedStyle = ((target: Element) => {
      if (
        target instanceof HTMLElement &&
        target.classList.contains('cinder-navigation-bar__items')
      ) {
        return {
          transitionProperty: 'opacity, transform',
          transitionDuration: '80ms, 80ms',
          transitionDelay: '0ms, 0ms',
        } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(target);
    }) as typeof window.getComputedStyle;

    try {
      await withResizeObserver(async () => {
        const { container } = render(NavigationBar, {
          items: textSnippet('items'),
          menuToggle: toggleSnippet(),
        });

        const nav = await openCollapsedMobileMenu(container);
        const itemsRegion = getItemsRegion(container);
        expect(itemsRegion.parentElement?.parentElement).toBe(document.body);

        const toggle = nav.querySelector('#toggle-btn') as HTMLElement;
        await fireEvent.click(toggle);

        const closingRegion = getItemsRegion(container);
        expect(closingRegion.hasAttribute('data-cinder-closing')).toBe(true);
        // Still portaled to `document.body`, not moved back inline under `nav`.
        expect(closingRegion.parentElement?.parentElement).toBe(document.body);
        expect(nav.contains(closingRegion)).toBe(false);
      });
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  test('an open collapsed menu is portaled outside the navigation stacking context', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: textSnippet('items'),
        menuToggle: toggleSnippet(),
      });

      const nav = await openCollapsedMobileMenu(container);
      const itemsRegion = getItemsRegion(container);

      expect(nav.contains(itemsRegion)).toBe(false);
      expect(itemsRegion.parentElement?.parentElement).toBe(document.body);
      expect(itemsRegion.getAttribute('data-cinder-mobile-panel')).toBe('true');
    });
  });

  test('mirrors the root and custom classes onto the portaled items scope', async () => {
    // A root-scoped consumer override like `.cinder-navigation-bar.compact
    // .cinder-navigation-item` must keep matching while the mobile items are
    // portaled, so the portal scope needs both `cinder-navigation-bar` and
    // any custom class — not just its own `__portal-scope` marker.
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: textSnippet('items'),
        menuToggle: toggleSnippet(),
        class: 'compact',
      });

      const nav = await openCollapsedMobileMenu(container);
      const portalScope = getItemsRegion(container).parentElement;

      expect(nav.contains(portalScope)).toBe(false);
      expect(portalScope?.classList.contains('cinder-navigation-bar__portal-scope')).toBe(true);
      expect(portalScope?.classList.contains('cinder-navigation-bar')).toBe(true);
      expect(portalScope?.classList.contains('compact')).toBe(true);
    });
  });

  test('owns portaled items before trailing navigation actions', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: textSnippet('items'),
        menuToggle: toggleSnippet(),
        actions: textSnippet('actions'),
      });

      const nav = await openCollapsedMobileMenu(container);
      const itemsRegion = getItemsRegion(container);
      const owner = container.querySelector('.cinder-navigation-bar__items-owner');
      const actions = container.querySelector('.cinder-navigation-bar__actions');

      expect(nav.hasAttribute('aria-owns')).toBe(false);
      expect(owner?.getAttribute('aria-owns')).toBe(itemsRegion.id);
      expect(
        owner && actions
          ? Boolean(owner.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING)
          : false,
      ).toBe(true);
    });
  });

  test('portaled item events bubble through the original navigation ancestry', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
      });
      const bubbledEvents: Array<{
        type: string;
        target: EventTarget | null;
      }> = [];
      const recordEvent = (event: Event) => {
        bubbledEvents.push({
          type: event.type,
          target: event.target,
        });
      };
      container.addEventListener('click', recordEvent);
      container.addEventListener('keydown', recordEvent);

      await openCollapsedMobileMenu(container);
      bubbledEvents.length = 0;
      const home = getItemsRegion(container).querySelector('[data-key="home"]') as HTMLElement;
      await fireEvent.keyDown(home, { key: 'a' });
      await fireEvent.click(home);

      expect(bubbledEvents.map(({ type }) => type)).toEqual(['keydown', 'click']);
      expect(bubbledEvents.map(({ target }) => target)).toEqual([home, home]);
    });
  });

  test('an unavailable source ancestor closes the portaled mobile menu', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
      });

      await openCollapsedMobileMenu(container);
      container.setAttribute('aria-hidden', 'true');

      await waitFor(() => {
        expect(getItemsRegion(container).getAttribute('data-open')).toBe('false');
      });
      const itemsRegion = getItemsRegion(container);
      expect(container.contains(itemsRegion)).toBe(true);
      expect(itemsRegion.hasAttribute('inert')).toBe(true);
    });
  });

  test('keeps an open collapsed menu inside its owning dialog', async () => {
    await withResizeObserver(async () => {
      const dialog = document.createElement('dialog');
      dialog.setAttribute('open', '');
      const nativeMatches = dialog.matches.bind(dialog);
      dialog.matches = (selector: string) => selector === ':modal' || nativeMatches(selector);
      document.body.append(dialog);
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
      });
      dialog.append(container);

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);

      expect(itemsRegion.parentElement?.parentElement).toBe(dialog);
    });
  });

  test('portaled menu preserves scoped tokens and color scheme through positioning updates', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
        style: '--cinder-surface: hotpink; color-scheme: dark;',
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const portalScope = itemsRegion.parentElement as HTMLElement;

      expect(portalScope.style.getPropertyValue('--cinder-surface')).toBe('hotpink');
      expect(portalScope.style.colorScheme).toBe('dark');
      expect(itemsRegion.style.position).toBe('fixed');

      const navigationBar = container.querySelector('nav') as HTMLElement;
      navigationBar.style.setProperty('--cinder-surface', 'rebeccapurple');
      navigationBar.style.colorScheme = 'light';

      await waitFor(() => {
        expect(portalScope.style.getPropertyValue('--cinder-surface')).toBe('rebeccapurple');
        expect(portalScope.style.colorScheme).toBe('light');
      });
    });
  });

  test('portaled menu bridges both ends of its tab order', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
        actions: actionButtonSnippet(),
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const toggle = container.querySelector('#toggle-btn') as HTMLButtonElement;
      const accountAction = container.querySelector('#nav-action') as HTMLButtonElement;
      const home = itemsRegion.querySelector('[data-key="home"]') as HTMLButtonElement;
      const settings = itemsRegion.querySelector('[data-key="settings"]') as HTMLButtonElement;

      home.focus();
      await fireEvent.keyDown(home, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(toggle);

      settings.focus();
      await fireEvent.keyDown(settings, { key: 'Tab' });
      expect(document.activeElement).toBe(accountAction);
    });
  });

  test('portaled menu skips hidden action controls at the end of its tab order', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
        actions: hiddenThenActionButtonSnippet(),
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const accountAction = container.querySelector('#nav-action') as HTMLButtonElement;
      const settings = itemsRegion.querySelector('[data-key="settings"]') as HTMLButtonElement;

      settings.focus();
      await fireEvent.keyDown(settings, { key: 'Tab' });
      expect(document.activeElement).toBe(accountAction);
    });
  });

  test('portaled menu skips CSS-hidden action controls at the end of its tab order', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
        actions: cssHiddenThenActionButtonSnippet(),
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const accountAction = container.querySelector('#nav-action') as HTMLButtonElement;
      const settings = itemsRegion.querySelector('[data-key="settings"]') as HTMLButtonElement;

      settings.focus();
      await fireEvent.keyDown(settings, { key: 'Tab' });
      expect(document.activeElement).toBe(accountAction);
    });
  });

  test('portaled menu skips actions removed from sequential tab order', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
        actions: negativeThenActionButtonSnippet(),
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const accountAction = container.querySelector('#nav-action') as HTMLButtonElement;
      const settings = itemsRegion.querySelector('[data-key="settings"]') as HTMLButtonElement;

      settings.focus();
      await fireEvent.keyDown(settings, { key: 'Tab' });
      expect(document.activeElement).toBe(accountAction);
    });
  });

  test('last sequential navigation item tabs to actions when a final enabled item has tabindex=-1', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: negativeFinalNavigationSnippet(),
        menuToggle: toggleSnippet(),
        actions: actionButtonSnippet(),
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const enabledItem = itemsRegion.querySelector('[data-key="enabled"]') as HTMLButtonElement;
      const accountAction = container.querySelector('#nav-action') as HTMLButtonElement;

      enabledItem.focus();
      await fireEvent.keyDown(enabledItem, { key: 'Tab' });
      expect(document.activeElement).toBe(accountAction);
    });
  });

  test('reverse Tab uses the first sequential navigation item when an enabled item has tabindex=-1', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: negativeFirstNavigationSnippet(),
        menuToggle: toggleSnippet(),
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const toggle = container.querySelector('#toggle-btn') as HTMLButtonElement;
      const enabledItem = itemsRegion.querySelector('[data-key="enabled"]') as HTMLButtonElement;

      enabledItem.focus();
      await fireEvent.keyDown(enabledItem, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(toggle);
    });
  });

  test('reverse Tab bridges from an arrow-focused leading item with tabindex=-1', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: negativeFirstNavigationSnippet(),
        menuToggle: toggleSnippet(),
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const toggle = container.querySelector('#toggle-btn') as HTMLButtonElement;
      const skippedItem = itemsRegion.querySelector('[data-key="skipped"]') as HTMLButtonElement;
      const enabledItem = itemsRegion.querySelector('[data-key="enabled"]') as HTMLButtonElement;

      enabledItem.focus();
      await fireEvent.keyDown(enabledItem, { key: 'ArrowLeft' });
      expect(document.activeElement).toBe(skippedItem);
      await fireEvent.keyDown(skippedItem, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(toggle);
    });
  });

  test('forward Tab bridges from an arrow-focused trailing item with tabindex=-1', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: negativeFinalNavigationSnippet(),
        menuToggle: toggleSnippet(),
        actions: actionButtonSnippet(),
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const skippedItem = itemsRegion.querySelector('[data-key="skipped"]') as HTMLButtonElement;
      const enabledItem = itemsRegion.querySelector('[data-key="enabled"]') as HTMLButtonElement;
      const accountAction = container.querySelector('#nav-action') as HTMLButtonElement;

      enabledItem.focus();
      await fireEvent.keyDown(enabledItem, { key: 'ArrowRight' });
      expect(document.activeElement).toBe(skippedItem);
      await fireEvent.keyDown(skippedItem, { key: 'Tab' });
      expect(document.activeElement).toBe(accountAction);
    });
  });

  test('forward Tab from the final sequential inline control reaches actions', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: inlineControlBeforeNegativeNavigationSnippet(),
        menuToggle: toggleSnippet(),
        actions: actionButtonSnippet(),
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const toggle = container.querySelector('#toggle-btn') as HTMLButtonElement;
      const enabledItem = itemsRegion.querySelector('[data-key="enabled"]') as HTMLButtonElement;
      const inlineControl = itemsRegion.querySelector('#inline-control') as HTMLButtonElement;
      const skippedItem = itemsRegion.querySelector('[data-key="skipped"]') as HTMLButtonElement;
      const accountAction = container.querySelector('#nav-action') as HTMLButtonElement;

      toggle.focus();
      await fireEvent.keyDown(toggle, { key: 'Tab' });
      expect(document.activeElement).toBe(enabledItem);

      inlineControl.focus();
      await fireEvent.keyDown(inlineControl, { key: 'Tab' });
      expect(document.activeElement).toBe(accountAction);
      expect(document.activeElement).not.toBe(skippedItem);
    });
  });

  test('pending toggle Tab advances to actions when no navigation item is sequentially focusable', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: allExcludedNavigationSnippet(),
        menuToggle: toggleSnippet(),
        actions: actionButtonSnippet(),
      });

      await openCollapsedMobileMenu(container);
      const toggle = container.querySelector('#toggle-btn') as HTMLButtonElement;
      const accountAction = container.querySelector('#nav-action') as HTMLButtonElement;

      toggle.focus();
      await fireEvent.keyDown(toggle, { key: 'Tab' });
      await waitForMobilePanelPosition(container);
      await tick();
      expect(document.activeElement).toBe(accountAction);
    });
  });

  test('toggle Tab skips disabled navigation items', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: disabledFirstNavigationSnippet(),
        menuToggle: toggleSnippet(),
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const toggle = container.querySelector('#toggle-btn') as HTMLButtonElement;
      const enabledItem = itemsRegion.querySelector('[data-key="enabled"]');

      toggle.focus();
      await fireEvent.keyDown(toggle, { key: 'Tab' });
      expect(document.activeElement).toBe(enabledItem);
    });
  });

  test('toggle Tab skips enabled navigation items removed from sequential tab order', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: negativeFirstNavigationSnippet(),
        menuToggle: toggleSnippet(),
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const toggle = container.querySelector('#toggle-btn') as HTMLButtonElement;
      const enabledItem = itemsRegion.querySelector('[data-key="enabled"]');

      toggle.focus();
      await fireEvent.keyDown(toggle, { key: 'Tab' });
      expect(document.activeElement).toBe(enabledItem);
    });
  });

  test('toggle Tab preserves a focusable brand before the portaled items', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        brand: brandLinkSnippet(),
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
        menuTogglePlacement: 'before-brand',
      });

      await openCollapsedMobileMenu(container);
      await waitForMobilePanelPosition(container);
      const toggle = container.querySelector('#toggle-btn') as HTMLButtonElement;
      const brandLink = container.querySelector('#brand-link');

      toggle.focus();
      await fireEvent.keyDown(toggle, { key: 'Tab' });
      expect(document.activeElement).toBe(brandLink);
    });
  });

  test('pending toggle Tab preserves a focusable brand before the portaled items', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        brand: brandLinkSnippet(),
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
        menuTogglePlacement: 'before-brand',
      });

      await openCollapsedMobileMenu(container);
      const toggle = container.querySelector('#toggle-btn') as HTMLButtonElement;
      const brandLink = container.querySelector('#brand-link');

      toggle.focus();
      await fireEvent.keyDown(toggle, { key: 'Tab' });
      await waitForMobilePanelPosition(container);
      await tick();
      expect(document.activeElement).toBe(brandLink);
    });
  });

  test('brand Tab enters the portaled items after a before-brand toggle', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        brand: brandLinkSnippet(),
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
        menuTogglePlacement: 'before-brand',
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const brandLink = container.querySelector('#brand-link') as HTMLAnchorElement;
      const home = itemsRegion.querySelector('[data-key="home"]');

      brandLink.focus();
      await fireEvent.keyDown(brandLink, { key: 'Tab' });
      expect(document.activeElement).toBe(home);
    });
  });

  test('brand Tab enters the portaled items from a focusable SVG brand target', async () => {
    // `bridgeBrandTabToPortaledPanel` must accept an SVG `event.target`, not
    // just HTMLElement, now that brand focus targets can be SVG elements
    // (e.g. an inline logo with an explicit tabindex).
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        brand: svgBrandSnippet(),
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
        menuTogglePlacement: 'before-brand',
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const brandSvg = container.querySelector('#brand-svg') as SVGElement;
      const home = itemsRegion.querySelector('[data-key="home"]');

      // Dispatch directly on the SVG rather than focusing it first: this
      // exercises `event.target`, which is what the bridge guard checks,
      // independent of whether the DOM harness supports focusing SVG.
      await fireEvent.keyDown(brandSvg, { key: 'Tab' });
      expect(document.activeElement).toBe(home);
    });
  });

  test('bridges brand Tab into the portaled panel when the outer nav observes a shadow-retargeted target', async () => {
    // A keydown listener on the outer `<nav>` observes `event.target`
    // retargeted to the shadow host when the real Tab origin lives inside an
    // open shadow root (e.g. a brand logo that exposes its last tabbable
    // control from its own shadow DOM). happy-dom does not implement that
    // spec retargeting natively, so this test overrides `event.target`
    // directly -- the same pattern portal.test.ts uses -- to reproduce what
    // a real browser delivers, while `composedPath()` (driven by the actual
    // dispatch target) still reports the true originating shadow element.
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        brand: shadowBrandSnippet(),
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
        menuTogglePlacement: 'before-brand',
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const home = itemsRegion.querySelector('[data-key="home"]');
      const brandHost = container.querySelector('#brand-shadow-host') as HTMLElement;
      const shadowButton = brandHost.shadowRoot?.querySelector(
        '#brand-shadow-button',
      ) as HTMLElement;

      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        composed: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'target', { configurable: true, value: brandHost });
      shadowButton.dispatchEvent(event);

      expect(document.activeElement).toBe(home);
    });
  });

  test('brand Tab does not bridge into the portaled panel while the toggle is still ahead in native order', async () => {
    // A brand containing only a positive-tabindex control is still before
    // the default-tier toggle in native Tab order (positive tiers always
    // precede zero/default ones, regardless of DOM position). The bridge
    // must decline and leave `preventDefault()` uncalled so native Tab
    // handling can reach the toggle on its own -- happy-dom does not run
    // that native algorithm, so the observable result here is that focus
    // stays put rather than jumping to the portaled panel's first item.
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        brand: positiveOnlyBrandSnippet(),
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
        menuTogglePlacement: 'before-brand',
      });

      await openCollapsedMobileMenu(container);
      await waitForMobilePanelPosition(container);
      const brandPositive = container.querySelector('#brand-positive') as HTMLButtonElement;

      brandPositive.focus();
      await fireEvent.keyDown(brandPositive, { key: 'Tab' });
      expect(document.activeElement).toBe(brandPositive);
    });
  });

  test('toggle Tab skips a positive-tabindex brand control that native order already visited', async () => {
    // Brand focus targets are sorted globally (positive tabindex first), so
    // naively taking the first one from the toggle no longer means "the
    // first stop after the toggle" once a positive-tabindex brand control
    // exists alongside a normal one.
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        brand: positiveThenNormalBrandSnippet(),
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
        menuTogglePlacement: 'before-brand',
      });

      await openCollapsedMobileMenu(container);
      await waitForMobilePanelPosition(container);
      const toggle = container.querySelector('#toggle-btn') as HTMLButtonElement;
      const brandNormal = container.querySelector('#brand-normal');

      toggle.focus();
      await fireEvent.keyDown(toggle, { key: 'Tab' });
      expect(document.activeElement).toBe(brandNormal);
    });
  });

  test('toggle Tab skips a positive-tabindex navigation item that native order already visited', async () => {
    // The items fallback used to take the globally-first (lowest positive)
    // sequential item unconditionally. When the toggle itself has a higher
    // positive tabindex, native order has already visited any lower
    // positive-tabindex item, so Tab from the toggle must continue to a
    // same/higher positive item or the first zero-tier item instead.
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: positiveThenNormalNavigationSnippet(),
        menuToggle: toggleSnippet(),
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const toggle = container.querySelector('#toggle-btn') as HTMLButtonElement;
      const normalItem = itemsRegion.querySelector('[data-key="normal"]') as HTMLButtonElement;

      toggle.setAttribute('tabindex', '2');
      toggle.focus();
      await fireEvent.keyDown(toggle, { key: 'Tab' });
      expect(document.activeElement).toBe(normalItem);
    });
  });

  test('toggle Tab with a default tabindex lands on the first zero-tier item, not a later positive-tabindex item', async () => {
    // `getSequentialNavigationItems()` sorts positive-tabindex items first
    // globally, so the fallback used to take items[0] unconditionally and
    // land on a positive-tabindex item even when it sits later in DOM
    // order. Native forward Tab from a zero/default-tabindex toggle visits
    // zero-tier stops first — the positive item was already visited earlier
    // in native order — so the fallback must filter by the toggle's own
    // tab tier instead of taking the globally-first item.
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: normalThenPositiveNavigationSnippet(),
        menuToggle: toggleSnippet(),
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const toggle = container.querySelector('#toggle-btn') as HTMLButtonElement;
      const normalItem = itemsRegion.querySelector('[data-key="normal"]') as HTMLButtonElement;

      toggle.focus();
      await fireEvent.keyDown(toggle, { key: 'Tab' });
      expect(document.activeElement).toBe(normalItem);
    });
  });

  test('reverse Tab from portaled items returns to the final brand control', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        brand: multiControlBrandSnippet(),
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
        menuTogglePlacement: 'before-brand',
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const home = itemsRegion.querySelector('[data-key="home"]') as HTMLButtonElement;
      const finalBrandControl = container.querySelector('#brand-products');

      home.focus();
      await fireEvent.keyDown(home, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(finalBrandControl);
    });
  });

  test('reverse Tab threads the focused item tab tier into the brand lookup', async () => {
    // With a positive-tabindex first navigation item, reverse Tab must land
    // on the nearest lower-or-equal positive-tabindex brand control, not
    // fall straight to the zero/default-tier brand target the untiered
    // lookup previously always picked.
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        brand: positiveThenNormalBrandSnippet(),
        items: positiveFirstNavigationSnippet(),
        menuToggle: toggleSnippet(),
        menuTogglePlacement: 'before-brand',
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const home = itemsRegion.querySelector('[data-key="home"]') as HTMLButtonElement;
      const brandPositive = container.querySelector('#brand-positive');

      home.focus();
      await fireEvent.keyDown(home, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(brandPositive);
    });
  });

  test('reverse Tab skips brand controls removed from sequential tab order', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        brand: negativeFinalBrandSnippet(),
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
        menuTogglePlacement: 'before-brand',
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const home = itemsRegion.querySelector('[data-key="home"]') as HTMLButtonElement;
      const brandHome = container.querySelector('#brand-home');

      home.focus();
      await fireEvent.keyDown(home, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(brandHome);
    });
  });

  test('last portaled item tabs to the first page control after a bar without actions', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
      });
      const followingButton = document.createElement('button');
      followingButton.textContent = 'Following';
      document.body.append(followingButton);

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const settings = itemsRegion.querySelector('[data-key="settings"]') as HTMLButtonElement;

      settings.focus();
      await fireEvent.keyDown(settings, { key: 'Tab' });
      expect(document.activeElement).toBe(followingButton);
    });
  });

  test('last portaled item skips page controls removed from sequential tab order', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
      });
      const skippedButton = document.createElement('button');
      // `tabIndex` is a reflected property in browsers, so assigning -1
      // creates the same `tabindex="-1"` content attribute. happy-dom does not
      // implement that reflection and reports -1 for every attribute-less
      // button, so express the browser result directly in this DOM harness.
      skippedButton.setAttribute('tabindex', '-1');
      skippedButton.textContent = 'Skipped';
      const followingButton = document.createElement('button');
      followingButton.textContent = 'Following';
      document.body.append(skippedButton, followingButton);

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const settings = itemsRegion.querySelector('[data-key="settings"]') as HTMLButtonElement;

      settings.focus();
      await fireEvent.keyDown(settings, { key: 'Tab' });
      expect(document.activeElement).toBe(followingButton);
    });
  });

  test('desktop items remain an ordinary unnamed group', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      menuToggle: toggleSnippet(),
    });

    expect(container.querySelector('.cinder-navigation-bar__items')?.hasAttribute('role')).toBe(
      false,
    );
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
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: textSnippet('items'),
        menuToggle: toggleSnippet(),
      });
      await tick();
      const toggle = container.querySelector('#toggle-btn') as HTMLElement;
      const nav = container.querySelector('nav') as HTMLElement;

      emitNavigationBarResize(nav, 640);
      await tick();

      await fireEvent.click(toggle);
      expect(getItemsRegion(container).getAttribute('data-open')).toBe('true');

      await fireEvent.keyDown(nav, { key: 'Escape' });
      expect(getItemsRegion(container).getAttribute('data-open')).toBe('false');
    });
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
      items: captureSnippet,
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
      items: captureSnippet,
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

  test('variant resolution is gated on mobileMenuOpen || exitState.renderPanel, not mobileMenuOpen alone (CIN-376)', () => {
    // Regression guard: `mobileMenuOpen` flips to `false` the instant close
    // begins, so gating `variant` on it alone would resolve back to
    // 'horizontal' — stripping mobile item styling — while the panel is
    // still retained (`exitState.renderPanel`) and visibly playing its exit
    // transition. `createRawSnippet`'s `setup()` only runs once at mount
    // (see the test above), so this can't be observed by re-capturing the
    // snippet context reactively; assert the source condition directly,
    // mirroring the existing `cinder-_floating-surface` gating test.
    expect(navigationBarSource).toContain(
      'isCollapsible && isMobileLayout && (mobileMenuOpen || exitState.renderPanel)',
    );
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
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: textSnippet('items'),
        menuToggle: toggleSnippet(),
        onkeydown: () => {
          spyFired = true;
        },
      } as any);

      await tick();
      const toggle = container.querySelector('#toggle-btn') as HTMLElement;
      const nav = container.querySelector('nav') as HTMLElement;
      emitNavigationBarResize(nav, 640);
      await tick();

      await fireEvent.click(toggle);
      await fireEvent.keyDown(nav, { key: 'Escape' });

      expect(spyFired).toBe(true);
      expect(
        container.querySelector('.cinder-navigation-bar__items')?.getAttribute('data-open'),
      ).toBe('false');
    });
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

  test('writable native Event properties use the original event as their receiver', () => {
    expect(navigationBarSource).toMatch(
      /set\(target, property, value\)\s*\{\s*return Reflect\.set\(target, property, value, target\);/,
    );
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

  test('enabled item click closes an open collapsed mobile menu', async () => {
    await withResizeObserver(async () => {
      const clicks: Record<string, number> = {};
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet(clicks),
        menuToggle: toggleSnippet(),
      });

      await openCollapsedMobileMenu(container);

      const docs = getItemsRegion(container).querySelector('[data-key="docs"]') as HTMLElement;
      await fireEvent.click(docs);

      expect(clicks['docs']).toBe(1);
      expect(getItemsRegion(container).getAttribute('data-open')).toBe('false');
    });
  });

  test('enabled item descendant click closes an open collapsed mobile menu', async () => {
    await withResizeObserver(async () => {
      const clicks: Record<string, number> = {};
      const { container } = render(NavigationBar, {
        items: iconNavigationSnippet(clicks),
        menuToggle: toggleSnippet(),
      });

      await openCollapsedMobileMenu(container);

      const icon = getItemsRegion(container).querySelector(
        '[data-testid="home-icon"]',
      ) as SVGElement;
      await fireEvent.click(icon);

      expect(clicks['home']).toBe(1);
      expect(getItemsRegion(container).getAttribute('data-open')).toBe('false');
    });
  });

  test('consumer onclick can prevent the automatic collapsed mobile menu close', async () => {
    await withResizeObserver(async () => {
      const clicks: Record<string, number> = {};
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet(clicks),
        menuToggle: toggleSnippet(),
        onclick: function (this: HTMLElement, event: MouseEvent) {
          const nav = container.querySelector('nav') as HTMLElement;
          expect(this).toBe(nav);
          event.preventDefault();
        },
      } as any);

      await openCollapsedMobileMenu(container);

      const docs = getItemsRegion(container).querySelector('[data-key="docs"]') as HTMLElement;
      await fireEvent.click(docs);

      expect(clicks['docs']).toBe(1);
      expect(getItemsRegion(container).getAttribute('data-open')).toBe('true');
    });
  });

  test('cancelled item click keeps an open collapsed mobile menu open', async () => {
    await withResizeObserver(async () => {
      const clicks: Record<string, number> = {};
      const { container } = render(NavigationBar, {
        items: cancelingNavigationSnippet(clicks),
        menuToggle: toggleSnippet(),
      });

      await openCollapsedMobileMenu(container);

      const docs = getItemsRegion(container).querySelector('[data-key="docs"]') as HTMLElement;
      await fireEvent.click(docs);

      expect(clicks['docs']).toBe(1);
      expect(getItemsRegion(container).getAttribute('data-open')).toBe('true');
    });
  });

  test('Enter activation closes an open collapsed mobile menu', async () => {
    await withResizeObserver(async () => {
      const clicks: Record<string, number> = {};
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet(clicks),
        menuToggle: toggleSnippet(),
      });

      await openCollapsedMobileMenu(container);

      const docs = getItemsRegion(container).querySelector('[data-key="docs"]') as HTMLElement;
      docs.focus();
      await fireEvent.keyDown(docs, { key: 'Enter' });

      expect(clicks['docs']).toBe(1);
      expect(getItemsRegion(container).getAttribute('data-open')).toBe('false');
      expect(document.activeElement?.id).toBe('toggle-btn');
    });
  });

  test('Enter activation returns focus to the toggle when the collapsed mobile menu starts open', async () => {
    await withResizeObserver(async () => {
      const clicks: Record<string, number> = {};
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet(clicks),
        menuToggle: toggleSnippet(),
        mobileMenuOpen: true,
      });

      await setCollapsedMobileLayout(container);

      const docs = getItemsRegion(container).querySelector('[data-key="docs"]') as HTMLElement;
      docs.focus();
      await fireEvent.keyDown(docs, { key: 'Enter' });

      expect(clicks['docs']).toBe(1);
      expect(getItemsRegion(container).getAttribute('data-open')).toBe('false');
      expect(document.activeElement?.id).toBe('toggle-btn');
    });
  });

  test('Space activation closes an open collapsed mobile menu', async () => {
    await withResizeObserver(async () => {
      const clicks: Record<string, number> = {};
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet(clicks),
        menuToggle: toggleSnippet(),
      });

      await openCollapsedMobileMenu(container);

      const docs = getItemsRegion(container).querySelector('[data-key="docs"]') as HTMLElement;
      docs.focus();
      await fireEvent.keyDown(docs, { key: ' ' });

      expect(clicks['docs']).toBe(1);
      expect(getItemsRegion(container).getAttribute('data-open')).toBe('false');
    });
  });

  test('disabled item activation leaves an open collapsed mobile menu open', async () => {
    await withResizeObserver(async () => {
      const clicks: Record<string, number> = {};
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet(clicks),
        menuToggle: toggleSnippet(),
      });

      await openCollapsedMobileMenu(container);

      const billing = getItemsRegion(container).querySelector(
        '[data-key="billing"]',
      ) as HTMLElement;
      await fireEvent.click(billing);
      billing.focus();
      await fireEvent.keyDown(billing, { key: 'Enter' });
      await fireEvent.keyDown(billing, { key: ' ' });

      expect(clicks['billing']).toBe(1);
      expect(getItemsRegion(container).getAttribute('data-open')).toBe('true');
    });
  });

  test('evaluates isEnabledNavigationItem once per item when bridging Tab out of the portaled panel (#1186 row 3)', async () => {
    // isEnabledNavigationItem is not exported, so measure its cost via the
    // global getComputedStyle calls it makes walking each item's ancestor
    // chain. Establish a per-item baseline (`perItemCost`) through an
    // isolated interaction — ArrowRight from the first item to the second —
    // which invokes isEnabledNavigationItem exactly once (the immediate
    // next item is enabled, so `focusAdjacentNavigationItem`'s loop exits on
    // its first iteration). The Tab-bridging path under test additionally
    // calls `getSequentialFocusTargets` once (a fixed, fix-independent
    // per-item cost of its own), so the discriminating comparison is the
    // MULTIPLE of `perItemCost` the bridging call consumes across N items,
    // not an exact call count.
    await withResizeObserver(async () => {
      const itemCount = 8;
      const items = Array.from(
        { length: itemCount },
        (_, index) =>
          `<button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="item-${index}">Item ${index}</button>`,
      ).join('\n');
      const manyItemsSnippet = createRawSnippet(() => ({
        render: () => `<div>${items}</div>`,
        setup: () => {},
      }));

      const { container } = render(NavigationBar, {
        items: manyItemsSnippet,
        menuToggle: toggleSnippet(),
        actions: actionButtonSnippet(),
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const firstItem = itemsRegion.querySelector('[data-key="item-0"]') as HTMLButtonElement;
      const secondItem = itemsRegion.querySelector('[data-key="item-1"]') as HTMLButtonElement;
      const lastItem = itemsRegion.querySelector(
        `[data-key="item-${itemCount - 1}"]`,
      ) as HTMLButtonElement;

      firstItem.focus();
      const getComputedStyleSpy = spyOn(globalThis, 'getComputedStyle');
      await fireEvent.keyDown(firstItem, { key: 'ArrowRight' });
      expect(document.activeElement).toBe(secondItem);
      const perItemCost = getComputedStyleSpy.mock.calls.length;
      expect(perItemCost).toBeGreaterThan(0);
      getComputedStyleSpy.mockClear();

      lastItem.focus();
      await fireEvent.keyDown(lastItem, { key: 'Tab' });
      const bridgingCallCount = getComputedStyleSpy.mock.calls.length;
      getComputedStyleSpy.mockRestore();

      // Correctness: the bridge actually fired (focus left the panel).
      expect(document.activeElement).not.toBe(lastItem);

      // Pre-fix, isEnabledNavigationItem runs twice per item (once inside
      // getSequentialNavigationItems, once via the direct .filter call) on
      // top of getSequentialFocusTargets' own fixed per-item cost — measured
      // at itemCount=8 (perItemCost=6): ~198 calls pre-fix vs ~102 post-fix.
      // The threshold below sits at roughly the geometric midpoint, well
      // clear of both measured values, so it discriminates the duplication
      // without pinning an exact count.
      expect(bridgingCallCount).toBeLessThan(itemCount * perItemCost * 3);
    });
  });
});

describe('NavigationBar responsive CSS', () => {
  test('mobile item geometry follows the ResizeObserver-backed mobile panel state', () => {
    expect(navigationBarCss).toContain('container-name: cinder-navigation-bar;');
    expect(navigationBarCss).toContain('@container cinder-navigation-bar (max-width: 47.99rem)');
    expect(navigationBarCss).toMatch(
      /\.cinder-navigation-bar__items\[data-cinder-mobile-panel\]\[data-cinder-visible\][\s\S]*?\.cinder-navigation-item\[data-variant='mobile'\][\s\S]*?inline-size:\s*100%;/,
    );
  });

  test('closed collapsible items are hidden by the container query before hydration', () => {
    expect(navigationBarCss).toMatch(
      /@container cinder-navigation-bar \(max-width: 47\.99rem\)[\s\S]*?\.cinder-navigation-bar\[data-collapsible='true'\][\s\S]*?\.cinder-navigation-bar__items:not\(\[data-cinder-mobile-panel\]\)\s*\{[\s\S]*?display:\s*none;/,
    );
  });

  test('mobile panels are out of body flow before floating positioning completes', () => {
    expect(navigationBarCss).toMatch(
      /\.cinder-navigation-bar__items\[data-cinder-mobile-panel\]\s*\{[\s\S]*?position:\s*fixed;/,
    );
  });

  test('mobile panel scrolls its own overflow instead of painting past the fixed panel', () => {
    // The shared floating-surface base rule only enables scrolling for
    // role="listbox"/"menu"; this panel is neither, so it needs its own
    // overflow: auto or a tall item list clips with no way to reach the rest.
    expect(navigationBarCss).toMatch(
      /\.cinder-navigation-bar__items\[data-cinder-mobile-panel\]\s*\{[\s\S]*?overflow:\s*auto;/,
    );
  });

  test('portaled scope keeps the mirrored root class selector-only, not box-producing', () => {
    // The portal scope mirrors `cinder-navigation-bar` purely so root-scoped
    // consumer overrides keep matching while portaled — it must not also
    // pick up the root rule's height/padding/background/border, or the
    // portal target grows a blank second nav bar while the mobile menu is
    // open.
    expect(navigationBarCss).toMatch(
      /\.cinder-navigation-bar__portal-scope\.cinder-navigation-bar\s*\{[\s\S]*?height:\s*auto;[\s\S]*?padding-inline:\s*0;[\s\S]*?background:\s*none;[\s\S]*?border-bottom:\s*none;/,
    );
  });

  test('portaled scope is not a named container while it is a display:block portal target', () => {
    // The mirrored class also mirrors the root's `container-name:
    // cinder-navigation-bar`. A `display: block` portal target sized to
    // document.body would otherwise be a same-named query container that a
    // future `@container cinder-navigation-bar` rule could resolve against
    // instead of the actual nav bar.
    expect(navigationBarCss).toMatch(
      /\.cinder-navigation-bar__portal-scope\.cinder-navigation-bar\s*\{[\s\S]*?container-type:\s*normal;[\s\S]*?container-name:\s*none;/,
    );
  });

  test('collapsed menu toggle stays with trailing actions instead of centering between brand and actions', () => {
    expect(navigationBarCss).toMatch(
      /@container cinder-navigation-bar \(max-width: 47\.99rem\)[\s\S]*?\.cinder-navigation-bar\[data-collapsible='true'\]\[data-cinder-menu-toggle-placement='after-brand'\][\s\S]*?\.cinder-navigation-bar__menu-toggle\s*\{[\s\S]*?margin-inline-start:\s*auto;/,
    );
    expect(navigationBarCss).not.toMatch(
      /data-cinder-menu-toggle-placement='before-brand'[\s\S]*?margin-inline-start:\s*auto;/,
    );
  });

  test('bottom placement owns tab-bar geometry and label visibility without a new component directory', () => {
    expect(navigationBarCss).toMatch(
      /\.cinder-navigation-bar\[data-cinder-placement='bottom'\][\s\S]*?border-top:\s*1px solid var\(--cinder-border-muted\)/,
    );
    expect(navigationBarCss).toMatch(
      /\.cinder-navigation-bar\[data-cinder-placement='bottom'\][\s\S]*?\.cinder-navigation-item\[data-variant='mobile'\][\s\S]*?flex-direction:\s*column;/,
    );
    expect(navigationBarCss).toContain("[data-cinder-label-visibility='active']");
    expect(navigationBarCss).toContain('[data-cinder-navigation-label]');
    expect(existsSync(new URL('../bottom-navigation', import.meta.url))).toBe(false);
  });

  test('bottom tabs make the touch target the dominant bar dimension', () => {
    expect(navigationBarCss).toMatch(
      /data-cinder-placement='bottom'[\s\S]*?\.cinder-navigation-item\[data-variant='mobile'\][\s\S]*?min-block-size:\s*4rem;[\s\S]*?padding-block:\s*var\(--cinder-space-1\);/,
    );
  });

  test('bottom tabs also floor the inline axis at the touch-target minimum, not just block', () => {
    // `flex: 1 1 0` has no inline floor on its own — with enough tabs in a
    // narrow bar the item can shrink under 44px wide even though the block
    // axis is already generously covered by the 4rem above.
    expect(navigationBarCss).toMatch(
      /data-cinder-placement='bottom'[\s\S]*?\.cinder-navigation-item\[data-variant='mobile'\][\s\S]*?min-block-size:\s*4rem;[\s\S]*?min-inline-size:\s*var\(--cinder-touch-target-min\);/,
    );
  });

  test('the bottom tab row scrolls rather than clipping when the touch floor overflows it', () => {
    // The inline floor above is non-negotiable, so enough tabs in a narrow bar WILL
    // exceed the container. Without an overflow strategy the excess is clipped and
    // unreachable, because a bottom bar is normally sticky or fixed inside a clipping
    // host — the floor would then trade one accessibility failure for another.
    const bottomItemsRule =
      navigationBarCss.match(
        /\.cinder-navigation-bar\[data-cinder-placement='bottom'\] \.cinder-navigation-bar__items \{[^}]*\}/,
      )?.[0] ?? '';

    expect(bottomItemsRule).toContain('overflow-x: auto');
    expect(bottomItemsRule).not.toContain('overflow-x: hidden');

    // Scrolling one axis forces the other to compute as `auto` too — CSS does not let
    // one axis scroll while the other stays visible — so this container now clips
    // vertically. navigation-item's focus ring is a box-shadow painted OUTSIDE the
    // tab, so without block padding to sit in, enabling the scroll would have traded
    // an unreachable tab for an invisible focus ring. The negative margin cancels the
    // padding so the bar's height is unchanged.
    expect(bottomItemsRule).toContain('padding-block: var(--_cinder-navigation-bar-tab-ring-room)');
    expect(bottomItemsRule).toContain(
      'margin-block: calc(-1 * var(--_cinder-navigation-bar-tab-ring-room))',
    );
  });

  test('top-collapsible mobile active items use row selection instead of the horizontal underline', () => {
    expect(navigationBarCss).toMatch(
      /\.cinder-navigation-bar__items\[data-cinder-mobile-panel\]\[data-cinder-visible\][\s\S]*?\.cinder-navigation-item\[data-variant='mobile'\][\s\S]*?border-bottom:\s*none;[\s\S]*?border-inline-start:\s*2px solid transparent;/,
    );
    expect(navigationBarCss).toMatch(
      /\.cinder-navigation-bar__items\[data-cinder-mobile-panel\]\[data-cinder-visible\][\s\S]*?\.cinder-navigation-item\[data-variant='mobile'\]\[data-active='true'\][\s\S]*?border-inline-start-color:\s*var\(--cinder-accent-solid\);[\s\S]*?background-color:\s*var\(--cinder-surface-inset\);/,
    );
  });

  test('top-collapsible mobile panel rows meet the touch-target minimum', () => {
    // navigation-item.css's shared base rule only floors this row at
    // `min-height: 2rem` (32px); nothing in the mobile-panel rule overrode
    // that until now, so the row rendered under the 44px floor.
    expect(navigationBarCss).toMatch(
      /\.cinder-navigation-bar__items\[data-cinder-mobile-panel\]\[data-cinder-visible\][\s\S]*?\.cinder-navigation-item\[data-variant='mobile'\][\s\S]*?min-block-size:\s*var\(--cinder-touch-target-min\);/,
    );
  });

  test('top-collapsible mobile panel rows are concentric with the panel, not a smaller radius step', () => {
    // The panel is `--cinder-radius-md` inset by its own `--cinder-space-2`
    // padding (this file's `.cinder-navigation-bar__items[data-cinder-mobile-panel]`
    // rule overrides `cinder-_floating-surface`'s default padding). The row's
    // radius must be derived from that same pair of tokens, not an unrelated
    // step off the scale like `--cinder-radius-sm`.
    expect(navigationBarCss).toMatch(
      /\.cinder-navigation-bar__items\[data-cinder-mobile-panel\]\[data-cinder-visible\][\s\S]*?\.cinder-navigation-item\[data-variant='mobile'\][\s\S]*?border-radius:\s*calc\(var\(--cinder-radius-md\) - var\(--cinder-space-2\)\);/,
    );
    expect(navigationBarCss).not.toMatch(
      /\.cinder-navigation-bar__items\[data-cinder-mobile-panel\]\[data-cinder-visible\][\s\S]*?\.cinder-navigation-item\[data-variant='mobile'\][\s\S]*?border-radius:\s*var\(--cinder-radius-sm\);/,
    );
  });
});
