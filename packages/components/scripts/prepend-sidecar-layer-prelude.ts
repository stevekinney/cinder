/**
 * Sidecar cascade-layer prelude rewriter.
 *
 * Prepends the `@layer` order-declaration prelude
 * (`@layer cinder.tokens, cinder.foundation, cinder.components, cinder.utilities;`,
 * see {@link LAYER_ORDER_PRELUDE}) as the first NON-COMMENT node of every
 * component CSS sidecar (`src/components/[experimental/]<name>/<name>.css`) — a
 * leading license comment is preserved above it, matching the CSS linter's
 * "first non-comment node" contract.
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
 * Idempotent: a sidecar whose first non-comment node is already the prelude is
 * left untouched (including the valid comment-then-prelude shape).
 *
 * Usage:
 *   bun run scripts/prepend-sidecar-layer-prelude.ts          # rewrite in place
 *   bun run scripts/prepend-sidecar-layer-prelude.ts --check  # exit 1 if any drift
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { parse } from 'postcss';

import { LAYER_ORDER, LAYER_ORDER_PRELUDE } from './check-component-css.ts';
import { discoverComponents } from './lib/discover-components.ts';

/** Whether a parsed node is the `@layer <order>;` prelude statement (no block). */
function isLayerOrderPrelude(node: {
  type: string;
  name?: string;
  params?: string;
  nodes?: unknown;
}): boolean {
  return (
    node.type === 'atrule' &&
    node.name === 'layer' &&
    node.nodes === undefined &&
    (node.params ?? '')
      .split(',')
      .map((part) => part.trim())
      .join(', ') === LAYER_ORDER.join(', ')
  );
}

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
 * Return the sidecar source with the layer-order prelude as its first
 * NON-COMMENT node, or `null` when it is already there (no rewrite needed).
 *
 * The CSS linter permits a leading license comment before the prelude, so we
 * parse rather than string-match: a comment-first sidecar that already has the
 * prelude must NOT be flagged as drift (and must NOT get a second prelude
 * prepended above the comment). When the prelude is missing it is inserted
 * before the first non-comment node, preserving any leading comment.
 */
function withPrelude(source: string): string | null {
  const root = parse(source);
  const firstNonComment = root.nodes.find((node) => node.type !== 'comment');

  // Already correct: the first non-comment node is the prelude.
  if (firstNonComment !== undefined && isLayerOrderPrelude(firstNonComment)) return null;

  if (firstNonComment === undefined) {
    // Only comments (or empty): append the prelude after them.
    return `${source.replace(/\s*$/, '')}\n${LAYER_ORDER_PRELUDE}\n`;
  }

  // Insert the prelude immediately before the first non-comment node, keeping
  // any leading comment(s) above it.
  const insertAt = firstNonComment.source?.start?.offset ?? 0;
  return `${source.slice(0, insertAt)}${LAYER_ORDER_PRELUDE}\n${source.slice(insertAt)}`;
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
