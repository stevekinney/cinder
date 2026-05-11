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
export type ThemeChoice = 'light' | 'dark' | 'system';
export type BackgroundChoice = 'surface' | 'inverse' | 'checker';

/**
 * Message types exchanged between the shell SPA and the iframe page. The
 * `cinder:` prefix scopes the protocol so future iframe content can't
 * accidentally collide with unrelated messages on the same channel.
 *
 * Theme/background changes flow shell → iframe; the iframe never sends
 * back. The receiver MUST validate the origin AND the value against the
 * allowed set before applying any effect.
 */
export type PreviewMessage =
  | { type: 'cinder:set-theme'; value: ThemeChoice }
  | { type: 'cinder:set-background'; value: BackgroundChoice };

const PREVIEW_THEMES: ReadonlySet<ThemeChoice> = new Set<ThemeChoice>(['light', 'dark', 'system']);
const PREVIEW_BACKGROUNDS: ReadonlySet<BackgroundChoice> = new Set<BackgroundChoice>([
  'surface',
  'inverse',
  'checker',
]);

function isThemeChoice(value: string): value is ThemeChoice {
  return PREVIEW_THEMES.has(value as ThemeChoice);
}

function isBackgroundChoice(value: string): value is BackgroundChoice {
  return PREVIEW_BACKGROUNDS.has(value as BackgroundChoice);
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
  type: 'cinder:set-background',
  value: BackgroundChoice,
): PreviewMessage | null;
export function createPreviewMessage(type: string, value: string): PreviewMessage | null {
  if (type === 'cinder:set-theme' && isThemeChoice(value)) {
    return { type, value };
  }
  if (type === 'cinder:set-background' && isBackgroundChoice(value)) {
    return { type, value };
  }
  return null;
}
