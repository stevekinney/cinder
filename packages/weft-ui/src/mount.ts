/**
 * The Bun mount export (plan §1, §3.1, T0.2): `serve({ dashboard: weftUi(),
 * dashboardAssets: weftUiAssets() })` serves the built console shell at
 * exactly `DASHBOARD_PAGE_ROUTES` (eight page routes as of
 * `@lostgradient/weft@0.16.0` — `/`, `/workflows`, `/workflows/*`, `/reviews`,
 * `/workers`, `/schedules`, `/storage`, `/system`) and the shell's
 * content-hashed JS/CSS under `/assets/*`. It never shadows `/api/*` or the
 * root-stable discovery routes, because weft's Bun route table matches those
 * first (see `@lostgradient/weft`'s own `DASHBOARD_PAGE_ROUTES` doc
 * comment for why that ordering is load-bearing).
 *
 * @module mount
 */
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DashboardAssets, DashboardRouteTarget } from '@lostgradient/weft';

export interface WeftUiOptions {
  /**
   * Directory containing the built console assets (`index.html` plus
   * content-hashed asset files under `assets/`). Defaults to this package's
   * own `dist/` — the output of `bun run build` (Vite). Pass an explicit
   * value for CDN deployments that build once and copy `dist/` elsewhere.
   */
  distDir?: string;
}

const DEFAULT_DIST_DIR = fileURLToPath(new URL('../dist', import.meta.url));

/**
 * Returns a static `Response` streaming the built `index.html` shell,
 * suitable for `serve({ dashboard: weftUi() })`. The runtime config
 * `<script type="application/json" id="weft-ui-config">` block baked
 * into `index.html` at build time defaults to same-origin (`baseUrl: ''`),
 * which is correct for this deployment mode — the console and API share an
 * origin under a Bun mount.
 */
export function weftUi(options: WeftUiOptions = {}): DashboardRouteTarget {
  const distDir = options.distDir ?? DEFAULT_DIST_DIR;
  const indexPath = join(distDir, 'index.html');

  return new Response(Bun.file(indexPath), {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

/**
 * Returns the `ServeOptions.dashboardAssets` descriptor for the console's
 * content-hashed asset files, suitable for
 * `serve({ dashboard: weftUi(), dashboardAssets: weftUiAssets() })`
 * (`@lostgradient/weft@0.16.0`, weft#840). The shell's `index.html`
 * references its JS/CSS chunks under `/assets/*`; weft mounts
 * `${prefix}/*` as verified static file routes from `directory`, so a bare
 * Bun mount serves the complete console with no reverse proxy in front.
 *
 * Pass the same `distDir` you passed `weftUi()` — the directory must
 * exist before `serve()` is called (weft validates it at boot).
 */
export function weftUiAssets(options: WeftUiOptions = {}): DashboardAssets {
  const distDir = options.distDir ?? DEFAULT_DIST_DIR;
  return { prefix: '/assets', directory: join(distDir, 'assets') };
}
