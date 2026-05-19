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

import type { BackgroundChoice, ThemeChoice, ToolbarSearchState } from './routing.ts';
import {
  buildToolbarSearch,
  readBackgroundFromSearch,
  readFocusModeFromSearch,
  readPreviewWidthFromSearch,
  readThemeFromSearch,
} from './routing.ts';

export type { BackgroundChoice, ThemeChoice };

const PREVIEW_STORE_KEY = Symbol('cinder-preview-store');

/** Persisted theme key — must match `PRE_PAINT_THEME_SCRIPT` in render-shell.ts. */
export const THEME_STORAGE_KEY = 'cinder-playground-theme';

const THEME_VALUES: ReadonlySet<ThemeChoice> = new Set(['light', 'dark', 'system']);

/**
 * Safe localStorage read. localStorage can throw in private-browsing,
 * restricted content-script contexts, or when storage quota is exhausted.
 * Failures degrade silently to "system" so the playground keeps booting.
 */
export function readPersistedTheme(): ThemeChoice {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
    return 'system';
  } catch {
    return 'system';
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
 * Apply a theme choice to a document's root element.
 *
 * - `color-scheme`: 'system' clears the inline value so the base CSS
 *   declaration of `color-scheme: light dark` takes effect.
 * - `data-cinder-theme`: always set to the explicit choice, including
 *   'system'. This is the authoritative signal CSS reads when deciding
 *   things like the inverse-background flip — sniffing inline style breaks
 *   the moment a user selects 'system'.
 */
export function applyThemeToDocument(doc: Document, theme: ThemeChoice): void {
  doc.documentElement.style.colorScheme = theme === 'system' ? '' : theme;
  doc.documentElement.dataset['cinderTheme'] = theme;
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
  #theme = $state<ThemeChoice>('system');
  #background = $state<BackgroundChoice>('surface');
  #previewWidth = $state<number | null>(null);

  constructor(initialComponent: string, initialState: Partial<ToolbarSearchState> = {}) {
    this.currentComponent = initialComponent;
    this.#isFocusMode = initialState.isFocusMode ?? false;
    this.#theme = initialState.theme ?? 'system';
    this.#background = initialState.background ?? 'surface';
    this.#previewWidth = initialState.previewWidth ?? null;
  }

  get isFocusMode(): boolean {
    return this.#isFocusMode;
  }
  set isFocusMode(value: boolean) {
    this.#isFocusMode = value;
    this.#writeUrl();
  }

  get theme(): ThemeChoice {
    return this.#theme;
  }

  get background(): BackgroundChoice {
    return this.#background;
  }
  set background(value: BackgroundChoice) {
    this.#background = value;
    this.#writeUrl();
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
   * Update the theme. Writes to the URL (so it's shareable) and to
   * localStorage (so the next visit without a `theme=` param picks up the
   * user's preference) and applies the new color-scheme to the shell
   * document. Use this — never assign `store.theme` directly.
   */
  setTheme(value: ThemeChoice): void {
    if (!THEME_VALUES.has(value)) return;
    this.#theme = value;
    writePersistedTheme(value);
    if (typeof document !== 'undefined') applyThemeToDocument(document, value);
    this.#writeUrl();
  }

  /**
   * Re-seed every toolbar cell from the current URL. Called by the SPA on
   * `popstate` so back/forward navigation updates the UI. Theme falls back
   * to localStorage when the URL has no `theme=` param.
   */
  syncFromUrl(): void {
    if (typeof window === 'undefined') return;
    const search = new URL(window.location.href).searchParams;
    this.#isFocusMode = readFocusModeFromSearch(search);
    this.#background = readBackgroundFromSearch(search);
    this.#previewWidth = readPreviewWidthFromSearch(search);
    const explicitTheme = readThemeFromSearch(search);
    const nextTheme = explicitTheme ?? readPersistedTheme();
    if (nextTheme !== this.#theme) {
      this.#theme = nextTheme;
      if (typeof document !== 'undefined') applyThemeToDocument(document, nextTheme);
    }
  }

  /**
   * Snapshot of the toolbar state that gets serialized to the URL. Theme
   * is only emitted when it has been set explicitly (i.e. non-`system`) so
   * a default URL stays clean.
   */
  #snapshot(): ToolbarSearchState {
    return {
      isFocusMode: this.#isFocusMode,
      theme: this.#theme,
      background: this.#background,
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
