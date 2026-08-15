import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import type { PackageManifest } from './pack-for-publish.ts';
import {
  assertImportClosure,
  extractSvelteScriptBlocks,
  extractSvelteStyleBlocks,
  isNodeBuiltinSpecifier,
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
      // `dirname()`, not `join(fullPath, '..')`: both happen to resolve to
      // the same parent directory here (`path.join`'s lexical normalization
      // cancels a trailing `/<segment>/..` regardless of whether `<segment>`
      // looks like a file or a directory name -- verified empirically, this
      // was never actually broken), but `dirname()` says what it means
      // instead of relying on a normalization side effect a reviewer has to
      // re-derive to trust (review finding, cinder#1335 round 2).
      await mkdir(dirname(fullPath), { recursive: true });
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

  test('.svelte files: markup outside <script> and <style> is never scanned at all', async () => {
    const root = await makeFixture({
      'dist/component.svelte': `<script lang="ts">
  export const label = 'ok';
</script>

<p>Import your data from 'wherever you like' -- this is markup text, not a script.</p>

<style>
  p { color: red; }
</style>
`,
    });

    await expect(assertImportClosure(manifestWithDeclaredPeers, root)).resolves.toBeUndefined();
  });

  test('.svelte files: a real @import in a <style> block is still caught -- not silently skipped (cinder#1335 round-2 finding)', async () => {
    // The first version of this fix (cinder#1334) only extracted and
    // scanned <script> blocks, then `continue`d for every .svelte file --
    // a component declaring an undeclared CSS dependency in its <style>
    // block passed the check silently. The original regex-based scanner
    // (despite its comment-prose bug) at least scanned the whole file, so
    // this was a real coverage regression, not a pre-existing gap.
    const root = await makeFixture({
      'dist/component.svelte': `<script lang="ts">
  export const label = 'ok';
</script>

<style>
  @import 'totally-undeclared-package/styles.css';
  p { color: red; }
</style>
`,
    });

    await expect(assertImportClosure(manifestWithDeclaredPeers, root)).rejects.toThrow(
      /totally-undeclared-package/u,
    );
  });

  test('.svelte files: @import inside a <style> block comment is not mistaken for a real import', async () => {
    const root = await makeFixture({
      'dist/component.svelte': `<script lang="ts">
  export const label = 'ok';
</script>

<style>
  /* @import "some prose that mentions an import" is not a real @import,
     because the capture below contains whitespace. */
  p { color: red; }
</style>
`,
    });

    await expect(assertImportClosure(manifestWithDeclaredPeers, root)).resolves.toBeUndefined();
  });

  test('.svelte files: a <script> tag with a generic constraint attribute containing ">" extracts and scans correctly (cinder#1335 round-2 finding)', async () => {
    // The original `<script\b[^>]*>` extraction stopped at the FIRST `>`,
    // wherever it fell -- including one inside a quoted attribute value,
    // like a real Svelte generics annotation
    // (`generics="T extends Array<string>"`). The malformed extracted
    // block then started mid-attribute-value, and Bun.Transpiler.scanImports
    // threw "Unterminated string literal" on it, failing the release
    // validator on legitimate Editor source, not just on a contrived case.
    const declaredImport = await makeFixture({
      'dist/generic.svelte': `<script lang="ts" generics="T extends Array<string>">
  import { onMount } from 'svelte';
  export let value: T;
  onMount(() => {});
</script>

<p>{value}</p>
`,
    });
    await expect(
      assertImportClosure(manifestWithDeclaredPeers, declaredImport),
    ).resolves.toBeUndefined();

    const undeclaredImport = await makeFixture({
      'dist/generic.svelte': `<script lang="ts" generics="T extends Array<string>">
  import { danger } from 'totally-undeclared-package';
  export let value: T;
</script>

<p>{value}</p>
`,
    });
    await expect(assertImportClosure(manifestWithDeclaredPeers, undeclaredImport)).rejects.toThrow(
      /totally-undeclared-package/u,
    );
  });

  test('a dynamic import() with a computed specifier still catches its static literal prefix (cinder#1335 round-2 finding)', async () => {
    // `Bun.Transpiler.scanImports` reports nothing for
    // `import('undeclared-package/' + feature)`, since the full specifier
    // isn't statically resolvable -- but the literal prefix is still real,
    // evident text, and the original regex-based scanner caught it
    // (accidentally, as part of matching every `import(` call). Losing
    // that was a real regression relative to the old behavior.
    const root = await makeFixture({
      'dist/dynamic.js': `const feature = getFeatureName();\nimport('totally-undeclared-package/' + feature);\n`,
    });

    await expect(assertImportClosure(manifestWithDeclaredPeers, root)).rejects.toThrow(
      /totally-undeclared-package/u,
    );
  });

  test('Node builtins loaded via require() or a bare specifier are not flagged as undeclared (cinder#1335 round-2 finding)', async () => {
    // scanImports reports require('fs') as a require-call with the bare
    // specifier "fs", not "node:fs" -- checking only for the "node:"
    // prefix (the original check) rejected every builtin loaded via its
    // un-prefixed name. The old regex never scanned require() calls at
    // all, so this false-positive surface didn't exist before this module
    // started using a real lexer that does.
    const root = await makeFixture({
      'dist/node-builtins.js': `const fs = require('fs');\nconst path = require('node:path');\nimport('fs');\nimport('node:child_process');\nexport const value = [fs, path];\n`,
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

  test('a ">" inside a quoted attribute value does not end the tag early (cinder#1335 round-2 finding)', () => {
    const source = `<script lang="ts" generics="T extends Array<string>">\n  export let value: T;\n</script>\n`;
    expect(extractSvelteScriptBlocks(source)).toEqual(['\n  export let value: T;\n']);
  });

  test('a "<" inside a quoted attribute value does not confuse the scan either', () => {
    const source = `<script lang="ts" title="a < b">\n  const x = 1;\n</script>\n`;
    expect(extractSvelteScriptBlocks(source)).toEqual(['\n  const x = 1;\n']);
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

describe('extractSvelteStyleBlocks', () => {
  test('extracts a single style block', () => {
    const source = `<script lang="ts">1</script>\n<style>\n  p { color: red; }\n</style>\n`;
    expect(extractSvelteStyleBlocks(source)).toEqual(['\n  p { color: red; }\n']);
  });

  test('a ">" inside a quoted attribute on <style> does not end the tag early', () => {
    const source = `<style data-note="a > b">\n  p { color: red; }\n</style>\n`;
    expect(extractSvelteStyleBlocks(source)).toEqual(['\n  p { color: red; }\n']);
  });

  test('returns an empty array when there is no <style> block', () => {
    expect(extractSvelteStyleBlocks('<script>1</script>\n<p>no style here</p>')).toEqual([]);
  });
});

describe('isNodeBuiltinSpecifier', () => {
  test('accepts a bare builtin name', () => {
    expect(isNodeBuiltinSpecifier('fs')).toBe(true);
    expect(isNodeBuiltinSpecifier('path')).toBe(true);
  });

  test('accepts a node:-prefixed builtin name', () => {
    expect(isNodeBuiltinSpecifier('node:fs')).toBe(true);
    expect(isNodeBuiltinSpecifier('node:path')).toBe(true);
  });

  test('accepts a subpath of a builtin, prefixed or bare', () => {
    expect(isNodeBuiltinSpecifier('node:fs/promises')).toBe(true);
    expect(isNodeBuiltinSpecifier('fs/promises')).toBe(true);
  });

  test('rejects a real (non-builtin) package name, even one that looks path-like', () => {
    expect(isNodeBuiltinSpecifier('svelte')).toBe(false);
    expect(isNodeBuiltinSpecifier('@lostgradient/cinder')).toBe(false);
    expect(isNodeBuiltinSpecifier('totally-undeclared-package')).toBe(false);
  });
});
