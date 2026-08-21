/**
 * Playground preview state shared by the shell chrome and the color-token panel.
 *
 * Tracks two independent pieces of state:
 * - `theme`: the active light/dark override, persisted to `localStorage` only.
 *   It is not serialized to or read from the URL. `enableBrowserThemeResolution()`
 *   exists to fall back to the OS `prefers-color-scheme` when no override is set,
 *   but nothing currently calls it in production — see the tracked follow-up for
 *   `PreviewStore.theme`'s incomplete wiring.
 * - `colorTokenOverrides`: per-token color overrides set from the color-token
 *   panel, restored from `sessionStorage` on construction and applied to the
 *   document via `applyActiveColorTokenOverridesToDocument()`.
 */

import { getContext, setContext } from 'svelte';
import { MediaQuery } from 'svelte/reactivity';

import {
  applyColorTokenOverridesToDocument,
  readSessionColorTokenOverrides,
  writeSessionColorTokenOverrides,
  type ColorTokenOverrideState,
} from './color-token-overrides.ts';
import {
  isColorTokenName,
  isSafeColorTokenValue,
  type ColorTokenName,
} from './color-token-registry.ts';
import type { ThemeChoice } from './routing.ts';
import { THEME_STORAGE_KEY } from './theme-storage.ts';

export type { ThemeChoice };

export type { ColorTokenOverrideState } from './color-token-overrides.ts';

const PREVIEW_STORE_KEY = Symbol('cinder-preview-store');

/** Persisted theme key — must match `PRE_PAINT_THEME_SCRIPT` in render-shell.ts. */

export {
  applyColorTokenOverridesToDocument,
  COLOR_TOKEN_SESSION_KEY,
} from './color-token-overrides.ts';
export { THEME_STORAGE_KEY };

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
  /**
   * The explicit theme override, or `null` when the user has made no choice and
   * the playground should follow the browser. `#browserThemeQuery` tracks the
   * live `prefers-color-scheme` after hydration so the resolved {@link theme}
   * updates the moment the OS setting flips while no override is active.
   */
  #override = $state<ThemeChoice | null>(null);
  // Keep browser media state absent through hydration so both the server and
  // client begin from the same deterministic light fallback. Shell enables the
  // live query in `onMount`, after Svelte has reconciled the server tree.
  #browserThemeQuery = $state<MediaQuery | null>(null);

  colorTokenOverrides = $state<ColorTokenOverrideState>({ light: {}, dark: {} });

  constructor(initialTheme: ThemeChoice | null = null) {
    this.#override = initialTheme;
    if (typeof window !== 'undefined') {
      this.colorTokenOverrides = readSessionColorTokenOverrides();
    }
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

  /** Begin resolving the OS color scheme after hydration has completed. */
  enableBrowserThemeResolution(): void {
    if (typeof window === 'undefined' || this.#browserThemeQuery !== null) return;
    this.#browserThemeQuery = new MediaQuery('(prefers-color-scheme: dark)', false);
  }

  /** Map the live `prefers-color-scheme` media query to a concrete theme. */
  #resolvedBrowserTheme(): ThemeChoice {
    return this.#browserThemeQuery?.current ? 'dark' : 'light';
  }

  /**
   * Point the store at a theme that something else already applied.
   *
   * The landing page owns the theme control now, and colour-token overrides are
   * stored per theme — a stale store would leak light edits into dark. This
   * syncs the key WITHOUT re-applying the theme, re-persisting it, or rewriting
   * the URL, all of which the page has already done (and the URL rewrite would
   * leave `?theme=` on an otherwise clean landing URL).
   */
  adoptTheme(value: ThemeChoice): void {
    if (!THEME_VALUES.has(value)) return;
    this.#override = value;
  }

  setColorTokenOverride(theme: ThemeChoice, tokenName: ColorTokenName, value: string): boolean {
    if (!THEME_VALUES.has(theme)) return false;
    if (!isColorTokenName(tokenName)) return false;
    if (!isSafeColorTokenValue(value)) return false;

    this.colorTokenOverrides = {
      ...this.colorTokenOverrides,
      [theme]: {
        ...this.colorTokenOverrides[theme],
        [tokenName]: value.trim(),
      },
    };
    writeSessionColorTokenOverrides(this.colorTokenOverrides);

    if (theme === this.theme && typeof document !== 'undefined') {
      this.applyActiveColorTokenOverridesToDocument(document);
    }
    return true;
  }

  resetColorTokenOverride(theme: ThemeChoice, tokenName: ColorTokenName): void {
    const nextThemeOverrides = { ...this.colorTokenOverrides[theme] };
    delete nextThemeOverrides[tokenName];
    this.colorTokenOverrides = {
      ...this.colorTokenOverrides,
      [theme]: nextThemeOverrides,
    };
    writeSessionColorTokenOverrides(this.colorTokenOverrides);

    if (theme === this.theme && typeof document !== 'undefined') {
      this.applyActiveColorTokenOverridesToDocument(document);
    }
  }

  resetColorTokenOverrides(theme: ThemeChoice): void {
    this.colorTokenOverrides = {
      ...this.colorTokenOverrides,
      [theme]: {},
    };
    writeSessionColorTokenOverrides(this.colorTokenOverrides);

    if (theme === this.theme && typeof document !== 'undefined') {
      this.applyActiveColorTokenOverridesToDocument(document);
    }
  }

  applyActiveColorTokenOverridesToDocument(doc: Document): void {
    applyColorTokenOverridesToDocument(doc, this.colorTokenOverrides[this.theme]);
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
