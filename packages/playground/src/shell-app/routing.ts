import {
  isColorTokenName,
  isSafeColorTokenValue,
  type ColorTokenOverrides,
} from './color-token-registry.ts';

/**
 * Pure routing helpers for the playground shell SPA.
 *
 * Extracted from the Svelte components so they're testable without a DOM.
 * Every helper is side-effect-free; the SPA is responsible for choosing what
 * to do with the return values (e.g. seeding state, building hrefs).
 */

/**
 * Regex that matches the component-name invariant enforced server-side by
 * `isSafeSegment` in `server.ts`. Kebab-case, ASCII only, starts with
 * alphanumeric. Kept in sync with `/^[a-z0-9][a-z0-9-]*$/` at server.ts:523.
 */
const COMPONENT_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Extract a component name from a `/c/:name` pathname. Returns `null` for any
 * input that doesn't match the route shape or whose segment fails the
 * kebab-case invariant. The caller decides what to do with `null` — typically
 * leave the current component unchanged.
 *
 * Trailing path segments are rejected (`/c/avatar/extra` returns null) so the
 * helper has the same shape as the server's `/c/:name` route.
 */
export function parseComponentFromPath(pathname: string): string | null {
  const match = /^\/c\/([^/]+)$/.exec(pathname);
  if (!match) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(match[1]!);
  } catch {
    return null;
  }
  if (!COMPONENT_NAME_PATTERN.test(decoded)) return null;
  return decoded;
}

/**
 * Build the shell URL for a component — used for both sidebar anchor `href`
 * attributes and `history.pushState`. The component name is always encoded
 * defensively, even though kebab slugs don't actually need encoding; this
 * keeps URL construction safe if the invariant ever slips.
 */
export function buildShellHref(componentName: string): string {
  return `/c/${encodeURIComponent(componentName)}`;
}

/**
 * Build the iframe `src` URL for a component's preview page. Same encoding
 * discipline as `buildShellHref`.
 */
export function buildIframeSrc(componentName: string): string {
  return `/page/${encodeURIComponent(componentName)}`;
}

/**
 * Theme and background value unions are defined here (and re-exported by
 * `preview-store.svelte.ts`) so this pure-helper module has no import from
 * any Svelte file. That keeps it cleanly unit-testable from `bun:test`
 * without paying the `.svelte.ts` compilation cost in test boot.
 */
export type ThemeChoice = 'light' | 'dark';

// Typed AND instantiated as Set<string> so `.has(raw)` accepts an arbitrary
// string without an `as ThemeChoice` assertion and without relying on unsound
// Set<ThemeChoice>→ReadonlySet<string> variance. Narrowing from string →
// ThemeChoice is the job of `isThemeChoice` below.
const THEME_VALUES: ReadonlySet<string> = new Set<string>(['light', 'dark']);

/** Type guard narrowing an arbitrary string to a {@link ThemeChoice}. */
function isThemeChoice(value: string): value is ThemeChoice {
  return THEME_VALUES.has(value);
}

/**
 * Canonical search-param keys for the toolbar. Compact spellings (`w`) keep
 * shareable URLs readable; full-word keys are reserved for future additions
 * that don't appear together with these.
 */
export const TOOLBAR_PARAMS = {
  focus: 'focus',
  theme: 'theme',
  width: 'w',
} as const;

const FOCUS_MODE_TRUTHY: ReadonlySet<string> = new Set(['1', 'true', 'yes', 'on']);

/** Minimum and maximum viewport widths accepted from the `w` param. */
const VIEWPORT_WIDTH_MIN = 200;
const VIEWPORT_WIDTH_MAX = 3840;

/**
 * Snapshot of every toolbar setting that lives in the URL. `null`s mean
 * "use the default" — they're the values that are omitted from the query
 * string when serializing. A `null` theme means "no explicit override": the
 * playground follows the browser's `prefers-color-scheme` rather than pinning
 * light or dark.
 */
export type ToolbarSearchState = {
  isFocusMode: boolean;
  theme: ThemeChoice | null;
  previewWidth: number | null;
};

/**
 * Read focus mode from a URLSearchParams instance. Tolerates a few truthy
 * spellings so handwritten URLs work; anything else is false.
 */
export function readFocusModeFromSearch(search: URLSearchParams): boolean {
  const raw = search.get(TOOLBAR_PARAMS.focus);
  if (raw === null) return false;
  return FOCUS_MODE_TRUTHY.has(raw.toLowerCase());
}

/**
 * Read the explicit theme override from a URLSearchParams instance, or `null`
 * when the URL carries no override (the playground then follows the browser's
 * `prefers-color-scheme`). Unknown values resolve to `null` so a corrupted URL
 * doesn't lock users into a bad state.
 */
export function readThemeFromSearch(search: URLSearchParams): ThemeChoice | null {
  const raw = search.get(TOOLBAR_PARAMS.theme);
  if (raw === null) return null;
  return isThemeChoice(raw) ? raw : null;
}

/**
 * Read a viewport width from a URLSearchParams instance. Returns `null`
 * (full / unconstrained) for missing, non-numeric, or out-of-range values.
 */
export function readPreviewWidthFromSearch(search: URLSearchParams): number | null {
  const raw = search.get(TOOLBAR_PARAMS.width);
  if (raw === null) return null;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return null;
  if (parsed < VIEWPORT_WIDTH_MIN || parsed > VIEWPORT_WIDTH_MAX) return null;
  return parsed;
}

/**
 * Read the full toolbar state from a URLSearchParams instance. Convenience
 * wrapper around the individual readers — useful for SSR seeding.
 */
export function readToolbarStateFromSearch(search: URLSearchParams): ToolbarSearchState {
  return {
    isFocusMode: readFocusModeFromSearch(search),
    theme: readThemeFromSearch(search),
    previewWidth: readPreviewWidthFromSearch(search),
  };
}

/**
 * Build a canonical query string from a toolbar state snapshot, preserving
 * any unrelated params in `search`. Default values are omitted from the
 * output so a fresh playground URL stays clean. The leading `?` is included
 * when non-empty.
 */
export function buildToolbarSearch(search: URLSearchParams, state: ToolbarSearchState): string {
  const next = new URLSearchParams(search);

  // Strip the retired `bg` param (the removed transparency-grid feature). Old
  // shared/bookmarked URLs may still carry `?bg=checker`; drop it on the next
  // toolbar write rather than preserving it as an "unrelated" param forever.
  next.delete('bg');

  if (state.isFocusMode) {
    next.set(TOOLBAR_PARAMS.focus, '1');
  } else {
    next.delete(TOOLBAR_PARAMS.focus);
  }

  // `?theme=` is only present for an explicit override. With no override the
  // playground follows the browser's `prefers-color-scheme`, so omit the param
  // entirely and keep a default URL clean.
  if (state.theme === null) {
    next.delete(TOOLBAR_PARAMS.theme);
  } else {
    next.set(TOOLBAR_PARAMS.theme, state.theme);
  }

  if (state.previewWidth === null) {
    next.delete(TOOLBAR_PARAMS.width);
  } else {
    next.set(TOOLBAR_PARAMS.width, String(state.previewWidth));
  }

  const serialized = next.toString();
  return serialized === '' ? '' : `?${serialized}`;
}

/**
 * Message types exchanged between the shell SPA and the iframe page. The
 * `cinder:` prefix scopes the protocol so future iframe content can't
 * accidentally collide with unrelated messages on the same channel.
 *
 * Theme changes flow shell → iframe; the iframe never sends back. The
 * receiver MUST validate the origin AND the value against the allowed set
 * before applying any effect.
 */
export type PreviewMessage =
  | { type: 'cinder:set-theme'; value: ThemeChoice }
  | {
      type: 'cinder:set-color-token-overrides';
      theme: ThemeChoice;
      overrides: ColorTokenOverrides;
    };

type ColorTokenOverridePayload = {
  theme: ThemeChoice;
  overrides: Record<string, string>;
};

function isColorTokenOverridePayload(value: unknown): value is ColorTokenOverridePayload {
  if (typeof value !== 'object' || value === null) return false;
  if (!('theme' in value)) return false;
  const theme = value.theme;
  if (typeof theme !== 'string' || !isThemeChoice(theme)) return false;
  if (!('overrides' in value)) return false;
  const overrides = value.overrides;
  if (typeof overrides !== 'object' || overrides === null || Array.isArray(overrides)) return false;

  for (const [name, rawValue] of Object.entries(overrides)) {
    if (!isColorTokenName(name)) return false;
    if (typeof rawValue !== 'string') return false;
    if (!isSafeColorTokenValue(rawValue)) return false;
  }

  return true;
}

/**
 * Construct a typed preview message. Returns `null` if the value doesn't
 * match the type's allowlist — callers can use this to validate user input
 * before sending the message across the postMessage boundary.
 */
export function createPreviewMessage(
  type: 'cinder:set-theme',
  value: ThemeChoice,
): PreviewMessage | null;
export function createPreviewMessage(
  type: 'cinder:set-color-token-overrides',
  value: ColorTokenOverridePayload,
): PreviewMessage | null;
export function createPreviewMessage(
  type: PreviewMessage['type'],
  value: unknown,
): PreviewMessage | null {
  if (type === 'cinder:set-theme' && typeof value === 'string' && isThemeChoice(value)) {
    return { type, value };
  }
  if (type === 'cinder:set-color-token-overrides' && isColorTokenOverridePayload(value)) {
    return {
      type,
      theme: value.theme,
      overrides: value.overrides as ColorTokenOverrides,
    };
  }
  return null;
}
