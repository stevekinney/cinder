/**
 * CIN-522: closes two escape hatches left open in `check-virtual-list-dependency-free.ts`.
 *
 * `_internal/dependency-free.test.ts` already exercises `classifySpecifier`,
 * `packageNameFromSpecifier`, and `findDependencyViolations`'s original,
 * single-file behavior end to end — this file does not repeat that coverage.
 * It exercises only what CIN-522 added:
 *
 *   1. `walkDependencyGraph` — following a literal relative import to whatever
 *      file it resolves to, transitively, instead of trusting a relative
 *      specifier just because it is relative. Fixture trees live under a
 *      temporary directory (same `mkdtempSync` pattern the companion test uses
 *      for `loadDeclaredDependencyNames`) so a hop can genuinely land OUTSIDE
 *      the file that wrote it, the way a real escape would.
 *   2. `resolveRelativeSpecifier` — the resolution `walkDependencyGraph` uses to
 *      turn a written specifier into a file on disk.
 *   3. `import x = require('pkg')` — the TypeScript-only import-equals form,
 *      tested through `findDependencyViolations` directly, the same way the
 *      companion file tests plain `require('pkg')`.
 *   4. `findDependencyViolations`'s new `treatAsTestFile` override, which
 *      `walkDependencyGraph` uses to classify a transitively-reached file by
 *      how the import graph actually reaches it rather than by its own
 *      filename alone.
 */

import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  FORBIDDEN_SPECIFIER,
  collectScanTargets,
  findDependencyViolations,
  loadDeclaredDependencyNames,
  resolveRelativeSpecifier,
  walkDependencyGraph,
} from './check-virtual-list-dependency-free.ts';

/**
 * Materializes `files` (relative path → content) under a fresh temporary
 * directory, runs `assert` against that directory's root, and always cleans up
 * afterward — mirrors `_internal/dependency-free.test.ts`'s
 * `withTemporaryManifest` helper, generalized to more than one file so a fixture
 * tree can express a real relative-import hop between two files on disk.
 */
async function withTemporaryFileTree(
  files: Readonly<Record<string, string>>,
  assert: (root: string) => Promise<void>,
): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), 'check-virtual-list-dependency-free-'));
  try {
    for (const [relativePath, content] of Object.entries(files)) {
      const filePath = join(root, relativePath);
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, content);
    }
    await assert(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('resolveRelativeSpecifier', () => {
  test('resolves a specifier that already names an existing file exactly', async () => {
    await withTemporaryFileTree({ 'entry.ts': '', 'sibling.css': '' }, async (root) => {
      const resolved = resolveRelativeSpecifier('./sibling.css', join(root, 'entry.ts'));
      expect(resolved).toBe(join(root, 'sibling.css'));
    });
  });

  test('resolves an extensionless specifier by appending .ts', async () => {
    await withTemporaryFileTree({ 'entry.ts': '', 'sibling.ts': '' }, async (root) => {
      const resolved = resolveRelativeSpecifier('./sibling', join(root, 'entry.ts'));
      expect(resolved).toBe(join(root, 'sibling.ts'));
    });
  });

  test('resolves an extensionless specifier by appending .svelte', async () => {
    await withTemporaryFileTree({ 'entry.ts': '', 'widget.svelte': '' }, async (root) => {
      const resolved = resolveRelativeSpecifier('./widget', join(root, 'entry.ts'));
      expect(resolved).toBe(join(root, 'widget.svelte'));
    });
  });

  test('resolves a directory specifier to the index.ts inside it', async () => {
    await withTemporaryFileTree({ 'entry.ts': '', 'folder/index.ts': '' }, async (root) => {
      const resolved = resolveRelativeSpecifier('./folder', join(root, 'entry.ts'));
      expect(resolved).toBe(join(root, 'folder', 'index.ts'));
    });
  });

  test('returns undefined for a specifier that resolves to nothing on disk', async () => {
    await withTemporaryFileTree({ 'entry.ts': '' }, async (root) => {
      expect(resolveRelativeSpecifier('./nowhere', join(root, 'entry.ts'))).toBeUndefined();
    });
  });

  test('returns undefined for a specifier naming an existing directory with no index file of its own', async () => {
    // "folder" is real on disk, but only as a directory — existsSync alone would
    // treat that as resolved, which is why resolveRelativeSpecifier also requires
    // statSync(...).isFile().
    await withTemporaryFileTree({ 'entry.ts': '', 'folder/leaf.ts': '' }, async (root) => {
      expect(resolveRelativeSpecifier('./folder', join(root, 'entry.ts'))).toBeUndefined();
    });
  });
});

describe('findDependencyViolations — import x = require(...) (CIN-522)', () => {
  test('flags an import-equals require of the forbidden package in shipped source', () => {
    const source = `import virtualizer = require('${FORBIDDEN_SPECIFIER}');`;
    const violations = findDependencyViolations(source, 'virtual-list.ts', new Set());

    expect(violations).toHaveLength(1);
    expect(violations[0]?.specifier).toBe(FORBIDDEN_SPECIFIER);
    expect(violations[0]?.reason).toEqual(expect.stringContaining('@tanstack/virtual-core'));
  });

  test('flags an import-equals require of an undeclared package in shipped source', () => {
    const source = "import helper = require('some-dev-only-package');";
    const violations = findDependencyViolations(source, 'virtual-list.ts', new Set());

    expect(violations).toHaveLength(1);
    expect(violations[0]?.specifier).toBe('some-dev-only-package');
  });

  test('allows an import-equals require of a devDependency in a TEST file', () => {
    // Mirrors the existing exemption for a plain static `import { render } from
    // '@testing-library/svelte'` in a test file — nothing in a test file ships.
    const source = "import testing = require('@testing-library/svelte');";
    expect(findDependencyViolations(source, 'virtual-list.test.ts', new Set())).toEqual([]);
  });

  test('still bans the forbidden package via import-equals require in a TEST file', () => {
    const source = `import virtualizer = require('${FORBIDDEN_SPECIFIER}');`;
    const violations = findDependencyViolations(source, 'virtual-list.test.ts', new Set());

    expect(violations).toHaveLength(1);
    expect(violations[0]?.specifier).toBe(FORBIDDEN_SPECIFIER);
  });

  test('does not flag an import-equals ALIAS of an internal namespace, only the external module form', () => {
    // `import Bar = Foo` is also an ImportEqualsDeclaration, but its
    // moduleReference is an EntityName, not an ExternalModuleReference — it
    // aliases a local namespace, not a package, and loads nothing.
    const source = 'namespace Foo {\n  export const value = 1;\n}\nimport Bar = Foo;';
    expect(findDependencyViolations(source, 'virtual-list.ts', new Set())).toEqual([]);
  });
});

describe('findDependencyViolations — treatAsTestFile override (CIN-522)', () => {
  test('treatAsTestFile: true exempts an undeclared bare import even though the filename does not match TEST_FILE_PATTERN', () => {
    const source = "import leftPad from 'left-pad';";
    const violations = findDependencyViolations(source, 'happy-dom.ts', new Set(), {
      treatAsTestFile: true,
    });
    expect(violations).toEqual([]);
  });

  test('treatAsTestFile: false applies the full rule even though the filename matches TEST_FILE_PATTERN', () => {
    const source = "import leftPad from 'left-pad';";
    const violations = findDependencyViolations(source, 'virtual-list.test.ts', new Set(), {
      treatAsTestFile: false,
    });
    expect(violations).toHaveLength(1);
    expect(violations[0]?.specifier).toBe('left-pad');
  });

  test('omitting the fourth argument entirely behaves exactly like the original three-argument call', () => {
    const source = "import leftPad from 'left-pad';";
    expect(findDependencyViolations(source, 'virtual-list.test.ts', new Set())).toEqual([]);
    expect(findDependencyViolations(source, 'virtual-list.ts', new Set())).toHaveLength(1);
  });
});

describe('walkDependencyGraph — transitive relative import following (CIN-522)', () => {
  test('flags an undeclared bare import reached through a relative hop from a production (non-test) root', async () => {
    await withTemporaryFileTree(
      {
        'entry.ts': "import { helper } from './hop/target.ts';\nexport { helper };\n",
        'hop/target.ts': "import leftPad from 'left-pad';\nexport const helper = leftPad;\n",
      },
      async (root) => {
        const result = await walkDependencyGraph([join(root, 'entry.ts')], new Set());

        expect(result.scannedFilePaths).toContain(join(root, 'hop', 'target.ts'));
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]?.filePath).toBe(join(root, 'hop', 'target.ts'));
        expect(result.violations[0]?.specifier).toBe('left-pad');
      },
    );
  });

  test('does not flag an undeclared bare import reached ONLY through a relative hop from a test root', async () => {
    // The real-world shape this pins: src/components/virtual-list/virtual-list.test.ts
    // relatively imports src/test/happy-dom.ts, which bare-imports the devDependency
    // "happy-dom" and is excluded from package.json's "files" allowlist, so it never
    // ships. Reaching it transitively must not turn that into a false violation.
    await withTemporaryFileTree(
      {
        'entry.test.ts': "import { setup } from './hop/test-helper.ts';\nsetup();\nexport {};\n",
        'hop/test-helper.ts':
          "import leftPad from 'left-pad';\nexport function setup(): void {\n  void leftPad;\n}\n",
      },
      async (root) => {
        const result = await walkDependencyGraph([join(root, 'entry.test.ts')], new Set());

        expect(result.scannedFilePaths).toContain(join(root, 'hop', 'test-helper.ts'));
        expect(result.violations).toEqual([]);
      },
    );
  });

  test('flags the forbidden package reached through a relative hop from a production (non-test) root', async () => {
    await withTemporaryFileTree(
      {
        'entry.ts': "import { helper } from './hop/target.ts';\nexport { helper };\n",
        'hop/target.ts': `import { createVirtualizer } from '${FORBIDDEN_SPECIFIER}';\nexport const helper = createVirtualizer;\n`,
      },
      async (root) => {
        // Declared as a dependency here on purpose: the forbidden-package ban is
        // absolute and must not be waved through just because it happens to be
        // declared elsewhere in this hypothetical package.json.
        const declared = new Set([FORBIDDEN_SPECIFIER]);
        const result = await walkDependencyGraph([join(root, 'entry.ts')], declared);

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]?.specifier).toBe(FORBIDDEN_SPECIFIER);
      },
    );
  });

  test('still flags the forbidden package reached through a relative hop from a test root', async () => {
    await withTemporaryFileTree(
      {
        'entry.test.ts': "import { setup } from './hop/test-helper.ts';\nsetup();\nexport {};\n",
        'hop/test-helper.ts': `import { createVirtualizer } from '${FORBIDDEN_SPECIFIER}';\nexport function setup(): void {\n  void createVirtualizer;\n}\n`,
      },
      async (root) => {
        const result = await walkDependencyGraph([join(root, 'entry.test.ts')], new Set());

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]?.specifier).toBe(FORBIDDEN_SPECIFIER);
      },
    );
  });

  test('reports a relative import that does not resolve to a file on disk, instead of throwing', async () => {
    await withTemporaryFileTree(
      { 'entry.ts': "import { missing } from './does-not-exist.ts';\nexport { missing };\n" },
      async (root) => {
        const result = await walkDependencyGraph([join(root, 'entry.ts')], new Set());

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]?.specifier).toBe('./does-not-exist.ts');
        expect(result.violations[0]?.reason).toEqual(expect.stringContaining('does not resolve'));
      },
    );
  });

  test('terminates on a two-file import cycle instead of looping forever', async () => {
    await withTemporaryFileTree(
      {
        'a.ts': "import './b.ts';\nexport const a = 1;\n",
        'b.ts': "import './a.ts';\nexport const b = 2;\n",
      },
      async (root) => {
        const result = await walkDependencyGraph([join(root, 'a.ts')], new Set());

        expect(result.scannedFilePaths.slice().sort()).toEqual(
          [join(root, 'a.ts'), join(root, 'b.ts')].sort(),
        );
        expect(result.violations).toEqual([]);
      },
    );
  });

  test('classifies a file reachable from BOTH a production root and a test root as shipped', async () => {
    // Pass 1 (production roots) runs to exhaustion before pass 2 (test roots)
    // starts, so shared.ts is claimed — and classified strictly — before
    // test-entry.test.ts's own edge to it is ever considered.
    await withTemporaryFileTree(
      {
        'production-entry.ts': "import { shared } from './shared.ts';\nexport { shared };\n",
        'test-entry.test.ts': "import { shared } from './shared.ts';\nvoid shared;\nexport {};\n",
        'shared.ts': "import leftPad from 'left-pad';\nexport const shared = leftPad;\n",
      },
      async (root) => {
        const roots = [join(root, 'production-entry.ts'), join(root, 'test-entry.test.ts')];
        const result = await walkDependencyGraph(roots, new Set());

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]?.filePath).toBe(join(root, 'shared.ts'));
        expect(result.violations[0]?.specifier).toBe('left-pad');
      },
    );
  });

  test('resolves an extensionless relative hop end to end through the walker', async () => {
    await withTemporaryFileTree(
      {
        'entry.ts': "import { helper } from './hop/target';\nexport { helper };\n",
        'hop/target.ts': "import leftPad from 'left-pad';\nexport const helper = leftPad;\n",
      },
      async (root) => {
        const result = await walkDependencyGraph([join(root, 'entry.ts')], new Set());

        expect(result.scannedFilePaths).toContain(join(root, 'hop', 'target.ts'));
        expect(result.violations).toHaveLength(1);
      },
    );
  });
});

describe('walkDependencyGraph — real virtual-list tree (CIN-522)', () => {
  test('walking from the real collectScanTargets() finds no violations', async () => {
    const declaredDependencyNames = await loadDeclaredDependencyNames();
    const rootFilePaths = await collectScanTargets();
    const result = await walkDependencyGraph(rootFilePaths, declaredDependencyNames);

    expect(result.violations).toEqual([]);
    // Proves the walk actually expanded past the original root set — an empty
    // violations list alone can't distinguish a real transitive walk from one
    // that never left the roots.
    expect(result.scannedFilePaths.length).toBeGreaterThan(rootFilePaths.length);
  });

  test('reaches the real src/test/happy-dom.ts transitively, yet does not flag its "happy-dom" import', async () => {
    const declaredDependencyNames = await loadDeclaredDependencyNames();
    const rootFilePaths = await collectScanTargets();
    const result = await walkDependencyGraph(rootFilePaths, declaredDependencyNames);

    const happyDomFilePath = result.scannedFilePaths.find((filePath) =>
      filePath.endsWith(join('test', 'happy-dom.ts')),
    );
    expect(happyDomFilePath).toBeDefined();
    expect(result.violations.some((violation) => violation.filePath === happyDomFilePath)).toBe(
      false,
    );
  });
});

describe('the guard follows JavaScript helpers, not only TypeScript ones', () => {
  test('reports a forbidden import reached through a relative .js helper', async () => {
    // The hole this closes. Bun bundles a relative `.js` helper exactly like a `.ts`
    // one, so accepting it as resolved and then declining to scan it meant the helper
    // could import anything at all and the guard would still report a clean tree.
    await withTemporaryFileTree(
      {
        'engine.ts': "import './helper.js';\n",
        'helper.js': "import '@tanstack/virtual-core';\n",
      },
      async (root) => {
        const result = await walkDependencyGraph([join(root, 'engine.ts')], new Set());
        expect(result.violations.map((violation) => violation.specifier)).toContain(
          '@tanstack/virtual-core',
        );
        // Named against the file that actually holds it, not the entry point.
        expect(
          result.violations.some((violation) => violation.filePath.endsWith('helper.js')),
        ).toBe(true);
      },
    );
  });

  test('follows .mjs and .cjs helpers too', async () => {
    for (const extension of ['mjs', 'cjs']) {
      await withTemporaryFileTree(
        {
          'engine.ts': `import './helper.${extension}';\n`,
          [`helper.${extension}`]: "import 'undeclared-package';\n",
        },
        async (root) => {
          const result = await walkDependencyGraph([join(root, 'engine.ts')], new Set());
          expect(result.violations.map((violation) => violation.specifier)).toContain(
            'undeclared-package',
          );
        },
      );
    }
  });

  test('scans a JavaScript helper rather than merely resolving it', async () => {
    // The distinction that mattered: resolution already worked, so a test asserting
    // only that the import resolved would have passed against the hole.
    await withTemporaryFileTree(
      {
        'engine.ts': "import './helper.js';\n",
        'helper.js': '',
      },
      async (root) => {
        const result = await walkDependencyGraph([join(root, 'engine.ts')], new Set());
        expect(result.scannedFilePaths.some((path) => path.endsWith('helper.js'))).toBe(true);
      },
    );
  });
});

describe('resolveRelativeSpecifier — unreadable candidates', () => {
  test('reports an unresolved import rather than crashing the guard', async () => {
    // `statSync` can throw even when `existsSync` has just said yes — a permission
    // error, or the path disappearing between the two calls. A guard that crashes
    // reports nothing at all, which is worse than reporting the import as unresolved.
    await withTemporaryFileTree({ 'entry.ts': '' }, async (root) => {
      expect(() =>
        resolveRelativeSpecifier('./nothing-here', join(root, 'entry.ts')),
      ).not.toThrow();
      expect(resolveRelativeSpecifier('./nothing-here', join(root, 'entry.ts'))).toBeUndefined();
    });
  });
});
