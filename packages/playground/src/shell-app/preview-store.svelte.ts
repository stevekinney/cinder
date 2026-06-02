/**
 * Reactive store for the playground shell SPA.
 *
 * Phase 1 held only `currentComponent`. Phase 3 adds the top-bar controls:
 * theme (persisted to localStorage), viewport width, and background swatch
 * (session-only). Focus mode is driven by the `?focus=1` search param so it
 * survives reloads and is shareable via URL.
 *
 * Single instance provided via a Svelte 5 context key so any descendant
 * component can read/write it without prop drilling.
 */

import { getContext, setContext } from 'svelte';
import { MediaQuery } from 'svelte/reactivity';

import type { ThemeChoice, ToolbarSearchState } from './routing.ts';
import {
  buildToolbarSearch,
  readFocusModeFromSearch,
  readPreviewWidthFromSearch,
  readThemeFromSearch,
} from './routing.ts';

export type { ThemeChoice };

const PREVIEW_STORE_KEY = Symbol('cinder-preview-store');

/** Persisted theme key — must match `PRE_PAINT_THEME_SCRIPT` in render-shell.ts. */
export const THEME_STORAGE_KEY = 'cinder-playground-theme';

const THEME_VALUES: ReadonlySet<ThemeChoice> = new Set(['light', 'dark']);

/**
 * Safe localStorage read of the explicit theme override.
 *
 * localStorage can throw in private-browsing, restricted content-script
 * contexts, or when storage quota is exhausted. Returns `null` when there is no
 * stored override (or on any failure), which the store reads as "follow the
 * browser's `prefers-color-scheme`".
 */
export function readPersistedTheme(): ThemeChoice | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === 'light' || value === 'dark') return value;
    return null;
  } catch {
    return null;
  }
}

/** Safe localStorage write. Failures are ignored. */
export function writePersistedTheme(value: ThemeChoice): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, value);
  } catch {
    /* ignore — degraded but functional */
  }
}

/**
 * Apply the playground's theme to a document's root element.
 *
 * - With an explicit `override` (light/dark), pin both `color-scheme` and
 *   `data-cinder-theme` to that value so the choice wins over the OS setting.
 * - With no override (`null`), clear the inline `color-scheme` so the base CSS
 *   declaration (`color-scheme: light dark`) and the OS `prefers-color-scheme`
 *   drive the rendering. `data-cinder-theme` is set to `resolved` — the live
 *   browser preference — so the authoritative CSS signal still reflects the
 *   theme actually in effect rather than being left stale.
 */
export function applyThemeToDocument(
  doc: Document,
  override: ThemeChoice | null,
  resolved: ThemeChoice,
): void {
  doc.documentElement.style.colorScheme = override ?? '';
  doc.documentElement.dataset['cinderTheme'] = override ?? resolved;
}

export class PreviewStore {
  currentComponent = $state<string>('');

  /**
   * Reactive backing cells for every toolbar setting. Public getters expose
   * them; setters write the new value back to the URL via
   * `history.replaceState` so the query string is the canonical source of
   * truth and every toolbar option is shareable / survives reloads.
   *
   * The reactive cell is the UI's read path — we don't re-parse the URL on
   * every render. Setters keep the cell and the URL in lockstep, and
   * `syncFromUrl()` re-reads when back/forward navigation fires `popstate`.
   */
  #isFocusMode = $state<boolean>(false);
  /**
   * The explicit theme override, or `null` when the user has made no choice and
   * the playground should follow the browser. `#browserPrefersDark` tracks the
   * live `prefers-color-scheme` so the resolved {@link theme} updates the moment
   * the OS setting flips while no override is active.
   */
  #override = $state<ThemeChoice | null>(null);
  // Fallback `false` keeps the resolved theme deterministic on the server (where
  // there's no `matchMedia`): with no override the playground resolves to light
  // until the client hydrates and the real preference takes over.
  #browserPrefersDark = new MediaQuery('(prefers-color-scheme: dark)', false);
  #previewWidth = $state<number | null>(null);

  /**
   * Narrow-viewport sidebar drawer state. Pure shell-local UI: it is never
   * serialized to the URL (a drawer that reopens on reload is annoying, not
   * shareable) and never crosses the iframe boundary, so its setter does NOT
   * write the URL. On wide viewports the CSS ignores it entirely.
   */
  isSidebarOpen = $state<boolean>(false);

  constructor(initialComponent: string, initialState: Partial<ToolbarSearchState> = {}) {
    this.currentComponent = initialComponent;
    this.#isFocusMode = initialState.isFocusMode ?? false;
    this.#override = initialState.theme ?? null;
    this.#previewWidth = initialState.previewWidth ?? null;
  }

  get isFocusMode(): boolean {
    return this.#isFocusMode;
  }
  set isFocusMode(value: boolean) {
    this.#isFocusMode = value;
    this.#writeUrl();
  }

  /**
   * The resolved theme actually in effect — always a concrete `light` or
   * `dark`. Equals the override when one is set; otherwise it tracks the live
   * browser `prefers-color-scheme`. This is the value the toolbar's segmented
   * control highlights and the iframe sync sends across the postMessage bridge.
   */
  get theme(): ThemeChoice {
    return this.#override ?? this.#resolvedBrowserTheme();
  }

  /**
   * The explicit override, or `null` when following the browser. Distinct from
   * {@link theme}, which always resolves to a concrete light/dark value.
   */
  get themeOverride(): ThemeChoice | null {
    return this.#override;
  }

  /** Map the live `prefers-color-scheme` media query to a concrete theme. */
  #resolvedBrowserTheme(): ThemeChoice {
    return this.#browserPrefersDark.current ? 'dark' : 'light';
  }

  /** null = full / unconstrained width. Number = pixel width applied to the iframe. */
  get previewWidth(): number | null {
    return this.#previewWidth;
  }
  set previewWidth(value: number | null) {
    this.#previewWidth = value;
    this.#writeUrl();
  }

  /**
   * Set an explicit theme override. Writes to the URL (so it's shareable) and
   * to localStorage (so the next visit without a `theme=` param picks up the
   * user's choice) and applies the new color-scheme to the shell document. Use
   * this — never assign `store.theme` directly. Once an override is set it wins
   * over the browser's `prefers-color-scheme`.
   */
  setTheme(value: ThemeChoice): void {
    if (!THEME_VALUES.has(value)) return;
    this.#override = value;
    writePersistedTheme(value);
    if (typeof document !== 'undefined') {
      applyThemeToDocument(document, this.#override, this.#resolvedBrowserTheme());
    }
    this.#writeUrl();
  }

  /**
   * Re-seed every toolbar cell from the current URL. Called by the SPA on
   * `popstate` so back/forward navigation updates the UI. The theme override
   * falls back to localStorage when the URL has no `theme=` param; when neither
   * carries an override the playground follows the browser preference.
   */
  syncFromUrl(): void {
    if (typeof window === 'undefined') return;
    const search = new URL(window.location.href).searchParams;
    this.#isFocusMode = readFocusModeFromSearch(search);
    this.#previewWidth = readPreviewWidthFromSearch(search);
    // Dismiss the narrow-viewport drawer on every URL sync (browser back/forward).
    // If the user had the drawer open and navigated away (or landed on ?focus=1
    // via history), the scrim + inert state must not persist into the new URL.
    this.isSidebarOpen = false;
    const nextOverride = readThemeFromSearch(search) ?? readPersistedTheme();
    if (nextOverride !== this.#override) {
      this.#override = nextOverride;
      if (typeof document !== 'undefined') {
        applyThemeToDocument(document, this.#override, this.#resolvedBrowserTheme());
      }
    }
  }

  /**
   * Snapshot of the toolbar state that gets serialized to the URL. The theme
   * is only emitted when an explicit override has been set; with no override a
   * default URL stays clean and the playground follows the browser.
   */
  #snapshot(): ToolbarSearchState {
    return {
      isFocusMode: this.#isFocusMode,
      theme: this.#override,
      previewWidth: this.#previewWidth,
    };
  }

  /**
   * Push the current state to the URL via `history.replaceState`, preserving
   * pathname, hash, and any unrelated query params.
   */
  #writeUrl(): void {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const nextSearch = buildToolbarSearch(url.searchParams, this.#snapshot());
    const nextHref = `${url.pathname}${nextSearch}${url.hash}`;
    history.replaceState(history.state, '', nextHref);
  }
}

/** Install the singleton store on the current component tree. */
export function setPreviewStore(store: PreviewStore): void {
  setContext(PREVIEW_STORE_KEY, store);
}

/** Read the singleton store from the current component tree. Throws if absent. */
export function getPreviewStore(): PreviewStore {
  const store = getContext<PreviewStore | undefined>(PREVIEW_STORE_KEY);
  if (store === undefined) {
    throw new Error('[cinder playground] PreviewStore is not set in this component tree');
  }
  return store;
}
