/**
 * CIN-204: virtual-list dependency-free guard.
 *
 * The virtual-list engine (`packages/components/src/components/virtual-list/**`
 * and its one shared utility, `src/utilities/fixed-virtual-window.ts`) is
 * deliberately hand-rolled rather than built on `@tanstack/virtual-core` —
 * `tree` and `data-grid` already depend on that package, but virtual-list's
 * whole design point (see the Wave 1 design document) is a small, dependency-
 * free measurement/offset engine. Nothing stops a future edit from reaching for
 * `@tanstack/virtual-core` (it is already a declared dependency of this
 * package, imported by other components) or from quietly introducing some
 * other new bare import into this one subtree without a corresponding,
 * reviewed `dependencies` entry.
 *
 * This script walks every `.ts`/`.svelte` file under
 * `packages/components/src/components/virtual-list/**` plus
 * `packages/components/src/utilities/fixed-virtual-window.ts`, parses every
 * `import`/`export ... from` specifier, and fails if any specifier:
 *
 *   - is exactly `@tanstack/virtual-core`, or
 *   - is a bare specifier (not relative, not `svelte`/`svelte/*`, not a
 *     Node/Bun builtin) that is not already listed in this package's
 *     `package.json` `dependencies`.
 *
 * Registered as `check:virtual-list-dependency-free` and wired into
 * `lint:invariants` so it is CI-gated, not merely runnable.
 * `check-pipeline-coverage.ts`'s `DECLARATION_TABLE` still needs a row for
 * this command naming the layers it runs in (`unit-tests`, `main-green`,
 * alongside its `lint:invariants` siblings) — that table lives outside this
 * script and is not edited here.
 * `_internal/dependency-free.test.ts` is a companion Bun regression asserting
 * the same invariant independently, so a local `bun test` run (not just CI)
 * catches a violation without needing this script.
 *
 * oxlint cannot express this rule (no per-glob `no-restricted-imports` scoping
 * in our config, and the forbidden specifier only applies to one subtree, not
 * the whole package). A scanned grep with an explicit allow-list is the
 * simplest durable enforcement, matching `check-no-cycle-imports.ts`.
 */

import { Glob } from 'bun';
import { isBuiltin } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readJsonFile } from './lib/read-json-file.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, '..');
const packageJsonPath = join(packageRoot, 'package.json');
const virtualListRoot = join(packageRoot, 'src', 'components', 'virtual-list');
const fixedVirtualWindowFile = join(packageRoot, 'src', 'utilities', 'fixed-virtual-window.ts');

/**
 * `_internal/dependency-free.test.ts` (relative to `virtualListRoot`) is this
 * script's own companion regression. It legitimately contains the literal
 * `@tanstack/virtual-core` specifier — and other fabricated bare-specifier
 * text — as INERT test fixture strings, exercising this very script's
 * failure path against synthetic source (see its module doc). A grep-based
 * scanner cannot distinguish "a string literal containing import-shaped
 * text" from a real import, so it is excluded here by exact relative path,
 * the same way `check-no-bare-console-warn.ts` allowlists its one legitimate
 * exception. Every OTHER test file under `virtual-list/**` stays in scope.
 */
const SELF_TEST_RELATIVE_PATH = join('_internal', 'dependency-free.test.ts');

/** The one specifier this guard bans outright, regardless of `dependencies`. */
export const FORBIDDEN_SPECIFIER = '@tanstack/virtual-core';

/**
 * Matches an import specifier from `from '<specifier>'` / `from "<specifier>"`
 * (covers both `import ... from '...'` and `export ... from '...'`, `type` or
 * not) and from a bare side-effect `import '<specifier>'`. Applied per line,
 * matching `check-no-cycle-imports.ts`'s grep-based approach.
 *
 * Dynamic `import('<specifier>')` calls are matched too — see
 * {@link DYNAMIC_IMPORT_PATTERN} for how they are judged.
 */
const IMPORT_SPECIFIER_PATTERN = /(?:\bfrom\s*|\bimport\s+)(['"])([^'"]+)\1/g;

/**
 * Matches a dynamic `import('<specifier>')` call.
 *
 * In SHIPPED SOURCE these face the same rule as static imports. A production file
 * that dynamically imports an installed devDependency resolves fine inside this
 * repository and then fails for a published consumer, which is precisely the
 * class of defect this guard exists to prevent, so exempting dynamic syntax there
 * would leave the hole open.
 *
 * In TEST FILES only {@link FORBIDDEN_SPECIFIER} is checked. Tests in this subtree
 * legitimately dynamic-import devDependencies at module scope — `virtual-list.test.ts`
 * does `await import('@testing-library/svelte')` — and this guard resolves bare
 * specifiers against `dependencies` alone, so the full rule would flag every one of
 * them. Nothing in a test file ships, so the undeclared-import risk does not apply;
 * the `@tanstack/virtual-core` ban still does.
 */
const DYNAMIC_IMPORT_PATTERN = /\bimport\s*\(\s*(['"])([^'"]+)\1/g;

/** Files whose imports never ship, so the undeclared-bare-import rule does not apply to them. */
const TEST_FILE_PATTERN = /\.(?:test|spec)\.[cm]?tsx?$/u;

const FORBIDDEN_SPECIFIER_REASON =
  'the virtual-list engine (CIN-204) must stay dependency-free of @tanstack/virtual-core';

/** One disallowed import specifier found in a scanned virtual-list source file. */
export type DependencyViolation = {
  /** Absolute path of the file the violation was found in. */
  filePath: string;
  /** 1-indexed line number within `filePath`. */
  lineNumber: number;
  /** The raw specifier text as written in the source (e.g. `@tanstack/virtual-core`). */
  specifier: string;
  /** The full source line, trimmed, for context in the failure message. */
  line: string;
  /** Human-readable explanation of why this specifier is disallowed. */
  reason: string;
};

function isRelativeSpecifier(specifier: string): boolean {
  return specifier.startsWith('.') || specifier.startsWith('/');
}

function isSvelteSpecifier(specifier: string): boolean {
  return specifier === 'svelte' || specifier.startsWith('svelte/');
}

/**
 * The installable package name a specifier resolves to — everything up to
 * (and including) the scope segment for a scoped package (`@scope/name`), or
 * just the first path segment otherwise. This is what gets looked up against
 * `package.json`'s `dependencies` keys, so `@lostgradient/markdown/foo` and
 * `@lostgradient/markdown` both resolve to the same declared dependency name.
 */
export function packageNameFromSpecifier(specifier: string): string {
  const segments = specifier.split('/');
  if (specifier.startsWith('@')) {
    const [scope, name] = segments;
    return scope === undefined || name === undefined ? specifier : `${scope}/${name}`;
  }
  return segments[0] ?? specifier;
}

/**
 * Returns a human-readable violation reason if `specifier` is not allowed in
 * the virtual-list engine, or `undefined` if it is allowed.
 */
export function classifySpecifier(
  specifier: string,
  declaredDependencyNames: ReadonlySet<string>,
): string | undefined {
  if (specifier === FORBIDDEN_SPECIFIER) {
    return 'the virtual-list engine (CIN-204) must stay dependency-free of @tanstack/virtual-core';
  }
  if (isRelativeSpecifier(specifier)) return undefined;
  if (isSvelteSpecifier(specifier)) return undefined;
  if (isBuiltin(specifier)) return undefined;

  const packageName = packageNameFromSpecifier(specifier);
  if (declaredDependencyNames.has(packageName)) return undefined;

  return (
    `bare import "${packageName}" is not declared in packages/components/package.json ` +
    '"dependencies" (and is not relative, "svelte"/"svelte/*", or a Node/Bun builtin)'
  );
}

/**
 * Scans `content` for import/export-from specifiers and returns one
 * {@link DependencyViolation} per disallowed specifier found. Pure and
 * filesystem-free so it can be exercised directly against fabricated source
 * text (see `_internal/dependency-free.test.ts`).
 */
export function findDependencyViolations(
  content: string,
  filePath: string,
  declaredDependencyNames: ReadonlySet<string>,
): DependencyViolation[] {
  const violations: DependencyViolation[] = [];
  const lines = content.split('\n');
  const isTestFile = TEST_FILE_PATTERN.test(filePath);

  for (const [index, line] of lines.entries()) {
    const seenSpecifiers = new Set<string>();

    IMPORT_SPECIFIER_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = IMPORT_SPECIFIER_PATTERN.exec(line)) !== null) {
      const specifier = match[2];
      if (specifier === undefined) continue;
      seenSpecifiers.add(specifier);
      const reason = classifySpecifier(specifier, declaredDependencyNames);
      if (reason !== undefined) {
        violations.push({ filePath, lineNumber: index + 1, specifier, line: line.trim(), reason });
      }
    }

    // Dynamic imports. Shipped source faces the full rule; test files only the
    // forbidden-specifier ban. See DYNAMIC_IMPORT_PATTERN.
    DYNAMIC_IMPORT_PATTERN.lastIndex = 0;
    while ((match = DYNAMIC_IMPORT_PATTERN.exec(line)) !== null) {
      const specifier = match[2];
      if (specifier === undefined) continue;
      // A static import of the same specifier on this line was already reported
      // above; do not report it twice.
      if (seenSpecifiers.has(specifier)) continue;
      const reason = isTestFile
        ? specifier === FORBIDDEN_SPECIFIER
          ? FORBIDDEN_SPECIFIER_REASON
          : undefined
        : classifySpecifier(specifier, declaredDependencyNames);
      if (reason !== undefined) {
        violations.push({ filePath, lineNumber: index + 1, specifier, line: line.trim(), reason });
      }
    }
  }

  return violations;
}

type PackageManifest = { dependencies?: Record<string, string> };

/** Reads `packages/components/package.json`'s `dependencies` keys. */
export async function loadDeclaredDependencyNames(
  manifestPath: string = packageJsonPath,
): Promise<Set<string>> {
  const manifest = await readJsonFile<PackageManifest>(manifestPath);
  return new Set(Object.keys(manifest.dependencies ?? {}));
}

/**
 * Every `.ts`/`.svelte` file under `virtual-list/**`, plus the one shared
 * utility module the engine is allowed to depend on.
 */
export async function collectScanTargets(): Promise<string[]> {
  const files: string[] = [];
  const glob = new Glob('**/*.{ts,svelte}');
  for await (const relativePath of glob.scan({ cwd: virtualListRoot })) {
    if (relativePath === SELF_TEST_RELATIVE_PATH) continue;
    files.push(join(virtualListRoot, relativePath));
  }
  files.push(fixedVirtualWindowFile);
  return files;
}

async function main(): Promise<void> {
  const declaredDependencyNames = await loadDeclaredDependencyNames();
  const files = await collectScanTargets();

  const violations: DependencyViolation[] = [];
  for (const filePath of files) {
    const content = await Bun.file(filePath).text();
    violations.push(...findDependencyViolations(content, filePath, declaredDependencyNames));
  }

  if (violations.length === 0) {
    process.stdout.write(
      `check-virtual-list-dependency-free — OK (${files.length} files, no @tanstack/virtual-core ` +
        'or undeclared bare imports).\n',
    );
    return;
  }

  process.stderr.write(
    'check-virtual-list-dependency-free — forbidden imports detected.\n' +
      'packages/components/src/components/virtual-list/** and fixed-virtual-window.ts must never ' +
      'import `@tanstack/virtual-core`, and every other bare import must already be declared in ' +
      "packages/components/package.json's `dependencies`. Use a relative import, or add the " +
      'package to `dependencies` if this is a deliberate, reviewed addition.\n\n',
  );
  for (const violation of violations) {
    process.stderr.write(
      `  ${violation.filePath}:${violation.lineNumber}\n` +
        `    ${violation.line}\n` +
        `    "${violation.specifier}" — ${violation.reason}\n`,
    );
  }
  process.exit(1);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error('check-virtual-list-dependency-free failed:', error);
    process.exit(1);
  });
}
