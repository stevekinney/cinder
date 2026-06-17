/**
 * Shared screen-reader announcer for the playground shell.
 *
 * A single polite `aria-live` region lives in the shell (rendered by
 * `announcer.svelte`). Both the top bar (toolbar control feedback) and the
 * shell (client-side navigation, WCAG 4.1.3) push messages through one
 * `Announcer` instance provided via context, so there is exactly one live
 * region in the document. Two regions would mean assistive technology reads
 * every message twice.
 *
 * The empty-then-set trick: assigning the same string twice in a row is a
 * no-op for the Svelte runtime, so the DOM never mutates and the screen
 * reader stays silent on the second announcement. Clearing the message first,
 * then setting it after a short gap, forces a DOM mutation every time — even
 * for an identical repeat — so the announcement is always read.
 */

import { getContext, setContext, tick } from 'svelte';

import { humanizeComponentName } from './humanize.ts';

const ANNOUNCER_KEY = Symbol('cinder-announcer');

/** Delay (ms) between clearing the live region and writing the new message. */
const ANNOUNCE_COALESCE_MS = 50;

/**
 * Reactive holder for the shell's single polite live region.
 *
 * Read `message` in the live region's template; call `announce(text)` to
 * queue a message. A pending announcement is cancelled if a newer one
 * arrives before the coalescing gap elapses, so rapid-fire updates collapse
 * to the latest message rather than stuttering.
 */
export class Announcer {
  /** Current live-region text. The empty string renders nothing. */
  message = $state<string>('');

  #timeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Announce `text` in the polite live region. Clears the region first, then
   * writes the message after `ANNOUNCE_COALESCE_MS` so the DOM always mutates
   * — guaranteeing assistive technology reads even an identical repeat.
   */
  announce(text: string): void {
    if (this.#timeout !== null) clearTimeout(this.#timeout);
    this.message = '';
    this.#timeout = setTimeout(() => {
      this.message = text;
      this.#timeout = null;
    }, ANNOUNCE_COALESCE_MS);
  }

  /**
   * Cancel any pending announcement. Used on teardown so a queued message
   * never lands after the component tree is gone.
   */
  cancel(): void {
    if (this.#timeout !== null) {
      clearTimeout(this.#timeout);
      this.#timeout = null;
    }
  }
}

/**
 * Apply the three accessibility side effects of a client-side navigation in
 * the playground shell, in one place so the shell and its tests share the
 * exact code path:
 *
 *   1. Update `document.title` so each SPA "page" is distinguishable in the
 *      title bar and history list (WCAG 2.4.2 "Page Titled").
 *   2. Announce the navigation in the shared polite live region so assistive
 *      technology knows the content changed (WCAG 4.1.3 "Status Messages").
 *   3. Move keyboard focus to the freshly-rendered main region (passed in as
 *      a getter, resolved after `tick()` so the new content is in the DOM)
 *      (WCAG 2.4.3 "Focus Order").
 *
 * `getMain` is a getter rather than a bare element so the focus target is
 * resolved *after* the awaited `tick()`, reflecting the live `bind:this`.
 */
export async function announceNavigation(
  announcer: Announcer,
  componentName: string,
  getMain: () => HTMLElement | null,
): Promise<void> {
  // Humanize to match the SSR-rendered title (renderShell), so client-side
  // navigation keeps the same `<Component> — cinder playground` format instead
  // of regressing to the raw kebab name after the first in-app route change.
  const humanName = humanizeComponentName(componentName);
  if (typeof document !== 'undefined') {
    document.title = `${humanName} — cinder playground`;
  }
  announcer.announce(`Viewing ${humanName}`);
  await tick();
  getMain()?.focus();
}

export async function announceLandingNavigation(
  announcer: Announcer,
  getMain: () => HTMLElement | null,
): Promise<void> {
  if (typeof document !== 'undefined') {
    document.title = 'cinder playground — Svelte 5 component library';
  }
  announcer.announce('Viewing cinder playground');
  await tick();
  getMain()?.focus();
}

/** Install the singleton announcer on the current component tree. */
export function setAnnouncer(announcer: Announcer): void {
  setContext(ANNOUNCER_KEY, announcer);
}

/** Read the singleton announcer from the current component tree. Throws if absent. */
export function getAnnouncer(): Announcer {
  const announcer = getContext<Announcer | undefined>(ANNOUNCER_KEY);
  if (announcer === undefined) {
    throw new Error('[cinder playground] Announcer is not set in this component tree');
  }
  return announcer;
}
