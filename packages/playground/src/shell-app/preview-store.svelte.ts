/**
 * Reactive store for the playground shell SPA.
 *
 * Phase 1 held only `currentComponent`. Phase 3 adds the top-bar controls:
 * theme (persisted to localStorage), viewport width, background swatch, and
 * focus-mode toggle (all three of the latter are session-only).
 *
 * Single instance provided via a Svelte 5 context key so any descendant
 * component can read/write it without prop drilling.
 */

import { getContext, setContext } from 'svelte';

import type { BackgroundChoice, ThemeChoice } from './routing.ts';

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
 * Apply a theme choice to a document's root element by setting `color-scheme`.
 * 'system' clears the inline value so the base CSS declaration of
 * `color-scheme: light dark` takes effect (the default behavior).
 */
export function applyThemeToDocument(doc: Document, theme: ThemeChoice): void {
  doc.documentElement.style.colorScheme = theme === 'system' ? '' : theme;
}

export class PreviewStore {
  currentComponent = $state<string>('');
  /** null = full / unconstrained width. Number = pixel width applied to the iframe. */
  previewWidth = $state<number | null>(null);
  theme = $state<ThemeChoice>('system');
  background = $state<BackgroundChoice>('surface');
  isFocusMode = $state<boolean>(false);

  constructor(initialComponent: string, initialTheme: ThemeChoice = 'system') {
    this.currentComponent = initialComponent;
    this.theme = initialTheme;
  }

  setTheme(value: ThemeChoice): void {
    if (!THEME_VALUES.has(value)) return;
    this.theme = value;
    writePersistedTheme(value);
    if (typeof document !== 'undefined') applyThemeToDocument(document, value);
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
