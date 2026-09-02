/**
 * Companion regression for CIN-204's `check-virtual-list-dependency-free.ts`.
 *
 * Two things are tested here, deliberately kept separate:
 *
 *   1. An INDEPENDENT scan of the real virtual-list source tree, written from
 *      scratch in this file rather than by calling into the script's own
 *      parsing logic — a bug shared between the script's regex and this
 *      test's regex could otherwise hide a real `@tanstack/virtual-core`
 *      regression from both. This is the check that makes a local `bun test`
 *      run (no CI needed) catch the violation the script exists to prevent.
 *   2. Direct, fabricated-input unit tests against the script's own exported
 *      functions (`classifySpecifier`, `packageNameFromSpecifier`,
 *      `findDependencyViolations`), so the script's failure path — flagging
 *      an offending specifier — is exercised, not just its passing path
 *      against an already-clean tree.
 */

import { Glob } from 'bun';
import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FORBIDDEN_SPECIFIER,
  classifySpecifier,
  collectScanTargets,
  findDependencyViolations,
  loadDeclaredDependencyNames,
  packageNameFromSpecifier,
} from '../../../../scripts/check-virtual-list-dependency-free.ts';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(testDirectory, '..', '..', '..', '..');
const virtualListRoot = join(packageRoot, 'src', 'components', 'virtual-list');
const fixedVirtualWindowFile = join(packageRoot, 'src', 'utilities', 'fixed-virtual-window.ts');
const packageJsonPath = join(packageRoot, 'package.json');

/** This file's own absolute path, resolved the same way `collectScanTargets`
 * resolves every other candidate — used only to exclude it below. */
const thisTestFilePath = fileURLToPath(import.meta.url);

/**
 * Independently reproduces the ONE part of CIN-204 that matters most to catch
 * without CI: does any real source file under `virtual-list/**` or
 * `fixed-virtual-window.ts` contain the literal forbidden specifier text?
 * This is a plain substring search, not a shared regex with the script.
 *
 * Excludes THIS file: it deliberately embeds `FORBIDDEN_SPECIFIER` as inert
 * fabricated fixture text a few tests below, so a naive substring scan would
 * otherwise flag its own test fixtures as if they were real imports — the
 * same self-reference the script itself guards against via
 * `SELF_TEST_RELATIVE_PATH`, reproduced independently here rather than by
 * importing that constant.
 */
async function collectFilesReferencingForbiddenSpecifier(): Promise<string[]> {
  const glob = new Glob('**/*.{ts,svelte}');
  const filePaths: string[] = [];
  for await (const relativePath of glob.scan({ cwd: virtualListRoot })) {
    filePaths.push(join(virtualListRoot, relativePath));
  }
  filePaths.push(fixedVirtualWindowFile);

  const offenders: string[] = [];
  for (const filePath of filePaths) {
    if (filePath === thisTestFilePath) continue;
    const content = await Bun.file(filePath).text();
    if (content.includes(FORBIDDEN_SPECIFIER)) offenders.push(filePath);
  }
  return offenders;
}

describe('virtual-list dependency-free guard — independent real-repo scan (CIN-204)', () => {
  test('no virtual-list source file references @tanstack/virtual-core', async () => {
    const offenders = await collectFilesReferencingForbiddenSpecifier();
    expect(offenders).toEqual([]);
  });
});

describe('virtual-list dependency-free guard — production scan against the real dependencies list', () => {
  test('findDependencyViolations reports nothing for the current virtual-list tree', async () => {
    const declaredDependencyNames = await loadDeclaredDependencyNames(packageJsonPath);
    const files = await collectScanTargets();
    expect(files.length).toBeGreaterThan(0);

    const violations = [];
    for (const filePath of files) {
      const content = await Bun.file(filePath).text();
      violations.push(...findDependencyViolations(content, filePath, declaredDependencyNames));
    }

    expect(violations).toEqual([]);
  });
});

describe('virtual-list dependency-free guard — classifySpecifier', () => {
  const declared = new Set(['@lostgradient/markdown', 'culori']);

  test('forbids @tanstack/virtual-core outright, even if it were declared as a dependency', () => {
    const declaredWithForbidden = new Set([...declared, FORBIDDEN_SPECIFIER]);
    expect(classifySpecifier(FORBIDDEN_SPECIFIER, declaredWithForbidden)).toBeDefined();
  });

  test('allows relative specifiers', () => {
    expect(classifySpecifier('./sibling.ts', declared)).toBeUndefined();
    expect(classifySpecifier('../../utilities/fixed-virtual-window.ts', declared)).toBeUndefined();
    expect(classifySpecifier('/absolute/path.ts', declared)).toBeUndefined();
  });

  test('allows "svelte" and "svelte/*" subpaths', () => {
    expect(classifySpecifier('svelte', declared)).toBeUndefined();
    expect(classifySpecifier('svelte/elements', declared)).toBeUndefined();
  });

  test('allows Node and Bun builtins', () => {
    expect(classifySpecifier('node:path', declared)).toBeUndefined();
    expect(classifySpecifier('path', declared)).toBeUndefined();
    expect(classifySpecifier('bun:test', declared)).toBeUndefined();
  });

  test('allows a bare specifier already declared in dependencies', () => {
    expect(classifySpecifier('culori', declared)).toBeUndefined();
  });

  test('allows a declared scoped dependency reached through a deep subpath', () => {
    expect(classifySpecifier('@lostgradient/markdown/dist/foo.js', declared)).toBeUndefined();
  });

  test('rejects an undeclared bare specifier, naming it in the reason', () => {
    const reason = classifySpecifier('left-pad', declared);
    expect(reason).toBeDefined();
    expect(reason).toEqual(expect.stringContaining('left-pad'));
  });

  test('rejects an undeclared scoped specifier, reporting the resolved package name', () => {
    const reason = classifySpecifier('@some-scope/some-package/deep/path.js', declared);
    expect(reason).toEqual(expect.stringContaining('@some-scope/some-package'));
  });
});

describe('virtual-list dependency-free guard — packageNameFromSpecifier', () => {
  test('resolves an unscoped specifier to its first path segment', () => {
    expect(packageNameFromSpecifier('lodash/debounce')).toBe('lodash');
    expect(packageNameFromSpecifier('lodash')).toBe('lodash');
  });

  test('resolves a scoped specifier to scope + name, dropping any deeper subpath', () => {
    expect(packageNameFromSpecifier('@scope/name/deep/path.js')).toBe('@scope/name');
    expect(packageNameFromSpecifier('@scope/name')).toBe('@scope/name');
  });

  test('falls back to the raw specifier for a malformed scoped specifier with no name segment', () => {
    expect(packageNameFromSpecifier('@scope')).toBe('@scope');
  });
});

describe('virtual-list dependency-free guard — findDependencyViolations (fabricated input)', () => {
  test('flags a fabricated @tanstack/virtual-core import with file/line/specifier detail', () => {
    const source = [
      "import { tick } from 'svelte';",
      "import { createVirtualizer } from '@tanstack/virtual-core';",
    ].join('\n');

    const violations = findDependencyViolations(source, 'fake-virtual-list.svelte', new Set());

    expect(violations).toEqual([
      {
        filePath: 'fake-virtual-list.svelte',
        lineNumber: 2,
        specifier: FORBIDDEN_SPECIFIER,
        line: "import { createVirtualizer } from '@tanstack/virtual-core';",
        reason: expect.stringContaining('@tanstack/virtual-core'),
      },
    ]);
  });

  test('flags a fabricated undeclared bare specifier alongside an allowed relative import', () => {
    const source = [
      "import { classNames } from '../../utilities/class-names.ts';",
      "import leftPad from 'left-pad';",
    ].join('\n');

    const violations = findDependencyViolations(source, 'fake.ts', new Set());

    expect(violations).toHaveLength(1);
    expect(violations[0]?.specifier).toBe('left-pad');
    expect(violations[0]?.lineNumber).toBe(2);
  });

  test('does not flag an export-from re-export of an allowed relative specifier', () => {
    const source = "export type { VirtualListProps } from './virtual-list.types.ts';";
    expect(findDependencyViolations(source, 'fake.ts', new Set())).toEqual([]);
  });

  test('flags a MULTILINE dynamic import of an undeclared bare specifier in shipped source', () => {
    // A per-line scan misses every multiline form the language allows, which would
    // let shipped source import an undeclared package and still pass this guard.
    const source = ['const helper = await import(', "  'some-dev-only-package',", ');'].join('\n');
    const violations = findDependencyViolations(source, 'virtual-list.svelte', new Set());

    expect(violations).toHaveLength(1);
    expect(violations[0]?.specifier).toBe('some-dev-only-package');
    expect(violations[0]?.lineNumber).toBe(2);
  });

  test('flags a MULTILINE static import of the forbidden specifier', () => {
    const source = ['import { thing } from', `  '${FORBIDDEN_SPECIFIER}';`].join('\n');
    const violations = findDependencyViolations(source, 'virtual-list.svelte', new Set());

    expect(violations).toHaveLength(1);
    expect(violations[0]?.specifier).toBe(FORBIDDEN_SPECIFIER);
    expect(violations[0]?.lineNumber).toBe(2);
  });

  test('does not treat prose spanning two lines as an import specifier', () => {
    // Scanning the whole file at once means the specifier character class must
    // exclude newlines, or a comment containing the word "import" followed by an
    // unclosed quote swallows the next line and reports it as a bare import.
    const source = [
      '// left a stale',
      '// node with the old content" — bare import "left a stale',
      '// node still attached"',
    ].join('\n');

    expect(findDependencyViolations(source, 'virtual-list.test.ts', new Set())).toEqual([]);
  });

  test('flags a dynamic import of an undeclared bare specifier in SHIPPED source', () => {
    // A production file that dynamically imports an installed devDependency
    // resolves inside this repository and then fails for a published consumer.
    // Exempting dynamic syntax from the undeclared-import rule would leave
    // exactly that hole open, so shipped source faces the full rule.
    const source = "const helper = await import('some-dev-only-package');";
    const violations = findDependencyViolations(source, 'virtual-list.svelte', new Set());

    expect(violations).toHaveLength(1);
    expect(violations[0]?.specifier).toBe('some-dev-only-package');
  });

  test('allows a dynamic import of an undeclared bare specifier in a TEST file', () => {
    // Tests legitimately reach for devDependencies at module scope — the real
    // virtual-list.test.ts does `await import('@testing-library/svelte')` — and
    // nothing in a test file ships, so the undeclared-import risk does not apply.
    const source = "const testing = await import('@testing-library/svelte');";

    expect(findDependencyViolations(source, 'virtual-list.test.ts', new Set())).toEqual([]);
    expect(findDependencyViolations(source, 'measurement-window.spec.ts', new Set())).toEqual([]);
  });

  test('still flags the forbidden specifier dynamically imported from a TEST file', () => {
    // The devDependency exemption is scoped to the undeclared-import rule only.
    // The @tanstack/virtual-core ban applies everywhere in the subtree.
    const source = "const virtualizer = await import('@tanstack/virtual-core');";
    const violations = findDependencyViolations(source, 'virtual-list.test.ts', new Set());

    expect(violations).toHaveLength(1);
    expect(violations[0]?.specifier).toBe(FORBIDDEN_SPECIFIER);
  });

  test('flags a fabricated dynamic import() of the forbidden specifier', () => {
    const source = "const module = await import('@tanstack/virtual-core');";
    const violations = findDependencyViolations(source, 'fake.ts', new Set());
    expect(violations).toHaveLength(1);
    expect(violations[0]?.specifier).toBe(FORBIDDEN_SPECIFIER);
  });

  test('does not flag a dynamic import() of an allowed relative specifier', () => {
    const source = "const module = await import('./sibling.ts');";
    expect(findDependencyViolations(source, 'fake.ts', new Set())).toEqual([]);
  });

  test('flags multiple violations across multiple lines with correct line numbers', () => {
    const source = [
      "import { a } from 'left-pad';",
      "import { tick } from 'svelte';",
      "import { b } from '@tanstack/virtual-core';",
    ].join('\n');

    const violations = findDependencyViolations(source, 'fake.ts', new Set());
    expect(violations.map((violation) => violation.lineNumber)).toEqual([1, 3]);
  });

  test('returns no violations for an empty file', () => {
    expect(findDependencyViolations('', 'empty.ts', new Set())).toEqual([]);
  });

  test('returns no violations for a file with no import statements at all', () => {
    const source = 'export const answer = 42;\n';
    expect(findDependencyViolations(source, 'no-imports.ts', new Set())).toEqual([]);
  });
});

describe('virtual-list dependency-free guard — loadDeclaredDependencyNames', () => {
  async function withTemporaryManifest(
    manifest: unknown,
    assert: (manifestPath: string) => Promise<void>,
  ): Promise<void> {
    const root = mkdtempSync(join(tmpdir(), 'virtual-list-dependency-free-'));
    const manifestPath = join(root, 'package.json');
    writeFileSync(manifestPath, JSON.stringify(manifest));
    try {
      await assert(manifestPath);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  test('reads the dependencies field into a Set of package names', async () => {
    await withTemporaryManifest(
      { dependencies: { culori: '^4.0.2', qrcode: '^1.5.4' } },
      async (manifestPath) => {
        const names = await loadDeclaredDependencyNames(manifestPath);
        expect(names).toEqual(new Set(['culori', 'qrcode']));
      },
    );
  });

  test('falls back to an empty Set when dependencies is absent', async () => {
    await withTemporaryManifest({}, async (manifestPath) => {
      const names = await loadDeclaredDependencyNames(manifestPath);
      expect(names).toEqual(new Set());
    });
  });

  test('reads the real package.json dependencies and includes @tanstack/virtual-core', async () => {
    // Sanity check on the fixture itself: @tanstack/virtual-core IS a real
    // dependency of this package (tree/data-grid use it) — CIN-204 forbids it
    // for the virtual-list subtree specifically, not package-wide, so this
    // guard's ban comes from FORBIDDEN_SPECIFIER, not from an absent
    // dependencies entry.
    const names = await loadDeclaredDependencyNames(packageJsonPath);
    expect(names.has('@tanstack/virtual-core')).toBe(true);
  });

  test('rejects a subpath import of the forbidden package', () => {
    // packageNameFromSpecifier reduces a deep import to the package root, which IS
    // a declared dependency of this package — so an exact-match check alone waves
    // `@tanstack/virtual-core/some-entry` straight through the CIN-204 boundary.
    const declared = new Set([FORBIDDEN_SPECIFIER]);

    expect(classifySpecifier(FORBIDDEN_SPECIFIER, declared)).toBeDefined();
    expect(classifySpecifier(`${FORBIDDEN_SPECIFIER}/some-entry`, declared)).toBeDefined();
    expect(classifySpecifier(`${FORBIDDEN_SPECIFIER}/deep/nested`, declared)).toBeDefined();
  });

  test('does not reject a different package that merely shares the forbidden prefix', () => {
    // The subpath rule must match on a `/` boundary, not a bare prefix, or a
    // legitimately-declared neighbour gets caught by it.
    const declared = new Set([`${FORBIDDEN_SPECIFIER}-adapter`]);

    expect(classifySpecifier(`${FORBIDDEN_SPECIFIER}-adapter`, declared)).toBeUndefined();
  });
});
