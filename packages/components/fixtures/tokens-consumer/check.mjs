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
 */

import assert from 'node:assert/strict';

import tokenIndex from '@lostgradient/cinder/tokens' with { type: 'json' };
import resolver from '@lostgradient/cinder/tokens/resolver' with { type: 'json' };
import light from '@lostgradient/cinder/tokens/resolved/light' with { type: 'json' };
import dark from '@lostgradient/cinder/tokens/resolved/dark' with { type: 'json' };
import lightReducedMotion from '@lostgradient/cinder/tokens/resolved/light-reduced-motion' with { type: 'json' };
import darkReducedMotion from '@lostgradient/cinder/tokens/resolved/dark-reduced-motion' with { type: 'json' };
import { TOKEN_REGISTRY } from '@lostgradient/cinder/tokens/registry';

const CINDER_NAMESPACE = 'com.lostgradient.cinder';

const RESOLVED_CONTEXTS = [
  ['light', light],
  ['dark', dark],
  ['light-reduced-motion', lightReducedMotion],
  ['dark-reduced-motion', darkReducedMotion],
];

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
for (const [name, context] of RESOLVED_CONTEXTS) {
  const paths = Object.keys(context);
  assert.equal(
    paths.length,
    TOKEN_REGISTRY.entries.length,
    `${name} resolves every token in the registry`,
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

console.log(
  `tokens-consumer — ok: ${TOKEN_REGISTRY.entries.length} tokens across ` +
    `${RESOLVED_CONTEXTS.length} resolved contexts, ${tokenIndex.sources.length} source documents.`,
);
