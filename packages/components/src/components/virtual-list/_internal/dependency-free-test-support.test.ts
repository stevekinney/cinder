import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { walkDependencyGraph } from '../../../../scripts/check-virtual-list-dependency-free-graph.ts';
import { FORBIDDEN_SPECIFIER } from '../../../../scripts/check-virtual-list-dependency-free-policy.ts';
import { withTemporaryFileTree } from '../../../../scripts/check-virtual-list-dependency-free-test-utilities.ts';

describe('virtual-list dependency guard test-support ownership', () => {
  test.each(['helpers', 'fixtures', 'utilities'])(
    'allows development dependencies in test-only %s collected as roots',
    async (kind) => {
      const helper = `setup-test-${kind}.ts`;
      await withTemporaryFileTree(
        {
          'entry.test.ts': `import './${helper}';`,
          [helper]: "import '@lostgradient/testing';",
        },
        async (root) => {
          const roots = [join(root, helper), join(root, 'entry.test.ts')];
          const result = await walkDependencyGraph(roots, new Set());
          expect(result.scannedFilePaths.toSorted()).toEqual(roots.toSorted());
          expect(result.violations).toEqual([]);
        },
      );
    },
  );

  test('applies runtime dependency rules when production imports a test helper', async () => {
    await withTemporaryFileTree(
      {
        'entry.test.ts': "import './setup-test-helpers.ts';",
        'entry.ts': "import './setup-test-helpers.ts';",
        'setup-test-helpers.ts': "import '@lostgradient/testing';",
      },
      async (root) => {
        const roots = ['entry.test.ts', 'setup-test-helpers.ts', 'entry.ts'].map((file) =>
          join(root, file),
        );
        const result = await walkDependencyGraph(roots, new Set());
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]?.filePath).toBe(join(root, 'setup-test-helpers.ts'));
        expect(result.violations[0]?.specifier).toBe('@lostgradient/testing');
      },
    );
  });

  test('keeps the forbidden dependency ban for an unreferenced test helper', async () => {
    await withTemporaryFileTree(
      { 'setup-test-helpers.ts': `import '${FORBIDDEN_SPECIFIER}';` },
      async (root) => {
        const result = await walkDependencyGraph(
          [join(root, 'setup-test-helpers.ts')],
          new Set([FORBIDDEN_SPECIFIER]),
        );
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]?.specifier).toBe(FORBIDDEN_SPECIFIER);
      },
    );
  });

  test('keeps runtime dependency rules for an unreferenced production module', async () => {
    await withTemporaryFileTree(
      { 'utility.ts': "import '@lostgradient/testing';" },
      async (root) => {
        const result = await walkDependencyGraph([join(root, 'utility.ts')], new Set());
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]?.specifier).toBe('@lostgradient/testing');
      },
    );
  });
});
