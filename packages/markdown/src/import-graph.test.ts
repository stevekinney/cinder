/**
 * Import-graph leanness guard.
 *
 * The bundle-bloat regression this protects against (the rendering pipeline
 * pulled in by every consumer of @lostgradient/markdown) is easy to re-introduce —
 * one accidental `export *` or a barrel import across subpaths and the rendering
 * stack creeps back into diff-only consumers.
 *
 * HOW THIS WORKS (and why it no longer uses Bun.build):
 *
 * It used to bundle each subpath with `Bun.build` and grep the output for
 * rendering-library strings. On Linux CI that intermittently failed with
 * `EISDIR reading file: ".../packages/diff/src/line-diff.ts"` — a Bun
 * bundler / libuv / overlayfs path-confusion surfaced as a spurious filesystem
 * error when `Bun.build` walked the live workspace graph while @cinder/diff's
 * own test process touched the same file. Retries (PRs #213/#214) only reduced
 * the probability; they never eliminated it.
 *
 * Instead we now walk the import graph STATICALLY: resolve each subpath to its
 * source file via the package `exports` map, read each file with `readFileSync`,
 * extract its runtime imports with `Bun.Transpiler.scanImports` (which excludes
 * `import type` / `export type`), resolve each specifier, and recurse. A subpath
 * is "lean" iff no FORBIDDEN rendering package is reachable from it. Deterministic
 * and immune to filesystem races.
 *
 * GUARANTEE (and the one way it differs from the old bundler test): this asserts
 * that cinder's own SOURCE graph never DIRECTLY imports a rendering package. It
 * does NOT traverse into node_modules, so it would not catch a third-party
 * wrapper that itself pulls in `rehype-katex`. That tradeoff is deliberate and
 * safe here: cinder controls its own direct dependencies, every rendering package
 * cinder could import is in FORBIDDEN_RENDERING_PACKAGES, and the traversal closes
 * the two ways an edge could otherwise hide a dependency —
 *   1. it FAILS LOUDLY on any internal edge (relative or `@cinder/*`) it cannot
 *      follow, and
 *   2. it BANS computed dynamic imports AND computed `require(...)` calls
 *      (`import(variable)`, `require('a'+b)`, interpolated `` import(`…${x}…`) ``)
 *      in guarded source, since those are invisible to static analysis (see
 *      `assertNoComputedImport`).
 * Within cinder's source it is actually STRICTER than the old bundle-text grep:
 * it sees the import even when the bundler would have tree-shaken or renamed the
 * telltale string.
 *
 * Categories:
 *
 * A. **Narrow / leaf subpaths** — no rendering package reachable. `diff/line-diff`
 *    is the canonical "tiny consumer"; nothing in it should drag rendering.
 * B. **Aggregate barrels** — no rendering package reachable, even though they may
 *    legitimately reach unified/remark for the parser.
 * C. **Bare root** — re-exports `diff` and `pipeline` only; no rendering reachable
 *    regardless of which namespace a consumer uses.
 * D. **Sanity** — the rendering subpath MUST reach the rendering packages, so the
 *    leanness assertions above cannot pass vacuously.
 */

import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import ts from 'typescript';

// Rendering-only packages that cinder's source imports DIRECTLY. A lean subpath
// must not reach any of these; the rendering subpath must reach all of them.
// Matched as exact package names or scoped-package prefixes (e.g. any
// `@shikijs/*` matches `@shikijs/`).
//
// NB: bare `katex` is intentionally NOT listed — cinder does not import `katex`
// directly; it imports `rehype-katex` + `remark-math`, which pull katex in
// transitively. The old Bun.build test saw the string "katex" only because the
// bundler inlined rehype-katex's transitive katex body. This static graph tracks
// DIRECT imports, so we forbid the packages cinder actually imports. Reaching
// rehype-katex/remark-math from a lean subpath still fails correctly.
const FORBIDDEN_RENDERING_PACKAGES = ['shiki', '@shikijs/', 'rehype-katex', 'remark-math'] as const;

const WORKSPACE_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const PACKAGES_DIR = join(WORKSPACE_ROOT, 'packages');

// The import conditions to apply, in priority order, when picking a target from
// an `exports` entry. The old Bun.build version resolved with `target: 'browser'`
// + `conditions: ['bun']`, so we mirror that: `bun` first, then the implicit
// browser/import/default chain. (No @cinder/* package actually declares a
// `browser` condition today, so for cinder's own graph this resolves identically
// to `bun`→src; `browser` is included so the resolver stays faithful if one is
// added later.) `types` is intentionally absent — we must never follow a
// type-only target.
const EXPORT_CONDITIONS = ['bun', 'browser', 'import', 'default'] as const;

type PackageJson = {
  name?: string;
  exports?: Record<string, unknown>;
};

const packageJsonCache = new Map<string, PackageJson | null>();
const scanCache = new Map<string, string[]>();
const transpiler = new Bun.Transpiler({ loader: 'ts' });

function readPackageJson(packageDir: string): PackageJson | null {
  if (packageJsonCache.has(packageDir)) return packageJsonCache.get(packageDir) ?? null;
  const path = join(packageDir, 'package.json');
  const parsed = existsSync(path) ? (JSON.parse(readFileSync(path, 'utf-8')) as PackageJson) : null;
  packageJsonCache.set(packageDir, parsed);
  return parsed;
}

/** Pick a target string from an `exports` entry, applying conditions in order. */
function pickConditionTarget(entry: unknown): string | undefined {
  if (typeof entry === 'string') return entry;
  // Array-form exports (`["./a.js", "./b.js"]`) and null/primitives are not
  // condition objects — bail rather than treating an array index as a condition.
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return undefined;
  const record = entry as Record<string, unknown>;
  for (const condition of EXPORT_CONDITIONS) {
    if (condition in record) {
      const picked = pickConditionTarget(record[condition]);
      if (picked) return picked;
    }
  }
  return undefined;
}

/**
 * Confirm `specifier` names an actual workspace package — not merely a
 * bare import whose leaf segment happens to collide with a
 * `packages/<dir>` directory name (e.g. some hypothetical external
 * `@some-scope/markdown` while `packages/markdown` exists in this repo).
 * Workspace-ness is decided structurally rather than by a hardcoded scope
 * prefix: every workspace package lives at `packages/<dir>`, where `<dir>`
 * is the LAST path segment of its npm name (`@lostgradient/markdown` →
 * `markdown`, `@cinder/commentary` → `commentary`). We try that directory
 * and confirm its `package.json#name` matches the specifier's package name
 * EXACTLY — directory existence alone is not sufficient, since an unrelated
 * third-party scoped package sharing a leaf name would otherwise
 * false-positive as a workspace edge.
 *
 * Returns the package directory only on a confirmed name match; `undefined`
 * for anything else (no such directory, or a name mismatch — i.e. a
 * same-leaf-name external package).
 */
function resolveWorkspacePackageDirectory(specifier: string): string | undefined {
  if (!specifier.startsWith('@')) return undefined;
  const segments = specifier.split('/');
  const packageDirName = segments[1]; // '@scope/name/sub' → segments = ['@scope','name','sub']
  if (packageDirName === undefined) return undefined;
  const packageQualifiedName = `@${segments[0]!.slice(1)}/${packageDirName}`;
  const packageDir = join(PACKAGES_DIR, packageDirName);
  const packageJson = readPackageJson(packageDir);
  if (packageJson?.name !== packageQualifiedName) return undefined;
  return packageDir;
}

/**
 * Resolve a workspace package subpath (e.g. `@lostgradient/markdown/diff/line-diff`)
 * to an absolute SOURCE file path via that package's `exports` map. Returns
 * undefined for non-workspace (external) packages — those are leaves we only
 * check by name.
 */
function resolveWorkspaceSubpath(specifier: string): string | undefined {
  const packageDir = resolveWorkspacePackageDirectory(specifier);
  if (!packageDir) return undefined;
  const packageJson = readPackageJson(packageDir);
  if (!packageJson?.exports) return undefined;
  const packageQualifiedName = packageJson.name!;
  const subpath = specifier.slice(packageQualifiedName.length); // '' or '/diff/line-diff'

  const exportKey = subpath === '' ? '.' : `.${subpath}`;
  const entry = packageJson.exports[exportKey];
  if (entry === undefined) return undefined;
  const target = pickConditionTarget(entry);
  if (!target) return undefined;

  // Prefer the source (.ts) target over a built (.js) one so we traverse the
  // real graph, not a stale dist build. The `bun` condition already points at
  // src; if a target resolved to dist, map it back to the src twin.
  const resolved = resolve(packageDir, target);
  return toSourcePath(resolved);
}

/** Map a `dist/.../x.js` export target back to its `src/.../x.ts` twin. */
function toSourcePath(filePath: string): string | undefined {
  const candidates = [filePath];
  if (filePath.includes('/dist/')) {
    const srcBase = filePath.replace('/dist/', '/src/');
    // Prefer the source twin; cover both .js→.ts and .jsx→.tsx.
    candidates.unshift(srcBase.replace(/\.jsx$/, '.tsx'), srcBase.replace(/\.js$/, '.ts'));
  }
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Resolve a relative import specifier (e.g. `./types.js`) from an importer file
 * to an absolute source path, mapping `.js` → `.ts` and bare dirs → `index.ts`.
 */
function resolveRelative(importer: string, specifier: string): string | undefined {
  const base = resolve(dirname(importer), specifier);
  const candidates = [
    base,
    base.replace(/\.js$/, '.ts'),
    base.replace(/\.jsx$/, '.tsx'),
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Runtime import specifiers in a source file.
 *
 * `scanImports` returns `import-statement` (static `import`/`export … from`,
 * including `export * from`), `dynamic-import` (`import('…')`), and
 * `require-call` entries, and EXCLUDES `import type` / `export type`. We keep ALL
 * of those kinds deliberately:
 *   - `export * from`/`export { } from` are exactly the accidental re-exports
 *     this leanness guard exists to catch — they must be followed.
 *   - a `dynamic-import` is still a real bundle dependency (it ships in the
 *     artifact), so we treat it as reachable. This is also load-bearing for the
 *     sanity check: @lostgradient/markdown/rendering reaches `remark-math` /
 *     `rehype-katex` only via dynamic imports in render.ts. If a future Bun
 *     dropped dynamic imports from scanImports, the sanity check would fail
 *     loudly (rendering subpath stops reaching them) rather than silently
 *     weakening the leanness tests — which is the safe failure direction.
 *
 * COMPUTED dynamic imports (`import(someVariable)`) are invisible to static
 * analysis and cannot be followed — so rather than silently accept that blind
 * spot, the traversal BANS them in guarded source (see `assertNoComputedImport`).
 * A guarded file must use only string-literal dynamic imports, which we CAN see.
 */
function scanRuntimeImports(filePath: string): string[] {
  const cached = scanCache.get(filePath);
  if (cached) return cached;
  const code = readFileSync(filePath, 'utf-8');
  assertNoComputedImport(filePath, code);
  const specifiers = transpiler.scanImports(code).map((entry) => entry.path);
  scanCache.set(filePath, specifiers);
  return specifiers;
}

// Ban any dynamic `import(...)` OR `require(...)` whose specifier is NOT a plain
// string literal or a no-substitution template — those are the only forms
// `scanImports` (and any static analysis) can follow. `scanImports` reports both
// `dynamic-import` and `require-call` entries, so both have the SAME blind spot:
// a computed specifier — `import(variable)`, `require('a' + b)`,
// `import(\`./\${x}\`)`, `require(cond ? a : c)` — could hide a rendering
// dependency at runtime while being invisible to the traversal.
//
// This uses a real TypeScript AST rather than a regex: a textual scan both MISSES
// computed expressions that begin with a literal (`import('a' + name)`) and
// FALSE-POSITIVES on `import(`/`require(` text inside comments or strings. The AST
// sees only genuine call expressions and inspects the actual first argument.
function assertNoComputedImport(filePath: string, code: string): void {
  const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);
  const offenders: string[] = [];

  const isDynamicImport = (node: ts.CallExpression): boolean =>
    node.expression.kind === ts.SyntaxKind.ImportKeyword;
  // A bare `require(...)` call (require as a plain identifier, not `foo.require`).
  const isRequireCall = (node: ts.CallExpression): boolean =>
    ts.isIdentifier(node.expression) && node.expression.text === 'require';

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      node.arguments.length > 0 &&
      (isDynamicImport(node) || isRequireCall(node))
    ) {
      const specifier = node.arguments[0]!;
      const isFollowable =
        ts.isStringLiteral(specifier) || ts.isNoSubstitutionTemplateLiteral(specifier);
      if (!isFollowable) {
        const kind = isRequireCall(node) ? 'require' : 'import';
        offenders.push(`${kind}(${specifier.getText(sourceFile)})`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  if (offenders.length > 0) {
    throw new Error(
      `Computed dynamic import/require found in "${filePath}": ${offenders.join(', ')}. A guarded ` +
        `module must use only string-literal dynamic imports/requires so the leanness traversal can ` +
        `follow them — a computed specifier is invisible to static analysis and could hide a ` +
        `rendering dependency. Use a literal, or restructure.`,
    );
  }
}

/**
 * Whether an imported `specifier` belongs to a forbidden-package `entry`. A
 * trailing-slash entry (e.g. `@shikijs/`) matches any scoped subpath; a plain
 * entry (e.g. `shiki`) matches the package itself or any of its subpaths
 * (`shiki`, `shiki/core`, …) but not an unrelated package that merely shares a
 * prefix (`shiki-foo`).
 */
function matchesPackage(specifier: string, entry: string): boolean {
  return entry.endsWith('/')
    ? specifier.startsWith(entry)
    : specifier === entry || specifier.startsWith(`${entry}/`);
}

function isForbiddenPackage(specifier: string): boolean {
  return FORBIDDEN_RENDERING_PACKAGES.some((entry) => matchesPackage(specifier, entry));
}

type ReachResult = {
  /** Forbidden rendering packages reached from the entry subpath. */
  forbiddenReached: Set<string>;
  /** Every external (non-relative, non-workspace) bare import reached. */
  externalsReached: Set<string>;
  /** Every source file reached from the entry subpath. */
  filesReached: Set<string>;
};

/**
 * Walk the import graph from a workspace subpath and report which forbidden
 * rendering packages (and all externals) are reachable. Pure file reads —
 * no bundler, no resolver that can hit the EISDIR race.
 */
function reachFromSubpath(entrySubpath: string): ReachResult {
  const forbiddenReached = new Set<string>();
  const externalsReached = new Set<string>();
  const filesReached = new Set<string>();
  const entryFile = resolveWorkspaceSubpath(entrySubpath);
  if (!entryFile) {
    throw new Error(
      `Could not resolve subpath "${entrySubpath}" to a source file via package exports. ` +
        `Check the package.json "exports" map and the EXPORT_CONDITIONS order.`,
    );
  }

  const visited = new Set<string>();
  const queue: string[] = [entryFile];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);
    filesReached.add(file);

    for (const specifier of scanRuntimeImports(file)) {
      // A relative or workspace (@cinder/*) import MUST resolve to a source file
      // we can follow. If it doesn't, we'd silently drop that subgraph — the
      // exact false negative this test exists to prevent (a rendering dependency
      // could hide behind an unfollowed edge). So fail loudly instead of skipping.
      if (specifier.startsWith('.')) {
        const next = resolveRelative(file, specifier);
        if (!next) {
          throw new Error(
            `Unresolvable relative import "${specifier}" from "${file}". The leanness ` +
              `traversal must follow every internal edge — a dropped edge could hide a ` +
              `rendering dependency. Fix the resolver's extension/index candidates or the import.`,
          );
        }
        queue.push(next);
        continue;
      }
      if (specifier.startsWith('@')) {
        // Confirmed by package.json#name, not just directory existence — a
        // same-leaf-name external package (e.g. some `@scope/markdown` that
        // isn't our `@lostgradient/markdown`) must fall through to the
        // external-leaf branch below, not be treated as an unresolvable
        // internal edge.
        const isWorkspacePackage = resolveWorkspacePackageDirectory(specifier) !== undefined;
        if (isWorkspacePackage) {
          const next = resolveWorkspaceSubpath(specifier);
          if (!next) {
            throw new Error(
              `Unresolvable workspace import "${specifier}" from "${file}". It does not map to a ` +
                `declared export in the target package's package.json "exports". The traversal must ` +
                `follow every workspace-package edge; an internal deep import that bypasses exports (or ` +
                `a missing export entry) could hide a rendering dependency. Declare the export or fix the import.`,
            );
          }
          queue.push(next);
          continue;
        }
        // Not a workspace package directory — an external scoped npm package
        // (e.g. `@shikijs/...`) — fall through and treat it as a leaf below.
      }
      // External (non-workspace) bare import — a graph leaf. We record its NAME
      // and flag it if forbidden, but do NOT traverse into node_modules. This
      // means the guarantee is "cinder source does not DIRECTLY import a rendering
      // package", not "no rendering bytes are transitively bundled". See the file
      // header. A `wrapper-pkg` that itself imports `rehype-katex` would not be
      // caught here — but cinder controls its own direct deps, and the forbidden
      // list names every rendering package cinder could import.
      externalsReached.add(specifier);
      if (isForbiddenPackage(specifier)) forbiddenReached.add(specifier);
    }
  }

  return { forbiddenReached, externalsReached, filesReached };
}

function assertLean(entrySubpath: string): void {
  const { forbiddenReached } = reachFromSubpath(entrySubpath);
  if (forbiddenReached.size > 0) {
    throw new Error(
      `${entrySubpath}: reaches rendering package(s) [${[...forbiddenReached].join(', ')}]. ` +
        `Importing this subpath should not drag the rendering pipeline. Check for an ` +
        `"export *" or a deep import that crosses from a non-rendering module into rendering.`,
    );
  }
}

describe('import-graph leanness', () => {
  describe('narrow subpaths (no rendering)', () => {
    it('@lostgradient/markdown/diff/line-diff does not reach shiki/katex/rehype-katex', () => {
      assertLean('@lostgradient/markdown/diff/line-diff');
    });
  });

  describe('aggregate barrels (no rendering; unified allowed)', () => {
    it('@lostgradient/markdown/pipeline does not reach shiki/katex/rehype-katex', () => {
      assertLean('@lostgradient/markdown/pipeline');
    });

    it('@lostgradient/markdown/diff does not reach shiki/katex/rehype-katex', () => {
      assertLean('@lostgradient/markdown/diff');
    });
  });

  describe('bare root (no rendering reachable)', () => {
    it('@lostgradient/markdown root does not reach rendering', () => {
      // The root barrel re-exports diff + pipeline only. Whichever namespace a
      // consumer reaches into, the rendering graph must not be reachable from
      // the package entry.
      assertLean('@lostgradient/markdown');
    });
  });

  describe('rendering subpath does reach shiki/katex (sanity check)', () => {
    // Inverse assertion: the rendering namespace MUST reach EVERY forbidden
    // rendering package. We require all-present (not any-present) so the leanness
    // tests above cannot pass vacuously — if the rendering graph stopped reaching
    // one of these (e.g. a dependency was renamed), this fails loudly and prompts
    // an update to FORBIDDEN_RENDERING_PACKAGES rather than silently weakening the
    // leanness guarantee.
    it('@lostgradient/markdown/rendering reaches every rendering package', () => {
      const { externalsReached } = reachFromSubpath('@lostgradient/markdown/rendering');
      const reached = [...externalsReached];
      const missing = FORBIDDEN_RENDERING_PACKAGES.filter(
        (entry) => !reached.some((specifier) => matchesPackage(specifier, entry)),
      );
      if (missing.length > 0) {
        throw new Error(
          `Sanity check failed: the rendering subpath no longer reaches [${missing.join(', ')}]. ` +
            `FORBIDDEN_RENDERING_PACKAGES is stale relative to the actual import graph — likely a ` +
            `dependency rename or refactor. Update the list, otherwise the leanness tests can pass ` +
            `vacuously. Externals actually reached: [${[...externalsReached].toSorted().join(', ')}].`,
        );
      }
      expect(missing.length).toBe(0);
    });
  });

  describe('Worker rendering is opt-in', () => {
    it('@lostgradient/markdown/rendering does not reach the Worker modules', () => {
      const { filesReached } = reachFromSubpath('@lostgradient/markdown/rendering');
      expect([...filesReached].some((file) => file.endsWith('/render-async.ts'))).toBe(false);
      expect([...filesReached].some((file) => file.endsWith('/render-worker.ts'))).toBe(false);
    });

    it('@lostgradient/markdown/rendering/async reaches the Worker modules', () => {
      const { filesReached } = reachFromSubpath('@lostgradient/markdown/rendering/async');
      expect([...filesReached].some((file) => file.endsWith('/render-async.ts'))).toBe(true);
    });
  });

  describe('workspace-package detection is name-based, not directory-existence-based', () => {
    // Regression: `packages/markdown` really exists on disk, so a specifier
    // whose leaf segment happens to match it — but whose SCOPE doesn't — must
    // NOT be treated as an internal workspace edge. Before this fix,
    // `looksLikeWorkspacePackage` only checked directory existence and would
    // have made `reachFromSubpath` throw "Unresolvable workspace import" for
    // an external package like this, even though it isn't ours at all.
    it('does not resolve a same-leaf-name external package as a workspace directory', () => {
      expect(resolveWorkspacePackageDirectory('@totally-unrelated-scope/markdown')).toBeUndefined();
    });

    it('does resolve the real @lostgradient/markdown specifier to its package directory', () => {
      expect(resolveWorkspacePackageDirectory('@lostgradient/markdown')).toBe(
        join(PACKAGES_DIR, 'markdown'),
      );
    });

    it('returns undefined for a package.json#name mismatch even with a subpath appended', () => {
      expect(
        resolveWorkspacePackageDirectory('@totally-unrelated-scope/markdown/rendering'),
      ).toBeUndefined();
    });
  });

  describe('computed dynamic imports are banned in guarded source (not just documented)', () => {
    // The blind spot — `import(variable)` is invisible to scanImports — is not
    // merely documented; the traversal BANS it. These tests pin both halves:
    // (1) scanImports really cannot see a computed specifier (so the ban is the
    // only thing standing between us and a false negative), and (2) the ban's
    // detector actually fires on the computed form and stays quiet on the literal
    // form that the traversal CAN follow.
    it('scanImports sees a literal dynamic import but not a computed one', () => {
      const probe = new Bun.Transpiler({ loader: 'ts' });
      const literal = probe.scanImports(`await import('rehype-katex');`).map((entry) => entry.path);
      const computed = probe
        .scanImports(`const renderer = 'rehype-katex';\nawait import(renderer);`)
        .map((entry) => entry.path);
      expect(literal).toContain('rehype-katex');
      expect(computed).not.toContain('rehype-katex'); // the invisible case the ban covers
    });

    it('assertNoComputedImport allows only literal specifiers and catches every computed shape', () => {
      // Followable forms — string literal, no-substitution template, static
      // statements — are fine.
      expect(() => assertNoComputedImport('ok.ts', `await import('rehype-katex');`)).not.toThrow();
      expect(() => assertNoComputedImport('ok.ts', `await import(\`./plain.js\`);`)).not.toThrow();
      expect(() =>
        assertNoComputedImport('ok.ts', `import { x } from './x.js';\nexport * from './y.js';`),
      ).not.toThrow();
      // Literal require() is followable too (scanImports reports require-call).
      expect(() =>
        assertNoComputedImport('ok.ts', `const x = require('rehype-katex');`),
      ).not.toThrow();
      // Not dynamic imports/requires at all — must NOT false-positive (the AST
      // sees these for what they are: an identifier, member calls, a comment, a string).
      expect(() => assertNoComputedImport('ok.ts', `const reimport = (f) => f;`)).not.toThrow();
      expect(() => assertNoComputedImport('ok.ts', `obj.import(thing);`)).not.toThrow();
      expect(() => assertNoComputedImport('ok.ts', `mod.require(thing);`)).not.toThrow();
      expect(() =>
        assertNoComputedImport('ok.ts', `// do not write import(renderer)\nconst s = "import(x)";`),
      ).not.toThrow();
      // Every computed shape must throw — including the ones a regex bypass missed:
      // bare variable, string concatenation, interpolated template, conditional.
      expect(() =>
        assertNoComputedImport('bad.ts', `const r = 'rehype-katex';\nawait import(r);`),
      ).toThrow(/Computed dynamic import\/require/);
      expect(() => assertNoComputedImport('bad.ts', `await import('rehype-' + name);`)).toThrow(
        /Computed dynamic import\/require/,
      );
      expect(() => assertNoComputedImport('bad.ts', `await import(\`./\${name}.js\`);`)).toThrow(
        /Computed dynamic import\/require/,
      );
      expect(() => assertNoComputedImport('bad.ts', `await import(flag ? 'a' : 'b');`)).toThrow(
        /Computed dynamic import\/require/,
      );
      // Computed require() has the same blind spot and must throw too.
      expect(() => assertNoComputedImport('bad.ts', `const x = require(pkgName);`)).toThrow(
        /Computed dynamic import\/require/,
      );
      expect(() => assertNoComputedImport('bad.ts', `const x = require('rehype-' + n);`)).toThrow(
        /Computed dynamic import\/require/,
      );
    });
  });
});
