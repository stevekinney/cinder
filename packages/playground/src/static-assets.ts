import { join } from 'node:path';

import { CINDER_COMPONENT_SOURCE, componentSourceById } from './component-sources.ts';
import { notFound } from './http-responses.ts';
import { resolveSafePath } from './traversal-guard.ts';

const COMPONENTS_ROOT = CINDER_COMPONENT_SOURCE.packageRoot; // packages/components/
const STYLES_ROOT = join(COMPONENTS_ROOT, 'src', 'styles');
const COMPONENTS_SRC_ROOT = join(COMPONENTS_ROOT, 'src', 'components');

/**
 * GET /styles.css → packages/components/src/styles/index.css
 * GET /styles/<path>.css → packages/components/src/styles/<path>.css
 *
 * The component-library's index.css uses `@import './tokens.css'` etc. which
 * the browser resolves relative to the served URL — so we need to serve the
 * full styles/ tree, not just the entry file. `relative` is `'index.css'`
 * for the `/styles.css` route table entry, and the path after `/styles/` for
 * the `/styles/*` entry — one function serves both table rows.
 */
export async function handleStylesRoute(relative: string): Promise<Response> {
  // Require an actual .css filename. Without this, `GET /styles/` resolves
  // to the styles directory itself, and Bun.file(dir).text() throws a 500.
  if (relative === '' || !relative.endsWith('.css')) return notFound();
  const cssPath = resolveSafePath(STYLES_ROOT, relative);
  if (cssPath === null) return notFound();
  const cssFile = Bun.file(cssPath);
  if (!(await cssFile.exists())) return notFound(`${relative} not found`);

  const css = await cssFile.text();
  return new Response(css, { headers: { 'Content-Type': 'text/css' } });
}

/**
 * GET /components/<path>.css → packages/components/src/components/<path>.css
 *
 * After the per-directory layout migration, each component owns its CSS at
 * `src/components/<name>/<name>.css`. The styles aggregator at
 * `src/styles/components.css` imports those via `@import '../components/<name>/<name>.css'`,
 * which the browser resolves relative to the served URL — landing on
 * `/components/<name>/<name>.css`. Serve them from disk here so the
 * resolved relative paths actually reach the right file.
 */
export async function handleComponentsStyleRoute(relative: string): Promise<Response> {
  const cssPath = resolveSafePath(COMPONENTS_SRC_ROOT, relative);
  if (cssPath === null) return notFound();
  const cssFile = Bun.file(cssPath);
  if (!(await cssFile.exists())) return notFound(`${relative} not found`);
  const css = await cssFile.text();
  return new Response(css, { headers: { 'Content-Type': 'text/css' } });
}

const CINDER_COMPONENT_STYLE_IMPORT =
  /(['"])@lostgradient\/cinder\/([a-z0-9][a-z0-9-]*)\/styles\1/gu;

/** Resolve peer-package style imports to the playground's Cinder CSS routes. */
export function rewritePackageComponentStyleImports(css: string): string {
  return css.replace(
    CINDER_COMPONENT_STYLE_IMPORT,
    (_match, quote: string, componentName: string) =>
      `${quote}/components/${componentName}/${componentName}.css${quote}`,
  );
}

/**
 * GET /package-components/:source/<path>.css → extracted package component CSS.
 *
 * The source id comes from component-sources.ts; preserving the component
 * directory shape keeps relative CSS imports working for future packages.
 */
export async function handlePackageComponentStyleRoute(
  sourceId: string,
  relative: string,
): Promise<Response> {
  const componentSource = componentSourceById(sourceId);
  if (componentSource === undefined) return notFound();

  const cssPath = resolveSafePath(componentSource.componentsRoot, relative);
  if (cssPath === null) return notFound();
  const cssFile = Bun.file(cssPath);
  if (!(await cssFile.exists())) return notFound(`${relative} not found`);
  return new Response(rewritePackageComponentStyleImports(await cssFile.text()), {
    headers: { 'Content-Type': 'text/css' },
  });
}
