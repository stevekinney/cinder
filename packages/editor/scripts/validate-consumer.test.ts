import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import type { PackageManifest } from './pack-for-publish.ts';
import {
  assertImportClosure,
  extractSvelteScriptBlocks,
  extractSvelteStyleBlocks,
  findRealNodeExecutable,
  isPlausibleCssImportSpecifier,
  nodeBuiltinMembership,
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

  test('comment prose containing "import(" followed by a quote is not mistaken for a dynamic import (cinder#1335 round-3 finding)', async () => {
    // Round 2 added a supplementary regex specifically to catch a computed
    // dynamic import's static prefix -- but that regex ran over the same
    // raw, comment-bearing source text #1334 was about, and reopened the
    // identical failure mode for `import(` specifically: a doc comment
    // containing sample code like `import('example')` would be misread as
    // a real dynamic import. That regex was removed entirely (not
    // narrowed) rather than patched again -- see the module header's
    // limitations section for why the resulting gap (a genuinely computed
    // dynamic import specifier) is accepted rather than covered.
    const root = await makeFixture({
      'dist/prose-with-import-call.js': `/**
 * Elsewhere in this codebase, code like import('undeclared-package') shows
 * up as a documentation example of the dynamic import syntax -- this
 * comment exists only to contain that exact text shape.
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
     because "some" (its bare-name portion) contains whitespace. */
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

  test('a dynamic import() with a computed specifier is no longer caught -- a deliberate, documented gap, not an oversight (cinder#1335 round-3)', async () => {
    // scanImports correctly reports nothing for a non-static specifier,
    // and this module no longer supplements that with a regex (see the
    // test above for why). Verified separately (module header, PR
    // discussion) that this pattern has zero live instances in the
    // package's actual published output, and that a genuinely-reachable
    // undeclared dependency still fails the runtime fixture regardless.
    const root = await makeFixture({
      'dist/dynamic.js': `const feature = getFeatureName();\nimport('totally-undeclared-package/' + feature);\n`,
    });

    await expect(assertImportClosure(manifestWithDeclaredPeers, root)).resolves.toBeUndefined();
  });

  test('Node builtins loaded via require() or a bare specifier are not flagged as undeclared', async () => {
    const root = await makeFixture({
      'dist/node-builtins.js': `const fs = require('fs');\nconst path = require('node:path');\nimport('fs');\nimport('node:child_process');\nexport const value = [fs, path];\n`,
    });

    await expect(assertImportClosure(manifestWithDeclaredPeers, root)).resolves.toBeUndefined();
  });

  test('a package Bun treats as builtin but real Node does not (ws, undici) is still flagged as undeclared (cinder#1335 round-3 finding)', async () => {
    // Verified empirically: under Bun, `require('node:module').isBuiltin('ws')`
    // and `isBuiltin('undici')` both incorrectly return true (Bun ships
    // these as built-in shims; real Node does not). If this validator ever
    // asked Bun's own node:module instead of a real Node executable, a
    // packed `import 'ws'` would pass this check without a declared
    // dependency and then fail for every actual Node consumer.
    const root = await makeFixture({
      'dist/bun-only-builtin.js': `import { WebSocket } from 'ws';\nexport const value = WebSocket;\n`,
    });

    await expect(assertImportClosure(manifestWithDeclaredPeers, root)).rejects.toThrow(/\bws\b/u);
  });

  test('a non-builtin subpath of a real builtin name (assert/not-real) is still flagged, not exempted by first-segment matching (cinder#1335 round-3 finding)', async () => {
    const root = await makeFixture({
      'dist/fake-builtin-subpath.js': `import { danger } from 'assert/not-real';\nexport const value = danger;\n`,
    });

    await expect(assertImportClosure(manifestWithDeclaredPeers, root)).rejects.toThrow(
      /assert\/not-real/u,
    );
  });

  test('.css files: @import inside a comment is rejected, but a real @import to an undeclared package is still caught', async () => {
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

  test('.css files: a real quoted @import path with a space in a later subpath segment is still caught, not discarded (cinder#1335 round-3 finding)', async () => {
    // Round 2's whitespace guard rejected the WHOLE captured string if it
    // contained any whitespace at all -- which incorrectly discarded a
    // legally-quoted CSS path whose subpath (not its package name) has a
    // space, like a real file named "theme dark.css". Validating only the
    // bare-package-name portion fixes this while staying fail-closed
    // against comment prose (which has no "/", so its own bare-name
    // portion is the whole whitespace-laden string).
    const root = await makeFixture({
      'dist/styles.css': `@import 'totally-undeclared-package/theme dark.css';\n.foo { color: red; }\n`,
    });

    await expect(assertImportClosure(manifestWithDeclaredPeers, root)).rejects.toThrow(
      /totally-undeclared-package\/theme dark\.css/u,
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

describe('isPlausibleCssImportSpecifier (cinder#1335 round-3)', () => {
  test('accepts a real-looking specifier with no subpath', () => {
    expect(isPlausibleCssImportSpecifier('@lostgradient/cinder/styles')).toBe(true);
    expect(isPlausibleCssImportSpecifier('svelte')).toBe(true);
  });

  test('accepts a real quoted path whose subpath (not its package name) contains whitespace', () => {
    expect(isPlausibleCssImportSpecifier('undeclared-package/theme dark.css')).toBe(true);
    expect(isPlausibleCssImportSpecifier('@lostgradient/cinder/some file.css')).toBe(true);
  });

  test('rejects comment prose -- whose own bare-name portion is still whitespace-laden, since it has no "/"', () => {
    expect(isPlausibleCssImportSpecifier('prose that looks like a specifier')).toBe(false);
    expect(isPlausibleCssImportSpecifier('a\nmultiline\ncapture')).toBe(false);
  });

  test('rejects prose whose first segment (before an early "/") still contains whitespace', () => {
    expect(isPlausibleCssImportSpecifier('see docs/for more info')).toBe(false);
  });

  test('rejects an empty string', () => {
    expect(isPlausibleCssImportSpecifier('')).toBe(false);
  });
});

describe('findRealNodeExecutable', () => {
  test('finds a real Node executable, not a bun-node shim', async () => {
    const node = await findRealNodeExecutable();
    expect(node).toBeDefined();
    if (node === undefined) return;
    expect(node).not.toContain('bun-node');
  });
});

describe('nodeBuiltinMembership (cinder#1335 round-3 finding)', () => {
  test('recognizes real Node builtins, bare and node:-prefixed, including subpaths', async () => {
    const node = await findRealNodeExecutable();
    expect(node).toBeDefined();
    if (node === undefined) return;

    const result = await nodeBuiltinMembership(node, ['fs', 'node:fs', 'node:fs/promises']);
    expect(result.has('fs')).toBe(true);
    expect(result.has('node:fs')).toBe(true);
    expect(result.has('node:fs/promises')).toBe(true);
  });

  test('does not recognize packages Bun treats as builtin but real Node does not (ws, undici)', async () => {
    // The actual bug this fix closes: under Bun, `node:module`'s own
    // `isBuiltin('ws')`/`isBuiltin('undici')` both incorrectly return
    // `true`. Querying the real target Node instead gets the right answer.
    const node = await findRealNodeExecutable();
    expect(node).toBeDefined();
    if (node === undefined) return;

    const result = await nodeBuiltinMembership(node, ['ws', 'undici']);
    expect(result.has('ws')).toBe(false);
    expect(result.has('undici')).toBe(false);
  });

  test('does not recognize a non-builtin subpath of a real builtin name', async () => {
    const node = await findRealNodeExecutable();
    expect(node).toBeDefined();
    if (node === undefined) return;

    const result = await nodeBuiltinMembership(node, ['assert', 'assert/not-real']);
    expect(result.has('assert')).toBe(true);
    expect(result.has('assert/not-real')).toBe(false);
  });

  test('does not recognize a real (non-builtin) package name', async () => {
    const node = await findRealNodeExecutable();
    expect(node).toBeDefined();
    if (node === undefined) return;

    const result = await nodeBuiltinMembership(node, [
      'svelte',
      '@lostgradient/cinder',
      'totally-undeclared-package',
    ]);
    expect(result.size).toBe(0);
  });

  test('returns an empty set without spawning anything for an empty specifier list', async () => {
    const result = await nodeBuiltinMembership('/nonexistent/node/binary', []);
    expect(result.size).toBe(0);
  });
});
