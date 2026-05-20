import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Theme, ViewportName } from './manifest.ts';

/**
 * Uniquely identifies a single captured artifact (screenshot, snapshot, axe report)
 * for a component rendered with a specific theme, viewport, and fixture combination.
 *
 * - `slug`: the kebab-case component identifier from the manifest.
 * - `theme`: the color-scheme variant (`'light'` or `'dark'`).
 * - `viewport`: the named breakpoint (`'mobile'`, `'tablet'`, `'desktop'`).
 * - `fixture`: the fixture name, or `'default'` when no explicit fixture was used.
 */
export type ArtifactKey = {
  slug: string;
  theme: Theme;
  viewport: ViewportName;
  fixture: string;
};

/** Resolves to the root of the `@cinder/testing` package (the directory containing `src/`). */
function packageRoot(): string {
  // src/helpers/artifact-path.ts → ../..
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

/**
 * Returns the absolute path for the legacy review screenshot of a given artifact key.
 * Files are written to `packages/testing/screenshots/<slug>/<theme>-<viewport>-<fixture>.png`.
 * This path is used in `'off'` mode (no diffing) and remains stable for human review.
 */
export function screenshotPath(key: ArtifactKey): string {
  return resolve(
    packageRoot(),
    'screenshots',
    key.slug,
    `${key.theme}-${key.viewport}-${key.fixture}.png`,
  );
}

/**
 * Returns the absolute path for the committed baseline snapshot used by
 * `toHaveScreenshot` comparisons in `'block'` and `'report'` modes.
 * Files live at `packages/testing/snapshots/<slug>/<theme>-<viewport>-<fixture>.png`.
 */
export function snapshotPath(key: ArtifactKey): string {
  return resolve(
    packageRoot(),
    'snapshots',
    key.slug,
    `${key.theme}-${key.viewport}-${key.fixture}.png`,
  );
}

/**
 * Returns the absolute path for the axe accessibility JSON report for a given
 * artifact key. Files are written to
 * `packages/testing/test-results/axe/<slug>/<theme>-<viewport>-<fixture>.json`.
 */
export function axeJsonPath(key: ArtifactKey): string {
  return resolve(
    packageRoot(),
    'test-results',
    'axe',
    key.slug,
    `${key.theme}-${key.viewport}-${key.fixture}.json`,
  );
}
