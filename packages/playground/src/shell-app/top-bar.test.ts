/// <reference lib="dom" />
/**
 * DOM-mount tests for `top-bar.svelte`.
 *
 * Setup mirrors `event-source.test.ts`: happy-dom globals are installed onto
 * `globalThis` before `@testing-library/svelte` loads so component mount has a
 * working DOM. `top-bar.svelte` reads the shared store via `getPreviewStore()`
 * and the announcer via `getAnnouncer()`, so we mount it through
 * `top-bar-fixture.svelte`, which installs a real `PreviewStore` and `Announcer`
 * on the context first.
 *
 * Two contracts are covered:
 *  - the "Open in new tab" button calls `window.open` with the isolated
 *    `/page/` URL and is absent when no component is selected;
 *  - the theme SegmentedControl routes through `store.setTheme` (never a direct
 *    `store.theme` assignment) and `announce()` populates the shared `aria-live`
 *    region after the deliberate 50 ms empty-then-set gap.
 * They avoid incidental structure (class names, element ordering) so sibling
 * refactors of `top-bar.svelte` don't break them.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../../components/src/test/happy-dom.ts';

// Install happy-dom globals via the shared, idempotent helper BEFORE
// dynamic-importing @testing-library/svelte. Using the single shared window
// (rather than a private `new Window()`) keeps this file's globals consistent
// with the other shell-app DOM tests when the whole suite runs in one process —
// competing window installs leak `document`/`activeElement` across files and
// make focus assertions flaky.
setupHappyDom();

const happyWindow = window as unknown as typeof globalThis & Window;
// The open-in-new-tab button reads `window.location.origin`; resolve the shared
// window's origin so the URL assertion is correct regardless of its default URL.
const ORIGIN = happyWindow.location.origin;

const { render } = await import('@testing-library/svelte');
const { default: TopBarFixture } = await import('./top-bar-fixture.svelte');
const { PreviewStore } = await import('./preview-store.svelte.ts');
const { tick } = await import('svelte');

type ThemeChoice = import('./preview-store.svelte.ts').ThemeChoice;

type OpenCall = { url: string | URL; targetName: string | undefined; features: string | undefined };

let openCalls: OpenCall[] = [];

beforeEach(() => {
  openCalls = [];
  Object.defineProperty(happyWindow, 'open', {
    configurable: true,
    writable: true,
    value: (url: string | URL, targetName?: string, features?: string) => {
      openCalls.push({ url, targetName, features });
      return null;
    },
  });
});

afterEach(() => {
  delete (happyWindow as unknown as Record<string, unknown>)['open'];
});

/** Resolve after `ms` real milliseconds — `announce()` uses a 50 ms timer. */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Find a `<button>` by its trimmed visible text. The theme segments render as
 * buttons whose text is the option label ("Light", etc.) and the toolbar
 * action buttons carry a stable `aria-label` — both are accessible, stable
 * selectors rather than incidental markup.
 */
function buttonByText(container: HTMLElement, text: string): HTMLButtonElement {
  const buttons = [...container.querySelectorAll<HTMLButtonElement>('button')];
  const match = buttons.find((button) => button.textContent?.trim() === text);
  if (!match) throw new Error(`No button with text "${text}"`);
  return match;
}

function buttonByLabel(container: HTMLElement, label: string): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (button === null) throw new Error(`No button with aria-label "${label}"`);
  return button;
}

function linkByLabel(container: HTMLElement, label: string): HTMLAnchorElement {
  const link = container.querySelector<HTMLAnchorElement>(`a[aria-label="${label}"]`);
  if (link === null) throw new Error(`No link with aria-label "${label}"`);
  return link;
}

/** Find a button whose aria-label matches a pattern (for long/verbose labels). */
function buttonByLabelMatch(container: HTMLElement, pattern: RegExp): HTMLButtonElement {
  const buttons = [...container.querySelectorAll<HTMLButtonElement>('button[aria-label]')];
  const match = buttons.find((button) => pattern.test(button.getAttribute('aria-label') ?? ''));
  if (!match) throw new Error(`No button with aria-label matching ${pattern}`);
  return match;
}

/** The single polite aria-live announcement region rendered by the shell. */
function liveRegion(container: HTMLElement): HTMLElement {
  const region = container.querySelector<HTMLElement>('[aria-live="polite"]');
  if (region === null) throw new Error('No aria-live region found');
  return region;
}

describe('top-bar open-in-new-tab button', () => {
  test('renders Cinder chrome hooks required by the shell stylesheet', async () => {
    const store = new PreviewStore('button');
    store.previewWidth = 375;
    const { container, unmount } = render(TopBarFixture, { store });
    await tick();

    expect(container.querySelector('.cinder-toolbar')?.getAttribute('aria-label')).toBe(
      'Playground controls',
    );
    expect(container.querySelectorAll('.cinder-toolbar__group').length).toBeGreaterThanOrEqual(4);
    expect(container.querySelector('.cinder-toolbar__spacer')).not.toBeNull();
    expect(container.querySelectorAll('.cinder-segmented-control').length).toBeGreaterThanOrEqual(
      2,
    );
    // Open-in-new-tab (↗) and focus-mode (⛶) are the two cinder Buttons in the
    // toolbar; the narrow-viewport sidebar toggle is a plain <button>, not a
    // .cinder-button.
    expect(container.querySelectorAll('.cinder-button').length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector('input.cinder-input')).not.toBeNull();

    unmount();
  });

  test('renders the button when a component is selected', async () => {
    const { container, unmount } = render(TopBarFixture, { currentComponent: 'button' });
    await tick();
    const button = container.querySelector('button[aria-label="Open preview in new tab"]');
    expect(button).not.toBeNull();
    unmount();
  });

  test('does not render the button when no component is selected', async () => {
    const { container, unmount } = render(TopBarFixture, { currentComponent: '' });
    await tick();
    const button = container.querySelector('button[aria-label="Open preview in new tab"]');
    expect(button).toBeNull();
    unmount();
  });

  test('clicking the button calls window.open with the isolated /page/ URL', async () => {
    const { container, unmount } = render(TopBarFixture, { currentComponent: 'accordion' });
    await tick();

    const button = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Open preview in new tab"]',
    );
    expect(button).not.toBeNull();

    button?.click();
    await tick();

    expect(openCalls.length).toBe(1);
    expect(openCalls[0]?.url).toBe(`${ORIGIN}/page/accordion`);
    expect(openCalls[0]?.targetName).toBe('_blank');
    expect(openCalls[0]?.features).toBe('noopener');
    unmount();
  });

  test('points the color token toggle at the panel container', async () => {
    const { container, unmount } = render(TopBarFixture, { currentComponent: 'button' });
    await tick();

    const button = buttonByLabel(container, 'Color token panel');
    expect(button.getAttribute('aria-controls')).toBe('color-token-panel');

    unmount();
  });
});

describe('top-bar resource links', () => {
  test('renders external links to the GitHub repository and npm package', async () => {
    const { container, unmount } = render(TopBarFixture, { currentComponent: 'button' });
    await tick();

    const githubLink = linkByLabel(container, 'Open GitHub repository');
    expect(githubLink.getAttribute('href')).toBe('https://github.com/stevekinney/cinder');
    expect(githubLink.getAttribute('target')).toBe('_blank');
    expect(githubLink.getAttribute('rel')).toBe('noopener noreferrer');

    const npmLink = linkByLabel(container, 'Open npm package');
    expect(npmLink.getAttribute('href')).toBe('https://www.npmjs.com/package/@lostgradient/cinder');
    expect(npmLink.getAttribute('target')).toBe('_blank');
    expect(npmLink.getAttribute('rel')).toBe('noopener noreferrer');

    unmount();
  });
});

describe('top-bar theme selection', () => {
  test('selecting a theme segment routes through store.setTheme', async () => {
    const store = new PreviewStore('button');
    const themeCalls: ThemeChoice[] = [];
    // Spy on the public write path. The top bar must call setTheme (which also
    // persists + applies color-scheme), never assign store.theme directly.
    store.setTheme = (value: ThemeChoice) => {
      themeCalls.push(value);
    };

    const { container } = render(TopBarFixture, { store });
    await tick();

    buttonByText(container, 'Dark').click();
    await tick();

    expect(themeCalls).toEqual(['dark']);
  });

  test('selecting the light theme segment passes "light" to setTheme', async () => {
    // Seed a 'dark' override so 'Dark' is the active segment; otherwise the
    // resolved browser theme in the test environment ('light') already selects
    // 'Light', and clicking the active segment is a no-op that never fires
    // onchange. Starting from dark makes the Light click a genuine change.
    const store = new PreviewStore('button', { theme: 'dark' });
    const themeCalls: ThemeChoice[] = [];
    store.setTheme = (value: ThemeChoice) => {
      themeCalls.push(value);
    };

    const { container } = render(TopBarFixture, { store });
    await tick();

    buttonByText(container, 'Light').click();
    await tick();

    expect(themeCalls).toEqual(['light']);
  });

  test('entering focus mode closes an open sidebar drawer', async () => {
    // Focus mode hides the sidebar entirely; an open narrow-viewport drawer must
    // be closed too, or its scrim is orphaned over the fullscreen preview. The
    // color-token panel is also shell chrome, so it closes with the rest of the
    // chrome.
    const store = new PreviewStore('button');
    store.isSidebarOpen = true;
    store.isColorTokenPanelOpen = true;
    const { container } = render(TopBarFixture, { store });
    await tick();

    buttonByLabelMatch(container, /Focus mode/).click();
    await tick();

    expect(store.isFocusMode).toBe(true);
    expect(store.isSidebarOpen).toBe(false);
    expect(store.isColorTokenPanelOpen).toBe(false);
  });

  test('toggling focus mode off does not reopen the drawer', async () => {
    const store = new PreviewStore('button');
    store.isFocusMode = true;
    const { container } = render(TopBarFixture, { store });
    await tick();

    buttonByLabelMatch(container, /Focus mode/).click();
    await tick();

    expect(store.isFocusMode).toBe(false);
    expect(store.isSidebarOpen).toBe(false);
  });
});

describe('top-bar announcements', () => {
  test('aria-live region is empty until the 50 ms gap elapses, then carries the message', async () => {
    const store = new PreviewStore('button');
    const { container } = render(TopBarFixture, { store });
    await tick();

    const region = liveRegion(container);
    expect(region.textContent?.trim()).toBe('');

    // Toggling the sidebar button triggers announce(). The 50 ms empty-then-set
    // gap means the message is NOT yet present right after the click.
    buttonByLabel(container, 'Toggle component list').click();
    await tick();
    expect(region.textContent?.trim()).toBe('');

    // After the gap, the announcement text appears.
    await wait(80);
    await tick();
    expect(region.textContent?.trim()).toBe('Component list shown');
  });

  test('a second announcement replaces the first after its own 50 ms gap', async () => {
    const store = new PreviewStore('button');
    const { container } = render(TopBarFixture, { store });
    await tick();

    const region = liveRegion(container);

    buttonByLabel(container, 'Toggle component list').click();
    await wait(80);
    await tick();
    expect(region.textContent?.trim()).toBe('Component list shown');

    // Toggle again — hidden this time. The region clears immediately, then fills
    // with the new message after the gap.
    buttonByLabel(container, 'Toggle component list').click();
    await tick();
    expect(region.textContent?.trim()).toBe('');

    await wait(80);
    await tick();
    expect(region.textContent?.trim()).toBe('Component list hidden');
  });
});
