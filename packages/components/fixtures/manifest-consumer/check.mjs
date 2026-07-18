/**
 * manifest-consumer — contract-driven validation of the published `@lostgradient/cinder`
 * package against its own machine-readable manifest, run under real Node from
 * the PACKED tarball (never the workspace source tree).
 *
 * Node baseline: 22+ (enforced by validate-consumers.ts before this runs and by
 * `engines.node` in package.json). We deliberately use `createRequire`-based
 * JSON loading rather than JSON import attributes so the script does not depend
 * on a specific minor-version's attribute syntax.
 *
 * What this proves:
 *   1. `@lostgradient/cinder/manifest` resolves and its target exists + is non-empty in the
 *      tarball.
 *   2. Every manifest entry's `import` and runtime artifact subpaths
 *      (`examples`, `constraints`) resolve via BOTH ESM `import.meta.resolve`
 *      AND CJS `createRequire().resolve`, and the resolved target exists and is
 *      non-empty. The two resolvers can pick different export conditions, so we
 *      check both.
 *   3. The `schema`/`variables` subpaths are full runtime entry points (task
 *      4176c51c): the build compiles each `<name>.schema.ts` / `.variables.ts`
 *      to its own JS, so the `node`/`default` export conditions resolve to real
 *      files. We assert their declaration (`types`) target exists in the tarball
 *      AND that Node default runtime resolution of them succeeds via BOTH the
 *      ESM and CJS resolvers — a plain Node/Vite consumer can therefore import
 *      `@lostgradient/cinder/<name>/schema` for its default-exported JSON Schema value.
 *   4. Two-way export <-> manifest consistency: every runtime artifact the
 *      manifest advertises has a matching package export, and every per-component
 *      export the package ships is accounted for by the manifest (or the
 *      documented non-manifest allowlist).
 *   5. Style policy is all-or-nothing: either no per-component styles subpath
 *      export exists (validate only root `@lostgradient/cinder/styles`), or every component
 *      that ships CSS has one.
 */

import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

/** Absolute path to the installed `@lostgradient/cinder` package root inside this fixture. */
const cinderPackageRoot = dirname(require.resolve('@lostgradient/cinder/package.json'));

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

// ---------------------------------------------------------------------------
// 0. The manifest itself must resolve and be usable.
// ---------------------------------------------------------------------------

assertRuntimeResolvable('@lostgradient/cinder/manifest');

// Load the manifest via CJS JSON resolution (no import attributes — see header).
let manifest;
try {
  manifest = require('@lostgradient/cinder/manifest');
} catch (error) {
  record(`@lostgradient/cinder/manifest: failed to load — ${error.code ?? error.message}`);
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

const packageJson = require('@lostgradient/cinder/package.json');
const exportsMap = packageJson.exports ?? {};
const exportKeys = new Set(Object.keys(exportsMap));

// ---------------------------------------------------------------------------
// 1a. CLI contract. The packed package must expose a working `cinder` binary.
// ---------------------------------------------------------------------------

if (packageJson.bin?.cinder !== './dist/cli/index.js') {
  record(
    `package.json bin.cinder is ${JSON.stringify(
      packageJson.bin?.cinder,
    )}, expected "./dist/cli/index.js"`,
  );
} else {
  assertResolvedTargetUsable(
    '@lostgradient/cinder bin.cinder target',
    packageRelativeToAbsolute(packageJson.bin.cinder),
  );
}

const nodeModulesRoot = resolve(cinderPackageRoot, '..', '..');
const installedCinderBin = join(
  nodeModulesRoot,
  '.bin',
  process.platform === 'win32' ? 'cinder.cmd' : 'cinder',
);

function runCommand(command, args) {
  return spawnSync(command, args, {
    cwd: nodeModulesRoot,
    encoding: 'utf8',
    env: { ...process.env, TZ: 'UTC', LANG: 'en_US.UTF-8' },
  });
}

function assertCliHelpWorks() {
  if (!existsSync(installedCinderBin)) {
    record(`node_modules/.bin/cinder does not exist at ${installedCinderBin}`);
    return;
  }
  const result = runCommand(installedCinderBin, ['--help']);
  if (result.status !== 0) {
    record(
      `cinder --help exited ${result.status}:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );
    return;
  }
  if (result.stderr.trim().length > 0) {
    record(`cinder --help wrote to stderr:\n${result.stderr}`);
  }
  if (!result.stdout.includes('cinder mcp')) {
    record('cinder --help output does not mention `cinder mcp`');
  }
}

function assertCliJson(label, args, check) {
  const cinderEntrypoint = packageRelativeToAbsolute('./dist/cli/index.js');
  const result = runCommand(process.execPath, [cinderEntrypoint, ...args]);
  if (result.status !== 0) {
    record(`${label} exited ${result.status}:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
    return;
  }
  if (result.stderr.trim().length > 0) {
    record(`${label} wrote to stderr:\n${result.stderr}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (error) {
    record(`${label} did not print valid JSON: ${error.message}\n${result.stdout}`);
    return;
  }
  try {
    check(parsed);
  } catch (error) {
    record(`${label} JSON assertion failed: ${error.message}`);
  }
}

assertCliHelpWorks();
assertCliJson('cinder search modal --json', ['search', 'modal', '--json'], (payload) => {
  assert.equal(payload.package.name, '@lostgradient/cinder');
  assert.equal(payload.command, 'search');
  assert.ok(
    payload.data.some((component) => component.id === 'modal'),
    'expected search results to include modal',
  );
});
assertCliJson('cinder show button --json', ['show', 'button', '--json'], (payload) => {
  assert.equal(payload.command, 'show');
  assert.equal(payload.data.component.id, 'button');
  assert.ok(payload.data.schema, 'expected button schema');
  assert.ok(payload.data.variables, 'expected button variables');
});
assertCliJson(
  'cinder best-practices styles --json',
  ['best-practices', 'styles', '--json'],
  (payload) => {
    assert.equal(payload.command, 'best-practices');
    assert.ok(
      payload.data.some((entry) => entry.topic === 'styles'),
      'expected styles best-practice entry',
    );
  },
);

// ---------------------------------------------------------------------------
// 2. Per-component contract. Treat manifest `import` + `artifacts.*` as THE
//    contract — resolve those exact specifiers, do not recompute `@lostgradient/cinder/${id}`.
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
  './styles/all',
  './styles/tokens',
  './styles/foundation',
  './styles/utilities',
  './styles/guard',
  './icons',
  './highlighters/shiki',
  // Upstream re-export root barrels. These (and their `/subpath` children,
  // skipped below) are not component exports; node-consumer validates them.
  './markdown',
  './editor',
  './commentary',
  './diff',
]);

/** Convert a `@lostgradient/cinder/...` or `@lostgradient/cinder` specifier to its `./...` export key. */
function specifierToExportKey(specifier) {
  if (specifier === '@lostgradient/cinder') return '.';
  return './' + specifier.replace(/^@lostgradient\/cinder\//, '');
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

  // 2b. schema + variables: full runtime entry points (task 4176c51c). The
  //     `types` declaration target must exist AND the subpath must runtime-resolve
  //     via both the ESM and CJS resolvers.
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
        assertResolvedTargetUsable(`${specifier} [types]`, packageRelativeToAbsolute(typesTarget));
      }
      // The resolver only ever selects ONE condition (node wins for both ESM and
      // CJS here), so assertRuntimeResolvable never touches the `default` target.
      // Assert BOTH the `node` and `default` runtime targets exist on disk — a
      // missing `default` build artifact would 404 for a plain Vite/bundler
      // consumer that resolves `default` while the fixture stayed green.
      for (const condition of ['node', 'default']) {
        const target = exportEntry[condition];
        if (typeof target !== 'string') {
          record(`${id}: export "${exportKey}" has no string "${condition}" condition`);
        } else {
          assertResolvedTargetUsable(
            `${specifier} [${condition}]`,
            packageRelativeToAbsolute(target),
          );
        }
      }
    }

    // Runtime entry point: the default-exported JSON Schema / variables value
    // must be importable from a plain Node/Vite consumer.
    assertRuntimeResolvable(specifier);
  }

  // 2c. examples + constraints: JSON sidecars — genuine runtime entry points
  //     (import + default conditions), emitted only when present.
  for (const sidecarKey of ['examples', 'constraints']) {
    const specifier = artifacts[sidecarKey];
    if (specifier === undefined) continue; // not all components ship these
    if (specifier !== `${importSpecifier}/${sidecarKey}`) {
      record(
        `${id}: artifacts.${sidecarKey} ("${specifier}") must equal import + "/${sidecarKey}"`,
      );
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

// Root `@lostgradient/cinder/styles` must always resolve.
assertRuntimeResolvable('@lostgradient/cinder/styles');

// ---------------------------------------------------------------------------
// 3. Two-way consistency: no orphaned per-component exports.
//    Every per-component export key (`./<id>`, `./<id>/<artifact>`) must be in
//    the manifest-derived expected set; anything else is an orphan.
// ---------------------------------------------------------------------------

// Experimental deprecation-alias exports: `./experimental/<name>` and its
// `/schema`, `/variables`, `/styles`, `/examples`, and `/constraints` subpaths
// are generated shims that re-export a component promoted out of `experimental/`
// to the top level. They are legitimate package exports the manifest does not
// enumerate — but only when the promoted target `./<name>` is itself a real
// component export. An `experimental/*` alias whose base is NOT a known export is
// a genuine orphan (a stale or typo'd alias), so we validate the relationship
// rather than blanket-skipping the whole namespace.
const EXPERIMENTAL_ALIAS_PATTERN =
  /^\.\/experimental\/([a-z0-9][a-z0-9-]*)(\/(?:schema|variables|styles|examples|constraints))?$/;
function isValidExperimentalAlias(key) {
  const match = EXPERIMENTAL_ALIAS_PATTERN.exec(key);
  if (match === null) return false;
  const promotedKey = `./${match[1]}${match[2] ?? ''}`;
  // The promoted target must be the exact manifest-derived component export, not
  // merely any package export or any component base export. Checking only the
  // base would wrongly accept stale sidecar aliases such as
  // `./experimental/foo/examples` when `./foo/examples` is not published.
  return expectedComponentExportKeys.has(promotedKey);
}

const orphanExports = [];
for (const key of exportKeys) {
  if (allowedNonComponentExportKeys.has(key)) continue;
  if (expectedComponentExportKeys.has(key)) continue;
  // Experimental deprecation aliases that point at a real promoted component.
  if (isValidExperimentalAlias(key)) continue;
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
    `(import + schema/variables/examples/constraints/styles runtime-resolvable via ESM+CJS; ` +
    `schema/variables type-target present; ` +
    `two-way export↔manifest consistency holds).\n`,
);
