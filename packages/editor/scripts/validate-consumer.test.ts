import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { PackageManifest } from './pack-for-publish.ts';
import {
  assertImportClosure,
  extractSvelteScriptBlocks,
  isPlausibleImportSpecifier,
} from './validate-consumer.ts';

/**
 * `assertImportClosure` scans `dist/**` for bare import specifiers not
 * declared as a runtime peer or dependency. Before cinder#1334, that scan
 * used a text regex (`/(?:\bfrom\s*|\bimport\s*\()\s*['"]([^'"]+)['"]/`)
 * that matched the literal word "from" followed by a quote character
 * anywhere in the file -- including inside a preserved doc comment, which
 * has no syntactic relationship to a real `import ... from '...'`
 * statement. A prose comment containing "from" followed by a scare-quote
 * or contraction was captured as if it were an import specifier, and
 * cinder#1330's AST-provenance rewrite added exactly that kind of
 * prose-heavy comment to `source-line-map.ts` and `front-matter-fields.svelte`,
 * which broke the real release workflow (blocked npm publish until fixed).
 *
 * These tests exercise the real function against real files on disk (a
 * temp fixture, not a reimplementation of its logic), covering both
 * directions: comment prose must never trigger a violation, and a genuine
 * undeclared import must still be caught. A validator that can't fail is
 * worse than no validator -- the second half is the point.
 */
describe('assertImportClosure (cinder#1334)', () => {
  const tempRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
    );
  });

  async function makeFixture(files: Record<string, string>): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), 'validate-consumer-test-'));
    tempRoots.push(root);
    for (const [relativePath, content] of Object.entries(files)) {
      const fullPath = join(root, relativePath);
      await mkdir(join(fullPath, '..'), { recursive: true });
      await Bun.write(fullPath, content);
    }
    return root;
  }

  const manifestWithDeclaredPeers: PackageManifest = {
    name: '@lostgradient/editor',
    version: '0.0.0-test',
    dependencies: {},
    peerDependencies: {
      svelte: '>=5.56.0 <6',
      '@lostgradient/cinder': '^0.24.0',
    },
    exports: {},
  };

  test('comment prose containing "from" followed by a quote is not mistaken for an import specifier (the exact cinder#1334 repro shape)', async () => {
    const root = await makeFixture({
      'dist/prose.js': `/**
 * Reading data from 'a source you don't fully control' is riskier than it
 * looks -- this comment exists only to contain the word "from" immediately
 * followed by a quote character, the exact text shape that broke the old
 * regex-based scanner (cinder#1334).
 */
export const value = 1;
`,
    });

    await expect(assertImportClosure(manifestWithDeclaredPeers, root)).resolves.toBeUndefined();
  });

  test('a real, undeclared bare import in a .js file is still caught (the validator can still fail)', async () => {
    const root = await makeFixture({
      'dist/undeclared.js': `import { danger } from 'totally-undeclared-package';\nexport const value = danger;\n`,
    });

    await expect(assertImportClosure(manifestWithDeclaredPeers, root)).rejects.toThrow(
      /totally-undeclared-package/u,
    );
  });

  test('a real, declared peer import in a .js file does not trigger a violation', async () => {
    const root = await makeFixture({
      'dist/declared.js': `import { onMount } from 'svelte';\nexport const value = onMount;\n`,
    });

    await expect(assertImportClosure(manifestWithDeclaredPeers, root)).resolves.toBeUndefined();
  });

  test('relative and node: imports are never flagged, real or in comments', async () => {
    const root = await makeFixture({
      'dist/relative.js': `import { helper } from './local-helper.js';\nimport { readFile } from 'node:fs';\nexport const value = [helper, readFile];\n`,
    });

    await expect(assertImportClosure(manifestWithDeclaredPeers, root)).resolves.toBeUndefined();
  });

  test('.svelte files: comment prose in a <script> block is not mistaken for an import, but a real undeclared import in the same block still is', async () => {
    const proseOnly = await makeFixture({
      'dist/component.svelte': `<script lang="ts" module>
  /**
   * Fixed by falling back to the parsed raw text whenever data is null but
   * raw is non-null, rather than assuming there's nothing there -- see the
   * discussion of why "from" a comment like this one can't be told apart
   * from a real import statement by a text regex.
   */
  export const label = 'front matter';
</script>

<section>{label}</section>
`,
    });
    await expect(
      assertImportClosure(manifestWithDeclaredPeers, proseOnly),
    ).resolves.toBeUndefined();

    const realUndeclared = await makeFixture({
      'dist/component.svelte': `<script lang="ts">
  import { danger } from 'totally-undeclared-package';
</script>

<section>{danger}</section>
`,
    });
    await expect(assertImportClosure(manifestWithDeclaredPeers, realUndeclared)).rejects.toThrow(
      /totally-undeclared-package/u,
    );
  });

  test('.svelte files: markup and <style> content outside <script> is never scanned at all', async () => {
    const root = await makeFixture({
      'dist/component.svelte': `<script lang="ts">
  export const label = 'ok';
</script>

<p>Import your data from 'wherever you like' -- this is markup text, not a script.</p>

<style>
  /* @import "some-undeclared-package/styles.css" would be flagged if this
     were a real CSS @import, but it's inside a <style> block, outside any
     <script> tag, and never reaches extractSvelteScriptBlocks at all. */
  p { color: red; }
</style>
`,
    });

    await expect(assertImportClosure(manifestWithDeclaredPeers, root)).resolves.toBeUndefined();
  });

  test('.css files: @import inside a comment is rejected by the whitespace-shape guard, but a real @import to an undeclared package is still caught', async () => {
    const proseOnly = await makeFixture({
      'dist/styles.css': `/* See @import "prose that happens to look like a specifier" for context. */\n.foo { color: red; }\n`,
    });
    await expect(
      assertImportClosure(manifestWithDeclaredPeers, proseOnly),
    ).resolves.toBeUndefined();

    const realUndeclared = await makeFixture({
      'dist/styles.css': `@import "totally-undeclared-package/styles.css";\n.foo { color: red; }\n`,
    });
    await expect(assertImportClosure(manifestWithDeclaredPeers, realUndeclared)).rejects.toThrow(
      /totally-undeclared-package/u,
    );
  });
});

describe('extractSvelteScriptBlocks', () => {
  test('extracts a single instance script block', () => {
    const source = `<script lang="ts">\n  const x = 1;\n</script>\n\n<p>hi</p>\n`;
    expect(extractSvelteScriptBlocks(source)).toEqual(['\n  const x = 1;\n']);
  });

  test('extracts both a module block and an instance block, in document order', () => {
    const source = `<script lang="ts" module>\n  export const shared = 1;\n</script>\n\n<script lang="ts">\n  const local = 2;\n</script>\n`;
    expect(extractSvelteScriptBlocks(source)).toEqual([
      '\n  export const shared = 1;\n',
      '\n  const local = 2;\n',
    ]);
  });

  test('returns an empty array when there is no <script> block', () => {
    expect(extractSvelteScriptBlocks('<p>no script here</p>')).toEqual([]);
  });
});

describe('isPlausibleImportSpecifier', () => {
  test('accepts a real-looking specifier', () => {
    expect(isPlausibleImportSpecifier('@lostgradient/cinder/styles')).toBe(true);
    expect(isPlausibleImportSpecifier('svelte')).toBe(true);
  });

  test('rejects text containing whitespace -- no real specifier can contain a space', () => {
    expect(isPlausibleImportSpecifier('prose that looks like a specifier')).toBe(false);
    expect(isPlausibleImportSpecifier('a\nmultiline\ncapture')).toBe(false);
  });

  test('rejects an empty string', () => {
    expect(isPlausibleImportSpecifier('')).toBe(false);
  });
});
