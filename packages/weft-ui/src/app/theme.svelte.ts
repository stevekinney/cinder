/**
 * Theme toggle state (plan §1.7, §13 T1.6): light / dark / system, persisted
 * to `localStorage` and applied as `data-theme` on `<html>` — the exact
 * attribute `src/styles/index.css` already keys its `light-dark()` token
 * overrides off (`:root[data-theme='light']` / `:root[data-theme='dark']`).
 * `'system'` removes the attribute entirely so the browser/OS-driven
 * `color-scheme: light dark` default (also already declared in
 * `index.css`) takes over — there is no explicit "system" value on the
 * element itself, only the absence of an override.
 */
const STORAGE_KEY = 'weft-ui-theme';

export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'system'];

function isThemeMode(value: string | null): value is ThemeMode {
  return value !== null && (THEME_MODES as readonly string[]).includes(value);
}

function readStoredMode(storage: Storage): ThemeMode {
  try {
    const stored = storage.getItem(STORAGE_KEY);
    return isThemeMode(stored) ? stored : 'system';
  } catch {
    // A storage read can throw under a locked-down embedding (private
    // browsing quota, disabled storage) — fall back to the default rather
    // than crashing shell boot over a cosmetic preference.
    return 'system';
  }
}

function applyThemeAttribute(root: HTMLElement, mode: ThemeMode): void {
  if (mode === 'system') {
    root.removeAttribute('data-theme');
    return;
  }
  root.setAttribute('data-theme', mode);
}

/** Cycles light → dark → system → light, matching a single icon-button's click order. */
export function nextThemeMode(current: ThemeMode): ThemeMode {
  const index = THEME_MODES.indexOf(current);
  return THEME_MODES[(index + 1) % THEME_MODES.length] ?? 'system';
}

export class ThemeStore {
  mode: ThemeMode = $state('system');

  readonly #root: HTMLElement;
  readonly #storage: Storage;

  constructor(
    root: HTMLElement = document.documentElement,
    storage: Storage = window.localStorage,
  ) {
    this.#root = root;
    this.#storage = storage;
    this.mode = readStoredMode(storage);
    applyThemeAttribute(this.#root, this.mode);
  }

  set(mode: ThemeMode): void {
    this.mode = mode;
    applyThemeAttribute(this.#root, mode);
    try {
      this.#storage.setItem(STORAGE_KEY, mode);
    } catch {
      // Best-effort persistence only — a full/blocked storage quota should
      // not prevent the theme from applying for the rest of this session.
    }
  }

  cycle(): void {
    this.set(nextThemeMode(this.mode));
  }
}
