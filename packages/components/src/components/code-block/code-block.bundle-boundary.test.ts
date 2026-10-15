/**
 * Source boundary + SSR-plain contract for `<CodeBlock>`.
 *
 * `<CodeBlock>` imports no highlighter. It highlights with its `highlighter`
 * prop, else with the one an ancestor publishes through
 * `setCodeHighlighterContext`, else not at all. A default reachable from the
 * component — even behind a lazy `import()` — makes every consumer's bundler
 * emit all of Shiki's grammars and themes, so the source must hold neither:
 *
 *   - no `import()` expression anywhere in `code-block.svelte`, and
 *   - no static import of a Cinder highlighter module or of a Shiki package.
 *
 * `code-block.bundle.test.ts` proves the consequence on real consumer builds;
 * this file pins the cause in the component source, where a regression is
 * cheapest to read.
 */

import { dirname, resolve as resolvePath, sep } from 'node:path';

import { describe, expect, test } from 'bun:test';
import { parse } from 'svelte/compiler';

const HERE = import.meta.dir;
const SOURCE_PATH = resolvePath(HERE, 'code-block.svelte');
const HIGHLIGHTERS_DIRECTORY = resolvePath(HERE, '../../highlighters');

const source = await Bun.file(SOURCE_PATH).text();
const ast = parse(source, { filename: SOURCE_PATH, modern: true });

/** Every node of `root` whose `type` is `nodeType`, found by a generic walk. */
function nodesOfType(root: unknown, nodeType: string): unknown[] {
  const found: unknown[] = [];
  const seen = new Set<unknown>();
  const visit = (node: unknown): void => {
    if (node === null || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if ((node as { type?: unknown }).type === nodeType) found.push(node);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else visit(value);
    }
  };
  visit(root);
  return found;
}

/** Static `import`/`export … from` specifiers of both `<script>` blocks. */
function staticSpecifiers(): string[] {
  const specifiers: string[] = [];
  for (const program of [ast.instance?.content, ast.module?.content]) {
    for (const statement of program?.body ?? []) {
      if (
        (statement.type === 'ImportDeclaration' ||
          statement.type === 'ExportNamedDeclaration' ||
          statement.type === 'ExportAllDeclaration') &&
        statement.source !== null &&
        statement.source !== undefined &&
        typeof statement.source.value === 'string'
      ) {
        specifiers.push(statement.source.value);
      }
    }
  }
  return specifiers;
}

describe('CodeBlock — no highlighter of its own', () => {
  test('code-block.svelte contains no import() expression', () => {
    // Walk the instance script, the module script, and the template: an
    // `import()` in any of them is an edge the consumer's bundler follows.
    expect(nodesOfType(ast, 'ImportExpression')).toEqual([]);
    expect(source).not.toMatch(/\bimport\s*\(/);
  });

  test('code-block.svelte statically imports no highlighter module and no Shiki package', () => {
    const specifiers = staticSpecifiers();
    // Positive control: the walk does see the component's real imports.
    expect(specifiers).toContain('../../_internal/code-highlighter-context.ts');
    for (const specifier of specifiers) {
      expect(specifier, `'${specifier}' is a Shiki package`).not.toMatch(/^(?:shiki|@shikijs\/)/);
      if (!specifier.startsWith('.')) continue;
      const resolved = resolvePath(dirname(SOURCE_PATH), specifier);
      expect(
        resolved === HIGHLIGHTERS_DIRECTORY || resolved.startsWith(HIGHLIGHTERS_DIRECTORY + sep),
        `'${specifier}' reaches a Cinder highlighter module`,
      ).toBe(false);
    }
  });
});

// The real server process is the behavior under test (SSR without DOM globals, where `$effect`
// never runs), so it runs once at module scope, off bun's per-test clock; the test below only
// asserts on the settled result.
function renderServerFallback(): { exitCode: number; stderr: string; ssrHtml: string } {
  const sourcePath = resolvePath(HERE, 'code-block.svelte');
  const repositoryRoot = resolvePath(HERE, '../../..');
  const malicious = '<img src=x onError=alert(1)>';

  // Compile the component for the server and render it in a child process so
  // we exercise the real SSR path (where `$effect` never runs). Mirrors the
  // toast-region SSR test harness.
  const script = `
      import { rm, writeFile } from 'node:fs/promises';
      import { dirname, join } from 'node:path';
      import { pathToFileURL } from 'node:url';
      import { compile } from 'svelte/compiler';
      const sourcePath = ${JSON.stringify(sourcePath)};
      const source = await Bun.file(sourcePath).text();
      const compiled = compile(source, { filename: sourcePath, generate: 'server', css: 'external', dev: false });
      const serverSvelteEntry = pathToFileURL(join(process.cwd(), 'node_modules/svelte/src/index-server.js')).href;
      const serverCode = compiled.js.code.replaceAll("from 'svelte';", \`from \${JSON.stringify(serverSvelteEntry)};\`);
      const file = join(dirname(sourcePath), \`.cinder-ssr-test-\${process.pid}-\${Date.now()}.mjs\`);
      await writeFile(file, serverCode, 'utf-8');
      try {
        const { render } = await import('svelte/server');
        const module = await import(pathToFileURL(file).href);
        process.stdout.write(render(module.default, { props: { code: ${JSON.stringify(malicious)}, language: 'html' } }).body);
      } finally {
        await rm(file, { force: true });
      }
    `;
  const result = Bun.spawnSync({
    timeout: 120_000,
    cmd: ['bun', '-e', script],
    cwd: repositoryRoot,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const stderr = new TextDecoder().decode(result.stderr);
  const ssrHtml = new TextDecoder().decode(result.stdout);
  return { exitCode: result.exitCode, stderr, ssrHtml };
}

const { exitCode, stderr, ssrHtml } = renderServerFallback();

describe('CodeBlock — SSR two-phase contract', () => {
  test('server render emits the plain <pre><code> fallback with escaped code, no highlight', () => {
    expect(exitCode, stderr).toBe(0);
    // Plain fallback structure is present.
    expect(ssrHtml).toContain('cinder-code-block__pre');
    expect(ssrHtml).toContain('cinder-code-block__code');
    // Highlighting never ran on the server.
    expect(ssrHtml).not.toContain('shiki-default');
    // The code is HTML-escaped (no live <img> injected); Svelte interpolation
    // escapes `<` to `&lt;`.
    expect(ssrHtml).toContain('&lt;img');
    expect(ssrHtml).not.toContain('<img src=x onError=alert(1)>');
  });
});
