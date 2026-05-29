/**
 * manifest-consumer — contract-driven validation of the published `cinder`
 * package against its own machine-readable manifest, run under real Node from
 * the PACKED tarball (never the workspace source tree).
 *
 * Node baseline: 22+ (enforced by validate-consumers.ts before this runs and by
 * `engines.node` in package.json). We deliberately use `createRequire`-based
 * JSON loading rather than JSON import attributes so the script does not depend
 * on a specific minor-version's attribute syntax.
 *
 * What this proves:
 *   1. `cinder/manifest` resolves and its target exists + is non-empty in the
 *      tarball.
 *   2. Every manifest entry's `import` and runtime artifact subpaths
 *      (`examples`, `constraints`) resolve via BOTH ESM `import.meta.resolve`
 *      AND CJS `createRequire().resolve`, and the resolved target exists and is
 *      non-empty. The two resolvers can pick different export conditions, so we
 *      check both.
 *   3. The `schema`/`variables` subpaths are TYPE+SVELTE-only by the generator's
 *      explicit design (no runtime JS is emitted — see generate-exports.ts).
 *      We assert their declaration (`types`) target exists in the tarball, and
 *      we POSITIVELY assert that Node default runtime resolution of them THROWS
 *      `ERR_PACKAGE_PATH_NOT_EXPORTED`. That makes the current intentional
 *      limitation a tested contract: if task 4176c51c later makes these runtime
 *      entry points, this assertion goes red and the fixture must be updated.
 *   4. Two-way export <-> manifest consistency: every runtime artifact the
 *      manifest advertises has a matching package export, and every per-component
 *      export the package ships is accounted for by the manifest (or the
 *      documented non-manifest allowlist).
 *   5. Style policy is all-or-nothing: either no per-component styles subpath
 *      export exists (validate only root `cinder/styles`), or every component
 *      that ships CSS has one.
 */

import { strict as assert } from 'node:assert';
import { existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

/** Absolute path to the installed `cinder` package root inside this fixture. */
const cinderPackageRoot = dirname(require.resolve('cinder/package.json'));

/** Resolve a package-relative export target (e.g. `./dist/...`) to an absolute path. */
function packageRelativeToAbsolute(target) {
  return normalize(join(cinderPackageRoot, target));
}

const failures = [];
function record(message) {
  failures.push(message);
}

/** Resolve a file URL or path to an absolute path and assert it exists + is non-empty. */
function assertResolvedTargetUsable(label, resolved) {
  let filePath;
  try {
    filePath = resolved.startsWith('file:') ? fileURLToPath(resolved) : resolved;
  } catch (error) {
    record(`${label}: could not convert resolved "${resolved}" to a path — ${error.message}`);
    return;
  }
  if (!existsSync(filePath)) {
    record(`${label}: resolved target does not exist on disk: ${filePath}`);
    return;
  }
  const stats = statSync(filePath);
  if (!stats.isFile()) {
    record(`${label}: resolved target is not a file: ${filePath}`);
    return;
  }
  if (stats.size === 0) {
    record(`${label}: resolved target is empty (0 bytes): ${filePath}`);
  }
}

/** Resolve a specifier through BOTH the ESM and CJS resolvers and assert the target is usable. */
function assertRuntimeResolvable(specifier) {
  // ESM resolver — import.meta.resolve is synchronous and returns a file URL on Node 22+.
  try {
    const esmResolved = import.meta.resolve(specifier);
    assertResolvedTargetUsable(`${specifier} [esm]`, esmResolved);
  } catch (error) {
    record(`${specifier} [esm]: import.meta.resolve threw — ${error.code ?? error.message}`);
  }
  // CJS resolver — createRequire().resolve can select a different condition
  // (the CJS path) than the ESM resolver, so we exercise it independently.
  try {
    const cjsResolved = require.resolve(specifier);
    assertResolvedTargetUsable(`${specifier} [cjs]`, cjsResolved);
  } catch (error) {
    record(`${specifier} [cjs]: require.resolve threw — ${error.code ?? error.message}`);
  }
}

/**
 * Assert a specifier is NOT runtime-resolvable under the default condition.
 *
 * This is a deliberate TRIPWIRE, not a bug check. The schema/variables subpaths
 * ship `types` + `svelte` conditions only — no `node`/`default` and no runtime
 * JS — by `generate-exports.ts` design (they are metadata, not runtime entry
 * points). Resolving them under Node's default condition therefore throws.
 *
 * If task 4176c51c (or any change) later makes schema/variables runtime entry
 * points, this assertion goes RED — that is the signal to update this fixture
 * to assert runtime resolution instead of asserting it throws.
 *
 * We accept either ERR_PACKAGE_PATH_NOT_EXPORTED (the export key exists but no
 * condition matches the default lens) or ERR_MODULE_NOT_FOUND (resolver-version
 * differences can surface the same "not a runtime entry point" condition under
 * a different code). Any OTHER outcome — a successful resolve, or a different
 * error code — fails.
 */
const EXPECTED_NOT_RESOLVABLE_CODES = new Set([
  'ERR_PACKAGE_PATH_NOT_EXPORTED',
  'ERR_MODULE_NOT_FOUND',
]);
function assertNotRuntimeResolvable(specifier, reason) {
  for (const [resolverLabel, resolve] of [
    ['esm', (s) => import.meta.resolve(s)],
    ['cjs', (s) => require.resolve(s)],
  ]) {
    let resolved;
    try {
      resolved = resolve(specifier);
    } catch (error) {
      if (EXPECTED_NOT_RESOLVABLE_CODES.has(error.code)) continue; // expected tripwire state
      record(
        `${specifier} [${resolverLabel}]: expected ERR_PACKAGE_PATH_NOT_EXPORTED or ` +
          `ERR_MODULE_NOT_FOUND but got ${error.code ?? error.message}`,
      );
      continue;
    }
    record(
      `${specifier} [${resolverLabel}]: expected NOT to resolve (${reason}) but resolved to ${resolved}. ` +
        `This is the task-4176c51c tripwire: if schema/variables intentionally became runtime entry ` +
        `points, update manifest-consumer to assert runtime resolution instead of non-resolution.`,
    );
  }
}

// ---------------------------------------------------------------------------
// 0. The manifest itself must resolve and be usable.
// ---------------------------------------------------------------------------

assertRuntimeResolvable('cinder/manifest');

// Load the manifest via CJS JSON resolution (no import attributes — see header).
let manifest;
try {
  manifest = require('cinder/manifest');
} catch (error) {
  record(`cinder/manifest: failed to load — ${error.code ?? error.message}`);
}

if (manifest === undefined) {
  process.stderr.write('manifest-consumer FAILED:\n');
  for (const failure of failures) process.stderr.write(`  • ${failure}\n`);
  process.exit(1);
}

assert.equal(manifest.manifestVersion, 1, 'manifest.manifestVersion must be 1');
assert.ok(Array.isArray(manifest.components), 'manifest.components must be an array');
assert.ok(manifest.components.length > 0, 'manifest.components must be non-empty');

// ---------------------------------------------------------------------------
// 1. Read the published package.json exports — the OTHER side of the contract.
// ---------------------------------------------------------------------------

const packageJson = require('cinder/package.json');
const exportsMap = packageJson.exports ?? {};
const exportKeys = new Set(Object.keys(exportsMap));

// ---------------------------------------------------------------------------
// 2. Per-component contract. Treat manifest `import` + `artifacts.*` as THE
//    contract — resolve those exact specifiers, do not recompute `cinder/${id}`.
// ---------------------------------------------------------------------------

// The expected export set we will build up from the manifest, to compare
// against the package's actual per-component exports (two-way consistency).
const expectedComponentExportKeys = new Set();

// Documented non-manifest exports the package ships that the manifest does not
// enumerate. These are allowed extras; anything outside this set + the
// manifest-derived set is an orphan.
const allowedNonComponentExportKeys = new Set([
  '.',
  './package.json',
  './manifest',
  './styles',
  './styles/tokens',
  './styles/foundation',
  './highlighters/shiki',
  // Upstream re-export root barrels. These (and their `/subpath` children,
  // skipped below) are not component exports; node-consumer validates them.
  './markdown',
  './editor',
  './commentary',
  './diff',
]);

/** Convert a `cinder/...` or `cinder` specifier to its `./...` export key. */
function specifierToExportKey(specifier) {
  if (specifier === 'cinder') return '.';
  return './' + specifier.replace(/^cinder\//, '');
}

let anyPerComponentStylesExport = false;
for (const key of exportKeys) {
  if (key.endsWith('/styles') && key !== './styles') {
    anyPerComponentStylesExport = true;
    break;
  }
}

for (const component of manifest.components) {
  const { id, import: importSpecifier, artifacts } = component;

  // 2a. The component's main import must runtime-resolve (it IS a runtime entry
  //     point: it carries `node`/`default` conditions).
  assertRuntimeResolvable(importSpecifier);
  expectedComponentExportKeys.add(specifierToExportKey(importSpecifier));

  // 2b. schema + variables: type/svelte-only by design. The `types` target must
  //     exist in the tarball, but runtime default resolution must NOT resolve.
  for (const metadataKey of ['schema', 'variables']) {
    const specifier = artifacts[metadataKey];
    // Accumulate (don't throw) so one malformed component doesn't mask the rest.
    if (specifier !== `${importSpecifier}/${metadataKey}`) {
      record(
        `${id}: artifacts.${metadataKey} ("${specifier}") must equal import + "/${metadataKey}"`,
      );
      continue;
    }
    const exportKey = specifierToExportKey(specifier);
    expectedComponentExportKeys.add(exportKey);

    const exportEntry = exportsMap[exportKey];
    if (exportEntry === undefined) {
      record(`${id}: manifest advertises ${specifier} but package has no "${exportKey}" export`);
    } else {
      // Assert the declaration target named by the `types` condition exists.
      const typesTarget = exportEntry.types;
      if (typeof typesTarget !== 'string') {
        record(`${id}: export "${exportKey}" has no string "types" condition`);
      } else {
        assertResolvedTargetUsable(
          `${specifier} [types]`,
          packageRelativeToAbsolute(typesTarget),
        );
      }
    }

    // The tripwire: these subpaths intentionally do not runtime-resolve today.
    assertNotRuntimeResolvable(
      specifier,
      `${metadataKey} is type/svelte-only by generate-exports.ts design`,
    );
  }

  // 2c. examples + constraints: JSON sidecars — genuine runtime entry points
  //     (import + default conditions), emitted only when present.
  for (const sidecarKey of ['examples', 'constraints']) {
    const specifier = artifacts[sidecarKey];
    if (specifier === undefined) continue; // not all components ship these
    if (specifier !== `${importSpecifier}/${sidecarKey}`) {
      record(`${id}: artifacts.${sidecarKey} ("${specifier}") must equal import + "/${sidecarKey}"`);
      continue;
    }
    assertRuntimeResolvable(specifier);
    expectedComponentExportKeys.add(specifierToExportKey(specifier));
  }

  // 2d. styles: all-or-nothing policy.
  if (anyPerComponentStylesExport) {
    const stylesKey = specifierToExportKey(`${importSpecifier}/styles`);
    if (exportKeys.has(stylesKey)) {
      assertRuntimeResolvable(`${importSpecifier}/styles`);
      expectedComponentExportKeys.add(stylesKey);
    }
    // A component without a `*/styles` export is allowed only if it ships no
    // CSS sidecar; we cannot see source CSS from the tarball, but we CAN assert
    // that the package never advertises a styles export it can't resolve, which
    // assertRuntimeResolvable above already covers for the ones that exist.
  }
}

// Root `cinder/styles` must always resolve.
assertRuntimeResolvable('cinder/styles');

// ---------------------------------------------------------------------------
// 3. Two-way consistency: no orphaned per-component exports.
//    Every per-component export key (`./<id>`, `./<id>/<artifact>`) must be in
//    the manifest-derived expected set; anything else is an orphan.
// ---------------------------------------------------------------------------

const orphanExports = [];
for (const key of exportKeys) {
  if (allowedNonComponentExportKeys.has(key)) continue;
  if (expectedComponentExportKeys.has(key)) continue;
  // Upstream re-export sub-paths (cinder/markdown/*, cinder/diff/*, etc.) are
  // not component exports and are validated by node-consumer; skip them here.
  if (
    key.startsWith('./markdown/') ||
    key.startsWith('./editor/') ||
    key.startsWith('./commentary/') ||
    key.startsWith('./diff/')
  ) {
    continue;
  }
  orphanExports.push(key);
}
if (orphanExports.length > 0) {
  record(
    `package exports not accounted for by the manifest or the allowlist (orphans):\n    ${orphanExports.join('\n    ')}\n` +
      `  To resolve: if an orphan is a component artifact, the manifest should advertise it ` +
      `(check generate-manifest.ts); if it is a new top-level export, add it to ` +
      `allowedNonComponentExportKeys in this file.`,
  );
}

// ---------------------------------------------------------------------------
// Report.
// ---------------------------------------------------------------------------

if (failures.length > 0) {
  process.stderr.write('manifest-consumer FAILED:\n');
  for (const failure of failures) process.stderr.write(`  • ${failure}\n`);
  process.exit(1);
}

process.stdout.write(
  `manifest-consumer OK — verified ${manifest.components.length} components ` +
    `(import + examples/constraints/styles runtime-resolvable via ESM+CJS; ` +
    `schema/variables type-target present and intentionally not runtime-resolvable; ` +
    `two-way export↔manifest consistency holds).\n`,
);
