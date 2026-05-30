/**
 * Sidebar scroll-position persistence.
 *
 * The playground shell is a single-page app: navigating between components
 * re-renders the nav list and back/forward restores the route without
 * remounting the scroll container, so the browser silently resets it to the
 * top. This module saves the container's `scrollTop` to `sessionStorage` and
 * restores it on mount so the user keeps their place in a long component list.
 *
 * `sessionStorage` access is wrapped in try/catch — it throws in private
 * browsing, restricted content-script contexts, and when storage is disabled —
 * exactly mirroring the resilience pattern in `preview-store.svelte.ts`.
 */

import type { Attachment } from 'svelte/attachments';

/** Storage key under which the sidebar's `scrollTop` is persisted. */
export const SIDEBAR_SCROLL_STORAGE_KEY = 'cinder-playground-sidebar-scroll';

/**
 * Delay before a scroll position is written to storage. Scroll fires many
 * events per gesture; debouncing collapses the burst into a single write once
 * the user pauses, so we never thrash `sessionStorage` mid-scroll.
 */
const SCROLL_PERSIST_DEBOUNCE_MS = 150;

/**
 * Read the persisted sidebar scroll offset.
 *
 * Returns `null` when nothing is stored, when the stored value is not a finite
 * non-negative number, or when `sessionStorage` access throws. Callers treat
 * `null` as "leave the scroll position untouched".
 */
export function readSidebarScroll(): number | null {
  try {
    const raw = sessionStorage.getItem(SIDEBAR_SCROLL_STORAGE_KEY);
    if (raw === null) return null;
    const value = Number.parseInt(raw, 10);
    if (!Number.isFinite(value) || value < 0) return null;
    return value;
  } catch {
    return null;
  }
}

/**
 * Persist the sidebar scroll offset. Failures (private mode, disabled storage,
 * quota) are swallowed so a blocked write never breaks scrolling.
 */
export function writeSidebarScroll(scrollTop: number): void {
  try {
    sessionStorage.setItem(SIDEBAR_SCROLL_STORAGE_KEY, String(Math.round(scrollTop)));
  } catch {
    /* ignore — degraded but functional */
  }
}

/**
 * Svelte attachment that restores the saved scroll offset on mount and writes
 * the current offset back (debounced) whenever the element scrolls.
 *
 * Cleanup clears the pending debounce timer and removes the scroll listener,
 * so teardown leaves no dangling timer or listener behind.
 *
 * @param element - The scrollable sidebar container.
 * @returns A teardown function invoked when the element is removed.
 */
export const persistScrollPosition: Attachment<HTMLElement> = (element) => {
  const restored = readSidebarScroll();
  if (restored !== null) {
    element.scrollTop = restored;
  }

  let timer: ReturnType<typeof setTimeout> | null = null;

  const handleScroll = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      writeSidebarScroll(element.scrollTop);
    }, SCROLL_PERSIST_DEBOUNCE_MS);
  };

  element.addEventListener('scroll', handleScroll, { passive: true });

  return () => {
    if (timer !== null) clearTimeout(timer);
    element.removeEventListener('scroll', handleScroll);
  };
};
