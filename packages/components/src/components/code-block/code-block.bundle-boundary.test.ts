/**
 * Bundling-proof + SSR-plain contract for `<CodeBlock>`.
 *
 * SSR safety is BOTH non-execution AND bundle absence. SSR render tests prove
 * the highlighter never runs on the server; this test proves the Shiki adapter
 * is never STATICALLY imported into CodeBlock's import graph, so it cannot be
 * pulled into the SSR (or entry) bundle. The only edge from CodeBlock to the
 * Shiki adapter must be the dynamic `import()` inside the default-highlighter
 * seam.
 *
 * The static scan walks every static `import ... from`/`export ... from`
 * module specifier in:
 *   - `code-block.svelte` (instance + module scripts)
 *   - `code-block-default-highlighter.ts` (the seam CodeBlock imports)
 * and asserts NONE resolve to `src/highlighters/shiki/index.ts`. Dynamic
 * `import('../../highlighters/shiki/index.ts')` is allowed (and asserted to
 * exist as a positive control so a future refactor that drops the lazy edge
 * entirely is caught).
 */

import { dirname, resolve as resolvePath } from 'node:path';

import { describe, expect, test } from 'bun:test';
import { parse } from 'svelte/compiler';
import ts from 'typescript';

const HERE = import.meta.dir;
const SHIKI_ADAPTER = resolvePath(HERE, '../../highlighters/shiki/index.ts');

/** Resolve a relative specifier to the candidate absolute files it could mean. */
function resolveSpecifierCandidates(fromFile: string, specifier: string): string[] {
  if (!specifier.startsWith('.')) return [];
  const base = resolvePath(dirname(fromFile), specifier);
  return [base, `${base}.ts`, resolvePath(base, 'index.ts')];
}

/** Static import/export specifiers from a TypeScript source file. */
function staticSpecifiersFromTs(filePath: string, source: string): string[] {
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];
  function visit(node: ts.Node): void {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return specifiers;
}

/** Dynamic `import('...')` specifiers from a TypeScript source file. */
function dynamicSpecifiersFromTs(filePath: string, source: string): string[] {
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const firstArgument = node.arguments[0];
      if (firstArgument !== undefined && ts.isStringLiteral(firstArgument)) {
        specifiers.push(firstArgument.text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return specifiers;
}

function assertNoStaticShikiEdge(filePath: string, specifiers: string[]): void {
  for (const specifier of specifiers) {
    for (const candidate of resolveSpecifierCandidates(filePath, specifier)) {
      expect(
        candidate,
        `${filePath} statically imports the Shiki adapter via '${specifier}' — this breaks SSR/entry-bundle safety`,
      ).not.toBe(SHIKI_ADAPTER);
    }
  }
}

describe('CodeBlock — Shiki bundle boundary', () => {
  test('code-block.svelte has no static import of the Shiki adapter', async () => {
    const filePath = resolvePath(HERE, 'code-block.svelte');
    const source = await Bun.file(filePath).text();
    const ast = parse(source, { filename: filePath, modern: true });

    // Walk the ESTree Program body of each <script> for static import/export
    // declarations and collect their source specifiers. (Walking the AST
    // directly avoids re-parsing a .svelte file as TypeScript.)
    const specifiers: string[] = [];
    for (const program of [ast.instance?.content, ast.module?.content]) {
      for (const statement of program?.body ?? []) {
        if (
          (statement.type === 'ImportDeclaration' || statement.type === 'ExportNamedDeclaration') &&
          statement.source !== null &&
          statement.source !== undefined &&
          typeof statement.source.value === 'string'
        ) {
          specifiers.push(statement.source.value);
        }
      }
    }
    assertNoStaticShikiEdge(filePath, specifiers);
  });

  test('code-block-default-highlighter.ts reaches Shiki ONLY via dynamic import', async () => {
    const filePath = resolvePath(HERE, 'code-block-default-highlighter.ts');
    const source = await Bun.file(filePath).text();

    // No static edge to the adapter.
    assertNoStaticShikiEdge(filePath, staticSpecifiersFromTs(filePath, source));

    // Positive control: a dynamic import of the adapter DOES exist, so the
    // lazy edge is real (not accidentally deleted).
    const dynamic = dynamicSpecifiersFromTs(filePath, source);
    const reachesAdapter = dynamic.some((specifier) =>
      resolveSpecifierCandidates(filePath, specifier).includes(SHIKI_ADAPTER),
    );
    expect(
      reachesAdapter,
      'default-highlighter seam must dynamically import the Shiki adapter',
    ).toBe(true);
  });
});

describe('CodeBlock — SSR two-phase contract', () => {
  test('server render emits the plain <pre><code> fallback with escaped code, no highlight', () => {
    const sourcePath = resolvePath(HERE, 'code-block.svelte');
    const repositoryRoot = resolvePath(HERE, '../../../../../');
    const malicious = '<img src=x onerror=alert(1)>';

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
      cmd: ['bun', '-e', script],
      cwd: repositoryRoot,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const stderr = new TextDecoder().decode(result.stderr);
    const ssrHtml = new TextDecoder().decode(result.stdout);

    expect(result.exitCode, stderr).toBe(0);
    // Plain fallback structure is present.
    expect(ssrHtml).toContain('cinder-code-block__pre');
    expect(ssrHtml).toContain('cinder-code-block__code');
    // Highlighting never ran on the server.
    expect(ssrHtml).not.toContain('shiki-default');
    // The code is HTML-escaped (no live <img> injected); Svelte interpolation
    // escapes `<` to `&lt;`.
    expect(ssrHtml).toContain('&lt;img');
    expect(ssrHtml).not.toContain('<img src=x onerror=alert(1)>');
  }, 30_000);
});
