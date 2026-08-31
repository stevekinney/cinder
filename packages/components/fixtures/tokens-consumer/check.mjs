/**
 * tokens-consumer — proves the DTCG token artifacts are actually consumable
 * from the PUBLISHED package, under real Node, from the packed tarball.
 *
 * This fixture exists because an `exports` entry can point at a path that
 * `files` excludes: the subpath then resolves fine in the repository and 404s
 * from the registry. `src/tokens/**` was in exactly that state before CIN-31.
 * Resolving through the workspace would hide that, so `validate-consumers.ts`
 * installs the real tarball here.
 *
 * Node baseline: 22+ (enforced by validate-consumers.ts and `engines.node`).
 * JSON is loaded with import attributes (`with { type: 'json' }`), which is
 * what CIN-31 specifies consumers should be able to use.
 *
 * What this proves:
 *   1. All seven mandatory subpaths resolve and load: `/tokens`,
 *      `/tokens/resolver`, the four `/tokens/resolved/*` contexts, and
 *      `/tokens/registry`.
 *   2. The resolved contexts are usable WITHOUT running Cinder's resolver —
 *      every token carries a literal value plus the metadata needed to map it
 *      back to a CSS custom property.
 *   3. The registry module's runtime data agrees with the index and with the
 *      resolved contexts, so the artifacts are internally consistent rather
 *      than merely present.
 *   4. (CIN-34) The generated CSS ships too, and declares every custom property
 *      the registry advertises. That makes this fixture cover all FOUR artifact
 *      types a consumer can reach for — generated CSS, unresolved token JSON,
 *      resolved token JSON, and registry types — rather than the JSON three.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import tokenIndex from '@lostgradient/cinder/tokens' with { type: 'json' };
import resolver from '@lostgradient/cinder/tokens/resolver' with { type: 'json' };
import light from '@lostgradient/cinder/tokens/resolved/light' with { type: 'json' };
import dark from '@lostgradient/cinder/tokens/resolved/dark' with { type: 'json' };
import lightReducedMotion from '@lostgradient/cinder/tokens/resolved/light-reduced-motion' with { type: 'json' };
import darkReducedMotion from '@lostgradient/cinder/tokens/resolved/dark-reduced-motion' with { type: 'json' };
import colorsSet from '@lostgradient/cinder/tokens/sets/colors' with { type: 'json' };
import componentsSet from '@lostgradient/cinder/tokens/sets/components' with { type: 'json' };
import foundationSet from '@lostgradient/cinder/tokens/sets/foundation' with { type: 'json' };
import semanticSet from '@lostgradient/cinder/tokens/sets/semantic' with { type: 'json' };
import { TOKEN_REGISTRY } from '@lostgradient/cinder/tokens/registry';

const CINDER_NAMESPACE = 'com.lostgradient.cinder';

const RESOLVED_CONTEXTS = [
  ['light', light],
  ['dark', dark],
  ['light-reduced-motion', lightReducedMotion],
  ['dark-reduced-motion', darkReducedMotion],
];

/**
 * Tokens whose real CSS value has no DTCG representation -- `carousel.slide-size`
 * (a bare percentage), `carousel.aspect-ratio` (a ratio), `code-block.height`
 * (the `auto` keyword), `spinner.indicator` (`currentColor`). Each carries a
 * nominal `$value` placeholder with `cssRecipe` governing emission, and the
 * generator deliberately omits them from the resolved contexts so a generic
 * consumer cannot apply the placeholder literally (see `generate.ts`, which
 * skips any token whose extensions set `nonRepresentableValue`).
 *
 * They stay in the registry, because the registry advertises the custom
 * property surface rather than resolved values. So the resolved contexts hold
 * exactly the registry's tokens MINUS these -- asserted as a set below, not a
 * count, so that both an unexpected omission and a stale exclusion fail.
 */
const NON_REPRESENTABLE_PATHS = collectNonRepresentablePaths([
  colorsSet,
  componentsSet,
  foundationSet,
  semanticSet,
]);

function collectNonRepresentablePaths(documents) {
  const found = new Set();

  const visit = (node, trail) => {
    if (!node || typeof node !== 'object') return;

    if ('$value' in node) {
      if (node.$extensions?.[CINDER_NAMESPACE]?.nonRepresentableValue === true) {
        found.add(trail.join('.'));
      }
      return;
    }

    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith('$')) continue;
      visit(child, [...trail, key]);
    }
  };

  for (const document of documents) visit(document, []);

  return found;
}

/** The index describes the surface and agrees with what shipped. */
assert.equal(tokenIndex.version, '2025.10', 'token index declares the DTCG version');
assert.ok(Array.isArray(tokenIndex.sources), 'token index lists its source documents');
assert.ok(tokenIndex.sources.length > 0, 'token index lists at least one source document');
assert.equal(
  tokenIndex.resolvedContexts.length,
  RESOLVED_CONTEXTS.length,
  'token index lists exactly the resolved contexts this fixture imports',
);

/** The resolver document is the conformant object-keyed 2025.10 shape. */
assert.equal(resolver.version, '2025.10', 'resolver declares its version');
assert.ok(resolver.sets && typeof resolver.sets === 'object', 'resolver has an object-keyed `sets`');
assert.ok(
  resolver.modifiers && typeof resolver.modifiers === 'object',
  'resolver has object-keyed `modifiers`',
);
assert.ok(Array.isArray(resolver.resolutionOrder), 'resolver has a `resolutionOrder`');

/** The registry carries every facet CIN-30 generates. */
for (const facet of [
  'entries',
  'pathToCssProperty',
  'cssPropertyToPath',
  'cssPropertyToPaths',
  'byCategory',
  'byComponent',
]) {
  assert.ok(facet in TOKEN_REGISTRY, `registry exposes \`${facet}\``);
}
assert.ok(TOKEN_REGISTRY.entries.length > 0, 'registry has entries');
assert.equal(
  TOKEN_REGISTRY.entries.length,
  tokenIndex.tokenCount,
  'registry entry count matches the index',
);

/**
 * The load-bearing claim: a consumer can use a resolved context WITHOUT running
 * the resolver. Every token must carry a literal value and enough metadata to
 * reach a CSS custom property. Before CIN-31, 96 of 216 tokens per context
 * carried neither `cssProperty` nor a description, because resolution replaced
 * overridden tokens wholesale.
 */
assert.ok(
  NON_REPRESENTABLE_PATHS.size > 0,
  'the corpus still flags non-representable tokens (guards against a silently emptied exclusion set)',
);

for (const path of NON_REPRESENTABLE_PATHS) {
  assert.ok(
    TOKEN_REGISTRY.pathToCssProperty[path],
    `non-representable token ${path} is still advertised by the registry`,
  );
}

const EXPECTED_RESOLVED_PATHS = TOKEN_REGISTRY.entries
  .map((entry) => entry.path)
  .filter((path) => !NON_REPRESENTABLE_PATHS.has(path))
  .sort();

for (const [name, context] of RESOLVED_CONTEXTS) {
  const paths = Object.keys(context);
  assert.deepEqual(
    [...paths].sort(),
    EXPECTED_RESOLVED_PATHS,
    `${name} resolves every registry token except the non-representable ones`,
  );

  for (const path of paths) {
    const token = context[path];
    assert.ok(token && typeof token === 'object', `${name}: ${path} is an object`);
    assert.ok('$value' in token, `${name}: ${path} has a $value`);

    // No unresolved aliases: the whole point of a resolved artifact is that a
    // consumer never has to follow a reference itself.
    if (typeof token.$value === 'string') {
      assert.ok(
        !/^\{[^{}]+\}$/.test(token.$value) && !token.$value.startsWith('#/'),
        `${name}: ${path} has a literal value, not an unresolved alias`,
      );
    }

    const extensions = token.$extensions?.[CINDER_NAMESPACE];
    assert.ok(
      typeof extensions?.cssProperty === 'string' && extensions.cssProperty.length > 0,
      `${name}: ${path} keeps its cssProperty through resolution`,
    );
    assert.equal(
      extensions.cssProperty,
      TOKEN_REGISTRY.pathToCssProperty[path],
      `${name}: ${path} agrees with the registry on its custom property`,
    );
  }
}

/**
 * The fourth artifact type: the generated stylesheet.
 *
 * Node cannot `import` CSS, so the subpath is resolved and the file read. That
 * still proves the thing that matters — that `./styles/tokens` resolves from a
 * real install of the packed tarball, which is exactly the failure mode this
 * fixture exists for (an `exports` entry pointing at a path `files` excludes).
 *
 * `tokens.css` is an aggregator of `@import`s, so the declarations live in the
 * files it pulls in; reading only the entry would assert nothing about tokens.
 */
function readCssGraph(specifier) {
  const entry = fileURLToPath(import.meta.resolve(specifier));
  const seen = new Set();
  const chunks = [];

  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    chunks.push(source);
    for (const match of source.matchAll(/@import\s+['"]([^'"]+)['"]/g)) {
      const target = match[1];
      // Only relative imports are part of the package's own graph.
      if (target.startsWith('.')) visit(resolvePath(dirname(file), target));
    }
  };

  visit(entry);
  return { css: chunks.join('\n'), files: seen.size };
}

const { css: tokenCss, files: cssFileCount } = readCssGraph('@lostgradient/cinder/styles/tokens');
assert.ok(tokenCss.length > 0, 'the generated token stylesheet is not empty');

const declaredProperties = new Set(
  [...tokenCss.matchAll(/(--cinder-[a-z0-9-]+)\s*:/g)].map((match) => match[1]),
);
const advertised = TOKEN_REGISTRY.entries.filter((entry) => entry.public);
const undeclared = advertised
  .map((entry) => entry.cssProperty)
  .filter((property) => !declaredProperties.has(property));
assert.deepEqual(
  undeclared,
  [],
  'every public token the registry advertises is declared in the shipped CSS',
);

console.log(
  `tokens-consumer — ok: ${TOKEN_REGISTRY.entries.length} tokens across ` +
    `${RESOLVED_CONTEXTS.length} resolved contexts, ${tokenIndex.sources.length} source documents, ` +
    `${advertised.length} public properties declared across ${cssFileCount} stylesheet(s).`,
);
