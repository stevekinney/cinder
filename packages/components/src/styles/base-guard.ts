/**
 * Dev-only guard for the "import cinder/styles first" rule.
 *
 * When a consumer imports a per-component CSS subpath (e.g. `@lostgradient/cinder/badge/styles`)
 * WITHOUT first importing `@lostgradient/cinder/styles`, the `@layer` order declaration is
 * never established. CSS cascade layers get created in insertion order instead of
 * the declared order (`cinder.tokens → cinder.foundation → cinder.components →
 * cinder.utilities`), silently inverting cascade priority: utilities can no longer
 * override component defaults, and token rules may lose to component rules.
 *
 * The guard detects this by reading `--cinder-base-loaded` from `:root`. This
 * custom property is set by `src/styles/index.css` (the `@lostgradient/cinder/styles` entry
 * point) inside a `@layer cinder.tokens` block that appears AFTER all `@import`
 * rules — CSS-spec-valid placement. The property is intentionally NOT set by
 * `src/styles/tokens.css`, which is also exported independently as
 * `@lostgradient/cinder/styles/tokens`. This ensures that importing only `@lostgradient/cinder/styles/tokens`
 * does not falsely satisfy the guard.
 * If the property is absent when this module executes, the base was not loaded
 * first and a warning fires once.
 *
 * This module is browser-only: `getComputedStyle` does not exist on the server.
 * The `DEV` constant from `esm-env` is replaced at build time with `false` in
 * production builds, so the entire warning block is dead code in prod and gets
 * tree-shaken by any bundler that handles constant folding (Vite, esbuild, Rollup,
 * Bun).
 *
 * Usage — add this import alongside your component style imports at your app entry:
 *
 * ```ts
 * import '@lostgradient/cinder/styles';          // base: layer order + tokens + foundation + utilities
 * import '@lostgradient/cinder/styles/guard';    // dev-only: warns if the above import was skipped
 * import '@lostgradient/cinder/badge/styles';
 * import '@lostgradient/cinder/button/styles';
 * ```
 *
 * The guard is a no-op in production and when `@lostgradient/cinder/styles` is correctly loaded
 * first. It adds zero runtime cost in the happy path: the `DEV` branch is
 * eliminated by the bundler before it reaches the browser.
 */

import { BROWSER, DEV } from 'esm-env';

/**
 * The CSS custom property set by `@lostgradient/cinder/styles` on `:root` inside
 * `@layer cinder.tokens`. Presence of this property on the document root
 * indicates the base stylesheet was loaded and the `@layer` order is declared.
 */
export const BASE_LOADED_PROPERTY = '--cinder-base-loaded';

/**
 * Returns `true` when `@lostgradient/cinder/styles` has been loaded — i.e. when the
 * `--cinder-base-loaded` custom property is present on the supplied root
 * element.
 *
 * Accepts an `Element` parameter so tests can inject a mock element with the
 * property set or absent, making the check hermetic without a real browser.
 * Production callers always pass `document.documentElement`.
 */
export function isBaseLoaded(root: Element): boolean {
  return getComputedStyle(root).getPropertyValue(BASE_LOADED_PROPERTY).trim() === '1';
}

/**
 * The warning message emitted once when the guard detects a missing base import.
 * Exported so tests can assert the exact text without duplicating the string.
 */
export const MISSING_BASE_WARNING =
  '[cinder] `@lostgradient/cinder/styles` was not imported before a per-component style subpath. ' +
  'The `@layer` cascade order is undefined — utilities may not override component ' +
  "defaults. Fix: add `import '@lostgradient/cinder/styles'` before any `import '@lostgradient/cinder/<component>/styles'` " +
  'in your app entry.';

// Module-level side-effect: warn once when the guard detects the base is absent.
// The `DEV && BROWSER` guard ensures:
//   - In production (`DEV === false`): the entire block is dead code, tree-shaken.
//   - On the server (`BROWSER === false`): `getComputedStyle` is unavailable; skip.
//   - In the browser during development: check once at module evaluation time.
if (DEV && BROWSER) {
  // `requestAnimationFrame` defers the check one tick so any same-module-chunk
  // CSS that was co-imported with this guard has a chance to be applied before
  // we read computed styles. Without the deferral, the check races the
  // stylesheet application in some bundlers.
  requestAnimationFrame(() => {
    // Skip the check entirely when no stylesheets are attached to the document.
    // A test environment (jsdom, Bun's browser-condition test runner) loads no
    // real CSS, so `getComputedStyle` custom properties always return `""` —
    // indistinguishable from "base not loaded." When no stylesheets are present,
    // the cascade ordering question is moot: nothing is fighting over layers yet.
    if (document.styleSheets.length === 0) return;

    if (!isBaseLoaded(document.documentElement)) {
      console.warn(MISSING_BASE_WARNING);
    }
  });
}
