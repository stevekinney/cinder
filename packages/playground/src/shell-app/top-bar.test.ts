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
 * buttons whose text is the option label ("Light theme", etc.) and the toolbar
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

/** The single polite aria-live announcement region rendered by the shell. */
function liveRegion(container: HTMLElement): HTMLElement {
  const region = container.querySelector<HTMLElement>('[aria-live="polite"]');
  if (region === null) throw new Error('No aria-live region found');
  return region;
}

describe('top-bar open-in-new-tab button', () => {
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

    buttonByText(container as HTMLElement, 'Dark theme').click();
    await tick();

    expect(themeCalls).toEqual(['dark']);
  });

  test('selecting the light theme segment passes "light" to setTheme', async () => {
    const store = new PreviewStore('button');
    const themeCalls: ThemeChoice[] = [];
    store.setTheme = (value: ThemeChoice) => {
      themeCalls.push(value);
    };

    const { container } = render(TopBarFixture, { store });
    await tick();

    buttonByText(container as HTMLElement, 'Light theme').click();
    await tick();

    expect(themeCalls).toEqual(['light']);
  });
});

describe('top-bar announcements', () => {
  test('aria-live region is empty until the 50 ms gap elapses, then carries the message', async () => {
    const store = new PreviewStore('button');
    const { container } = render(TopBarFixture, { store });
    await tick();

    const region = liveRegion(container as HTMLElement);
    expect(region.textContent?.trim()).toBe('');

    // Toggling the checkerboard button triggers announce(). The 50 ms
    // empty-then-set gap means the message is NOT yet present right after.
    buttonByLabel(container as HTMLElement, 'Show transparency grid').click();
    await tick();
    expect(region.textContent?.trim()).toBe('');

    // After the gap, the announcement text appears.
    await wait(80);
    await tick();
    expect(region.textContent?.trim()).toBe('Checkerboard background on');
  });

  test('a second announcement replaces the first after its own 50 ms gap', async () => {
    const store = new PreviewStore('button');
    const { container } = render(TopBarFixture, { store });
    await tick();

    const region = liveRegion(container as HTMLElement);

    buttonByLabel(container as HTMLElement, 'Show transparency grid').click();
    await wait(80);
    await tick();
    expect(region.textContent?.trim()).toBe('Checkerboard background on');

    // Toggle again — off this time. The region clears immediately, then fills
    // with the new message after the gap.
    buttonByLabel(container as HTMLElement, 'Show transparency grid').click();
    await tick();
    expect(region.textContent?.trim()).toBe('');

    await wait(80);
    await tick();
    expect(region.textContent?.trim()).toBe('Checkerboard background off');
  });
});
