/**
 * Sidecar cascade-layer prelude rewriter.
 *
 * Prepends the `@layer` order-declaration prelude
 * (`@layer cinder.tokens, cinder.foundation, cinder.components, cinder.utilities;`,
 * see {@link LAYER_ORDER_PRELUDE}) as the FIRST line of every component CSS
 * sidecar (`src/components/[experimental/]<name>/<name>.css`).
 *
 * Why: the build now injects `import 'cinder/<name>/styles'` into every browser
 * component entry, so a component's CSS can land in the document BEFORE
 * `cinder/styles` has run. Without an up-front order declaration, CSS creates
 * the cascade layers in insertion order — silently inverting priority so
 * utilities can no longer override component defaults. Re-declaring the same
 * order is a spec no-op when `cinder/styles` already ran, and fixes the order
 * when the sidecar loads first. The prelude is enforced as line 1 by
 * `check-component-css.ts`.
 *
 * Idempotent: a sidecar that already begins with the prelude is left untouched.
 *
 * Usage:
 *   bun run scripts/prepend-sidecar-layer-prelude.ts          # rewrite in place
 *   bun run scripts/prepend-sidecar-layer-prelude.ts --check  # exit 1 if any drift
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { LAYER_ORDER_PRELUDE } from './check-component-css.ts';
import { discoverComponents } from './lib/discover-components.ts';

const repositoryRoot = process.cwd();
const componentsRoot = join(repositoryRoot, 'src', 'components');

/**
 * Absolute path to a discovered component's source CSS sidecar.
 */
function sidecarPath(name: string, isExperimental: boolean): string {
  return isExperimental
    ? join(componentsRoot, 'experimental', name, `${name}.css`)
    : join(componentsRoot, name, `${name}.css`);
}

/**
 * Return the sidecar source with the layer-order prelude as its first line,
 * or `null` when the prelude is already present (no rewrite needed).
 */
function withPrelude(source: string): string | null {
  // Compare against the trimmed leading line so a trailing-whitespace or CRLF
  // variant of the prelude still counts as present.
  if (source.trimStart().startsWith(LAYER_ORDER_PRELUDE)) return null;
  return `${LAYER_ORDER_PRELUDE}\n${source}`;
}

const checkOnly = process.argv.includes('--check');
const components = await discoverComponents();

const drifted: string[] = [];
for (const component of components) {
  const path = sidecarPath(component.name, component.isExperimental);
  if (!existsSync(path)) continue;
  const source = await Bun.file(path).text();
  const rewritten = withPrelude(source);
  if (rewritten === null) continue;
  drifted.push(path);
  if (!checkOnly) await Bun.write(path, rewritten);
}

if (checkOnly && drifted.length > 0) {
  process.stderr.write(
    `Sidecar layer-prelude drift: ${drifted.length} sidecar(s) missing the leading\n` +
      `\`${LAYER_ORDER_PRELUDE}\` prelude. Run \`bun run scripts/prepend-sidecar-layer-prelude.ts\`:\n` +
      drifted.map((path) => `  ${path}`).join('\n') +
      '\n',
  );
  process.exit(1);
}

process.stdout.write(
  checkOnly
    ? `Sidecar layer-prelude: all ${components.length} components OK.\n`
    : `Sidecar layer-prelude: rewrote ${drifted.length} sidecar(s).\n`,
);
