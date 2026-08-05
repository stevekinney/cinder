/**
 * Theme, preview-width, and nav-filter adoption for the documentation page.
 *
 * All three settings must render identically on the server and the client's
 * first (pre-hydration) pass, then adopt their real value from the
 * environment (document/`localStorage`/URL/`sessionStorage`) once the client
 * is live — reading any of them during init instead would make the server's
 * markup and the client's hydration render disagree. `component-page.svelte`
 * owns the `$state`/`$effect` wiring that does the seeding and adoption (see
 * its hydration-adoption effect); this module owns the pure reads and the
 * DOM/storage write `toggleTheme` performs, following the same split
 * `component-page-scroll-spy.ts` already uses for a sibling concern.
 */

import { readPreviewWidthFromSearch } from './shell-app/routing.ts';
import { THEME_STORAGE_KEY } from './shell-app/theme-storage.ts';

/**
 * Preview stage widths. `null` means "fill the pane". The numeric values match
 * the breakpoints the shell's viewport control used, so shared links keep
 * meaning the same thing.
 */
export const PREVIEW_WIDTHS = [
  { label: 'Mobile', width: 375 },
  { label: 'Tablet', width: 768 },
  { label: 'Desktop', width: 1280 },
  { label: 'Full', width: null },
] as const satisfies readonly { label: string; width: number | null }[];

export const NAV_FILTER_STORAGE_KEY = 'cinder-playground-nav-filter';

/**
 * Cinder tokens switch on `color-scheme` (via `light-dark()`); the playground
 * bridge mirrors the same value onto `data-cinder-theme` for bookkeeping.
 * Server rendering has no `document`, so the SSR tree seeds `light` —
 * matching the base `color-scheme: light dark` first argument — and the
 * real preference is adopted in an `$effect` after hydration. Seeding from
 * the document during init would make the server and client first render
 * disagree (a hydration mismatch); deferring the read is the same
 * discipline `shell.svelte` uses for its persisted theme.
 */
export function readInitialTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light';
  const scheme = document.documentElement.style.colorScheme;
  if (scheme === 'dark' || scheme === 'light') return scheme;
  return document.documentElement.dataset['cinderTheme'] === 'dark' ? 'dark' : 'light';
}

/*
 * Seed from the URL so `?w=768&focus=1` still means what it did on the shell —
 * `/c/<name>?w=…` preserves its query across the 301, so those links keep
 * working. Read once, and only in the browser: the server tree must not depend
 * on values the client would then re-derive.
 */
export function readInitialPreviewWidth(): number | null {
  if (typeof window === 'undefined') return null;
  return readPreviewWidthFromSearch(new URLSearchParams(window.location.search));
}

/*
 * Persisted across navigation. Selecting a component is a full document load,
 * so without this a filtered list resets the moment you use it.
 */
export function readStoredNavFilter(): string {
  if (typeof sessionStorage === 'undefined') return '';
  try {
    return sessionStorage.getItem(NAV_FILTER_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/**
 * Write the resolved theme to the DOM and persist it to `localStorage`. Used
 * by `toggleTheme` — never assign the theme's DOM/storage targets directly.
 */
export function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.style.colorScheme = theme;
  document.documentElement.dataset['cinderTheme'] = theme;
  try {
    // Same key the pre-paint script in render-shell.ts reads. It previously
    // wrote `cinder-docs-theme`, which nothing read, so the choice was lost on
    // every navigation.
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode / disabled storage — the in-memory theme still applies.
  }
}
