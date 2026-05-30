/// <reference lib="dom" />
/**
 * DOM-mount tests for `preview-frame.svelte`.
 *
 * Setup mirrors `event-source.test.ts`: happy-dom is installed onto
 * `globalThis` before `@testing-library/svelte` loads so component mount has a
 * working DOM. `preview-frame.svelte` reads the shared store via
 * `getPreviewStore()`, so the tests mount it through one of two fixtures:
 *   - `preview-frame-driver.svelte` installs a `PreviewStore` and exposes
 *     `setComponentName` so a test can simulate sidebar navigation (which flips
 *     `src` on the iframe) — used by the loading-state suite.
 *   - `preview-frame-fixture.svelte` installs the test's `PreviewStore` directly
 *     — used by the src-construction and handleLoad suites.
 *
 * The iframe never actually fetches a document under happy-dom, so we drive the
 * `handleLoad` path by dispatching a synthetic `load` event on the iframe
 * element — exactly the event the real browser fires when the new preview
 * document paints.
 *
 * Assertions target STABLE contracts (the loading overlay/live-region behaviour,
 * the `buildIframeSrc` URL contract, the empty-state placeholder, and the
 * theme/background `postMessage` replay) and avoid incidental structure so
 * sibling refactors don't break them.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../../components/src/test/happy-dom.ts';

// Install happy-dom globals via the shared, idempotent helper BEFORE
// dynamic-importing @testing-library/svelte. Using the single shared window
// (rather than a private `new Window()`) keeps this file's globals consistent
// with the other shell-app DOM tests when the whole suite runs in one process —
// competing window installs leak `document`/`activeElement` across files.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Driver } = await import('./preview-frame-driver.svelte');
const { default: PreviewFrameFixture } = await import('./preview-frame-fixture.svelte');
const { PreviewStore } = await import('./preview-store.svelte.ts');
const { buildIframeSrc } = await import('./routing.ts');
const { tick } = await import('svelte');

type PreviewMessage = import('./routing.ts').PreviewMessage;

const OVERLAY = '[data-testid="preview-loading-overlay"]';

/** Fire the `load` event the browser would dispatch once the iframe paints. */
function dispatchIframeLoad(container: HTMLElement): void {
  const iframe = container.querySelector('iframe');
  expect(iframe).not.toBeNull();
  iframe?.dispatchEvent(new Event('load'));
}

beforeEach(() => {
  // Each render owns its own component tree; nothing global to reset, but keep
  // a stable URL so PreviewStore's URL writes don't accumulate across tests.
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

const WRAPPER = '.preview-frame-wrapper';
// The persistent, visually-hidden live region — distinct from the Spinner's own
// role="status", which lives inside the aria-hidden overlay. It is hoisted OUT
// of `.preview-frame-wrapper` (which carries `aria-busy`) so its announcements
// are not suppressed, so we scope the selector to `.preview-host` directly.
const LIVE_REGION = '.preview-host > .sr-only[role="status"]';

describe('preview-frame loading state', () => {
  test('starts loading with the overlay visible on first mount', async () => {
    const { container, unmount } = render(Driver, { initial: 'button' });
    await tick();

    expect(container.querySelector(OVERLAY)).not.toBeNull();
    // The iframe carries the loading class so its opacity transition can run.
    expect(container.querySelector('iframe')?.classList.contains('is-loading')).toBe(true);

    unmount();
  });

  test('handleLoad clears loading and removes the overlay', async () => {
    const { container, unmount } = render(Driver, { initial: 'button' });
    await tick();
    expect(container.querySelector(OVERLAY)).not.toBeNull();

    dispatchIframeLoad(container);
    await tick();

    expect(container.querySelector(OVERLAY)).toBeNull();
    expect(container.querySelector('iframe')?.classList.contains('is-loading')).toBe(false);

    unmount();
  });

  test('re-arms loading when the selected component (src) changes', async () => {
    const { container, component, unmount } = render(Driver, { initial: 'button' });
    await tick();

    // Settle the initial load so we observe the transition, not the seed state.
    dispatchIframeLoad(container);
    await tick();
    expect(container.querySelector(OVERLAY)).toBeNull();

    // Navigate to another component — src changes, overlay returns.
    component['setComponentName']('card');
    await tick();
    expect(container.querySelector(OVERLAY)).not.toBeNull();
    expect(container.querySelector('iframe')?.classList.contains('is-loading')).toBe(true);

    // The new document paints — overlay clears again.
    dispatchIframeLoad(container);
    await tick();
    expect(container.querySelector(OVERLAY)).toBeNull();

    unmount();
  });

  test('reload() re-arms the overlay even though src is unchanged (hot reload)', async () => {
    const { container, component, unmount } = render(Driver, { initial: 'button' });
    await tick();

    // Settle the initial load so the overlay is gone before we reload.
    dispatchIframeLoad(container);
    await tick();
    expect(container.querySelector(OVERLAY)).toBeNull();

    // Live reload keeps the same component (src), so the old src-only loading
    // derivation would never re-show the overlay. reload() must re-arm it.
    component['reload']();
    await tick();
    expect(container.querySelector(OVERLAY)).not.toBeNull();
    expect(container.querySelector('iframe')?.classList.contains('is-loading')).toBe(true);

    // The reloaded document paints — overlay clears again.
    dispatchIframeLoad(container);
    await tick();
    expect(container.querySelector(OVERLAY)).toBeNull();

    unmount();
  });

  test('overlay spinner is hidden from assistive tech to avoid a duplicate announcement', async () => {
    const { container, unmount } = render(Driver, { initial: 'button' });
    await tick();

    const overlay = container.querySelector(OVERLAY);
    expect(overlay).not.toBeNull();
    // The visual overlay (and its Spinner's own role="status") must be hidden
    // so the persistent live region is the single spoken status.
    expect(overlay?.getAttribute('aria-hidden')).toBe('true');

    unmount();
  });

  test('wrapper sets aria-busy while loading and clears it when ready', async () => {
    const { container, unmount } = render(Driver, { initial: 'button' });
    await tick();

    const wrapper = container.querySelector(WRAPPER);
    expect(wrapper).not.toBeNull();
    expect(wrapper?.getAttribute('aria-busy')).toBe('true');

    dispatchIframeLoad(container);
    await tick();
    expect(wrapper?.getAttribute('aria-busy')).toBe('false');

    unmount();
  });

  test('persistent live region stays mounted and swaps its text on load', async () => {
    const { container, unmount } = render(Driver, { initial: 'button' });
    await tick();

    // The live region exists immediately and announces the loading state.
    const live = container.querySelector(LIVE_REGION);
    expect(live).not.toBeNull();
    expect(live?.getAttribute('aria-live')).toBe('polite');
    expect(live?.textContent).toBe('Loading preview');

    dispatchIframeLoad(container);
    await tick();

    // It is STILL in the DOM — only its text changed — so the completion is
    // actually announced rather than silently dropped.
    expect(container.querySelector(LIVE_REGION)).not.toBeNull();
    expect(container.querySelector(LIVE_REGION)?.textContent).toBe('Preview ready');

    unmount();
  });

  test('live region is NOT nested inside the aria-busy wrapper', async () => {
    // Regression for the review finding: a polite live region nested inside an
    // `aria-busy="true"` container can have its updates suppressed/deferred by
    // some screen readers (NVDA + Firefox). The region must be a sibling of the
    // wrapper at the `.preview-host` level so the "Preview ready" announcement
    // always fires.
    const { container, unmount } = render(Driver, { initial: 'button' });
    await tick();

    const wrapper = container.querySelector(WRAPPER);
    const live = container.querySelector(LIVE_REGION);
    expect(wrapper).not.toBeNull();
    expect(live).not.toBeNull();

    // The wrapper is the element carrying aria-busy.
    expect(wrapper?.getAttribute('aria-busy')).toBe('true');
    // The live region must not be inside that aria-busy subtree.
    expect(wrapper?.contains(live ?? null)).toBe(false);
    // And it must be a direct child of the preview host.
    const host = container.querySelector<HTMLElement>('.preview-host');
    expect(host).not.toBeNull();
    expect(live?.parentElement).toBe(host);

    unmount();
  });
});

/** The single preview iframe rendered by the frame, or null when absent. */
function iframeIn(container: HTMLElement): HTMLIFrameElement | null {
  return container.querySelector<HTMLIFrameElement>('iframe[data-cinder-preview]');
}

/**
 * Replace the iframe's contentWindow.postMessage with a recorder so we can
 * assert exactly what handleLoad replays. Returns the captured-message array.
 */
function captureFrameMessages(iframe: HTMLIFrameElement): PreviewMessage[] {
  const messages: PreviewMessage[] = [];
  const win = iframe.contentWindow;
  if (win === null) throw new Error('iframe has no contentWindow');
  (win as unknown as { postMessage: (message: PreviewMessage) => void }).postMessage = (
    message: PreviewMessage,
  ) => {
    messages.push(message);
  };
  return messages;
}

describe('preview-frame src construction', () => {
  test('builds iframe src from componentName via buildIframeSrc', async () => {
    const store = new PreviewStore('button');
    const { container } = render(PreviewFrameFixture, { store, componentName: 'button' });
    await tick();

    const iframe = iframeIn(container);
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute('src')).toBe(buildIframeSrc('button'));
    expect(iframe?.getAttribute('src')).toBe('/page/button');
  });

  test('encodes component names defensively in the src', async () => {
    const store = new PreviewStore('a b');
    const { container } = render(PreviewFrameFixture, { store, componentName: 'a b' });
    await tick();

    const iframe = iframeIn(container);
    // encodeURIComponent turns the space into %20 — matches buildIframeSrc.
    expect(iframe?.getAttribute('src')).toBe(buildIframeSrc('a b'));
    expect(iframe?.getAttribute('src')).toBe('/page/a%20b');
  });

  test('sets a descriptive iframe title from componentName', async () => {
    const store = new PreviewStore('card');
    const { container } = render(PreviewFrameFixture, { store, componentName: 'card' });
    await tick();

    const iframe = iframeIn(container);
    expect(iframe?.getAttribute('title')).toBe('card preview');
  });

  test('renders the empty-state placeholder (no iframe) when componentName is empty', async () => {
    const store = new PreviewStore('');
    const { container } = render(PreviewFrameFixture, { store, componentName: '' });
    await tick();

    expect(iframeIn(container)).toBeNull();
    expect(container.textContent).toContain('No component selected');
  });
});

describe('preview-frame handleLoad', () => {
  test('replays the current theme and background to the iframe on load', async () => {
    const store = new PreviewStore('button', { theme: 'dark', background: 'checker' });
    const { container } = render(PreviewFrameFixture, { store, componentName: 'button' });
    await tick();

    const iframe = iframeIn(container);
    if (iframe === null) throw new Error('expected an iframe');

    // Install the recorder AFTER mount so the mount-time $effect posts don't
    // pollute the assertion — we only want what the load event replays.
    const messages = captureFrameMessages(iframe);

    iframe.dispatchEvent(new Event('load'));
    await tick();

    const themeMessage = messages.find((message) => message.type === 'cinder:set-theme');
    const backgroundMessage = messages.find((message) => message.type === 'cinder:set-background');
    expect(themeMessage?.value).toBe('dark');
    expect(backgroundMessage?.value).toBe('checker');
  });

  test('replays the default surface background and system theme on load', async () => {
    const store = new PreviewStore('button');
    const { container } = render(PreviewFrameFixture, { store, componentName: 'button' });
    await tick();

    const iframe = iframeIn(container);
    if (iframe === null) throw new Error('expected an iframe');

    const messages = captureFrameMessages(iframe);
    iframe.dispatchEvent(new Event('load'));
    await tick();

    const themeMessage = messages.find((message) => message.type === 'cinder:set-theme');
    const backgroundMessage = messages.find((message) => message.type === 'cinder:set-background');
    expect(themeMessage?.value).toBe('system');
    expect(backgroundMessage?.value).toBe('surface');
  });
});
