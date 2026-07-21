/// <reference lib="dom" />
import { rm } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';

import { afterEach, describe, expect, test } from 'bun:test';
import ts from 'typescript';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { stripRootPreTabIndex } from './strip-root-pre-tab-index.ts';

setupHappyDom();

const { shikiHighlighter } = await import('./index.ts');

const originalConsoleWarn = console.warn;
afterEach(() => {
  console.warn = originalConsoleWarn;
});

function captureWarnings(): { warnings: string[]; restore: () => void } {
  const warnings: string[] = [];
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map((a) => (typeof a === 'string' ? a : String(a))).join(' '));
  };
  return {
    warnings,
    restore: () => {
      console.warn = originalConsoleWarn;
    },
  };
}

describe('shikiHighlighter — happy path', () => {
  test('highlights a known language and returns a <pre><code> block', async () => {
    const highlight = shikiHighlighter();
    const html = await highlight('const x: number = 1;', 'typescript');
    expect(html.startsWith('<pre')).toBe(true);
    expect(html).toContain('<code');
    expect(html).toContain('</code>');
    expect(html).toContain('</pre>');
    // Shiki tokenizes — at least one styled <span> should appear inside.
    expect(html).toMatch(/<span[^>]*style=/);
  });

  test('resolves common aliases via Shiki natively (ts -> typescript)', async () => {
    const highlight = shikiHighlighter();
    const html = await highlight('const x: number = 1;', 'ts');
    expect(html.startsWith('<pre')).toBe(true);
    // Tokens should appear — confirms the alias hit a real grammar rather
    // than the plaintext fallback.
    expect(html).toMatch(/<span[^>]*style=/);
  });

  test('honors a single-string theme', async () => {
    const highlight = shikiHighlighter({ theme: 'github-light' });
    const html = await highlight('const x = 1;', 'javascript');
    // github-light emits an off-white background; the exact value is opaque
    // to us but the presence of an inline style on the <pre> proves the
    // theme was applied (vs the plaintext fallback which carries no style).
    expect(html).toMatch(/<pre[^>]*style=/);
  });

  test('preloads specified languages without throwing and returns highlighted output', async () => {
    // The `langs` preload option calls `codeToHtml` once per language at
    // first highlight, so Shiki resolves and caches the grammar before the
    // first real call. We assert that a preloaded language still produces
    // a highlighted result (i.e. the preload completed successfully).
    const highlight = shikiHighlighter({ langs: ['typescript', 'javascript'] });
    const html = await highlight('const x = 1;', 'typescript');
    expect(html.startsWith('<pre')).toBe(true);
    expect(html).toMatch(/<span[^>]*style=/);
  });

  test('preload tolerates an unknown language and keeps subsequent highlights working', async () => {
    // The preload loop swallows failures so a bad entry in `langs` cannot
    // block initialization. Once the highlighter is built, a valid lang
    // still highlights correctly.
    const { restore } = captureWarnings();
    try {
      const highlight = shikiHighlighter({
        langs: ['definitely-not-a-language', 'typescript'],
      });
      const html = await highlight('const x = 1;', 'typescript');
      expect(html.startsWith('<pre')).toBe(true);
      expect(html).toMatch(/<span[^>]*style=/);
    } finally {
      restore();
    }
  });

  test('normalizes language tokens with trailing whitespace and metadata', async () => {
    // Markdown fences commonly carry trailing whitespace or attribute-like
    // suffixes; the adapter must trim and take the first whitespace-delimited
    // token so these still hit the real Shiki grammar.
    const highlight = shikiHighlighter();
    const trimmed = await highlight('const x = 1;', 'ts ');
    expect(trimmed).toMatch(/<span[^>]*style=/);
    const withMetadata = await highlight('const x = 1;', 'typescript title="example.ts"');
    expect(withMetadata).toMatch(/<span[^>]*style=/);
  });

  test('honors the dual-theme `{ light, dark }` form', async () => {
    const highlight = shikiHighlighter({
      theme: { light: 'github-light', dark: 'github-dark' },
    });
    const html = await highlight('const x = 1;', 'javascript');
    // Shiki's multi-theme output uses CSS variables; the <pre> carries a
    // class that identifies multi-theme output OR an inline style with
    // `--shiki-` custom properties. Either signal is acceptable.
    const dualThemeApplied =
      /class="[^"]*shiki[^"]*shiki-themes/.test(html) || html.includes('--shiki-light');
    expect(dualThemeApplied).toBe(true);
  });

  test('returns Shiki root <pre> markup without tabindex so CodeBlock keeps a single scroll focus target', async () => {
    const highlight = shikiHighlighter();
    const html = await highlight('const x = 1;', 'javascript');
    expect(html).toMatch(/^<pre\b/);
    expect(html).not.toMatch(/^<pre\b[^>]*\stabindex=/);
  });

  test('strips tabindex from mocked Shiki root <pre> output', () => {
    const html = '<pre class="shiki" tabindex="0"><code><span>const x = 1;</span></code></pre>';
    expect(stripRootPreTabIndex(html)).toBe(
      '<pre class="shiki"><code><span>const x = 1;</span></code></pre>',
    );
  });

  test('falls back when loading Shiki rejects', async () => {
    const { warnings, restore } = captureWarnings();
    try {
      const highlight = shikiHighlighter({}, async () => {
        throw new Error('load failed');
      });
      const html = await highlight('const x = 1;', 'javascript');

      expect(html).toBe('<pre class="shiki shiki-plaintext"><code>const x = 1;</code></pre>');
      expect(warnings.some((warning) => warning.includes('failed to load shiki'))).toBe(true);
    } finally {
      restore();
    }
  });

  test('falls back once when Shiki highlighting rejects for a loaded language', async () => {
    const { warnings, restore } = captureWarnings();
    try {
      const highlight = shikiHighlighter(
        {},
        async () =>
          ({
            highlighter: {
              loadLanguage: async () => {},
              loadTheme: async () => {},
              codeToHtml: () => {
                throw new Error('highlight failed');
              },
            },
            bundledLanguages: { javascript: async () => ({}) },
            bundledThemes: {
              'github-light': async () => ({}),
              'github-dark': async () => ({}),
            },
            guessEmbeddedLanguages: () => [],
          }) as unknown as Awaited<ReturnType<NonNullable<Parameters<typeof shikiHighlighter>[1]>>>,
      );
      const first = await highlight('const x = 1;', 'javascript');
      const second = await highlight('const y = 2;', 'javascript');

      expect(first).toContain('<pre class="shiki shiki-plaintext">');
      expect(second).toContain('<pre class="shiki shiki-plaintext">');
      expect(warnings.filter((warning) => warning.includes('failed to highlight')).length).toBe(1);
    } finally {
      restore();
    }
  });
});

describe('shikiHighlighter — fallback contract', () => {
  test('empty lang returns escaped-plaintext fallback', async () => {
    const highlight = shikiHighlighter();
    const html = await highlight('const x = 1;', '');
    expect(html).toBe('<pre class="shiki shiki-plaintext"><code>const x = 1;</code></pre>');
  });

  test('unknown lang returns escaped-plaintext fallback and warns once', async () => {
    const { warnings, restore } = captureWarnings();
    try {
      const highlight = shikiHighlighter();
      const first = await highlight('hello', 'definitely-not-a-language');
      const second = await highlight('again', 'definitely-not-a-language');

      expect(first).toContain('<pre class="shiki shiki-plaintext">');
      expect(first).toContain('<code>hello</code>');
      expect(second).toContain('<code>again</code>');

      const matching = warnings.filter((w) => w.includes('definitely-not-a-language'));
      expect(matching.length).toBe(1);
    } finally {
      restore();
    }
  });

  test('does not throw on unknown language', async () => {
    const { restore } = captureWarnings();
    try {
      const highlight = shikiHighlighter();
      let threw = false;
      try {
        await highlight('hello', 'definitely-not-a-language');
      } catch {
        threw = true;
      }
      expect(threw).toBe(false);
    } finally {
      restore();
    }
  });

  test('does not throw when a JS caller passes a non-string lang', async () => {
    // Defensive contract: the `Highlighter` type signature is `lang: string`,
    // but a vanilla-JS caller can bypass it. Calling `.trim()` on
    // `null`/`undefined`/a number would crash before reaching the
    // documented "never throws" fallback. The adapter guards `typeof lang
    // === 'string'` so all three render as the escaped-plaintext block.
    const { restore } = captureWarnings();
    try {
      const highlight = shikiHighlighter();
      // Cast through `unknown` for the test only — production type-checking
      // would forbid these calls, but the runtime guard still has to hold.
      const callPlaintext = highlight as (code: string, lang: unknown) => Promise<string>;
      const nullResult = await callPlaintext('plain', null);
      expect(nullResult).toContain('<pre class="shiki shiki-plaintext">');
      expect(nullResult).toContain('<code>plain</code>');
      const undefinedResult = await callPlaintext('plain', undefined);
      expect(undefinedResult).toContain('<pre class="shiki shiki-plaintext">');
      const numericResult = await callPlaintext('plain', 42);
      expect(numericResult).toContain('<pre class="shiki shiki-plaintext">');
    } finally {
      restore();
    }
  });

  test('does not throw when a JS caller passes a non-string code', async () => {
    // Same defensive contract as the `lang` guard above: every fallback
    // path runs `escapeHtml(code)` which previously called `.replaceAll`
    // on `code` directly. `null`/`undefined`/non-strings would throw
    // before reaching the documented "never throws" fallback. The guard
    // coerces non-strings to `''` so the plaintext fallback still renders.
    const { restore } = captureWarnings();
    try {
      const highlight = shikiHighlighter();
      const callPlaintext = highlight as (code: unknown, lang: string) => Promise<string>;
      const nullResult = await callPlaintext(null, '');
      expect(nullResult).toContain('<pre class="shiki shiki-plaintext">');
      expect(nullResult).toContain('<code></code>');
      const undefinedResult = await callPlaintext(undefined, '');
      expect(undefinedResult).toContain('<code></code>');
      const numericResult = await callPlaintext(42, '');
      expect(numericResult).toContain('<code></code>');
      // Also exercise the unknown-language fallback path (which also runs
      // `plaintextBlock(code)` through `escapeHtml`) to confirm the guard
      // holds when Shiki has been loaded.
      const unknownLangResult = await callPlaintext(null, 'definitely-not-a-language');
      expect(unknownLangResult).toContain('<pre class="shiki shiki-plaintext">');
    } finally {
      restore();
    }
  });

  test('HTML-escapes <script>alert(1)</script> in the plaintext fallback', async () => {
    const highlight = shikiHighlighter();
    const html = await highlight('<script>alert(1)</script>', '');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  test('HTML-escapes ampersands, quotes, and apostrophes in the fallback', async () => {
    const highlight = shikiHighlighter();
    const html = await highlight(`a & b "c" 'd'`, '');
    expect(html).toContain('a &amp; b &quot;c&quot; &#39;d&#39;');
  });

  test('Shiki escapes <script>alert(1)</script> in the highlighted path too', async () => {
    // The Shiki trust contract: `codeToHtml` escapes its input. We assert
    // that contract here so a future Shiki upgrade that regresses this
    // would surface as a failing test rather than as a live XSS in
    // CodeBlock's `{@html}` injection. Shiki may use either named (`&lt;`)
    // or numeric (`&#x3C;`/`&#60;`) entity forms — both are valid HTML and
    // both prevent injection.
    const highlight = shikiHighlighter();
    const html = await highlight('<script>alert(1)</script>', 'javascript');
    expect(html).not.toContain('<script>alert(1)</script>');
    const escaped = /&lt;|&#x3[Cc];|&#60;/.test(html);
    expect(escaped).toBe(true);
  });
});

describe('shikiHighlighter — import strategy (issue #773)', () => {
  // Pins the fix for #773: this adapter must never pull in Shiki's default
  // `shiki` barrel (which statically references every bundled grammar and
  // theme in one module — see `docs/decisions/package-boundaries.md` for the
  // ~10 MB measurement). It must instead build on `shiki/core` +
  // `@shikijs/engine-oniguruma`, resolving languages and themes through the
  // standalone `shiki/langs` / `shiki/themes` lookup tables, converging on
  // the same pattern `packages/markdown` already uses. See the next test for
  // why that matters given cinder's OWN `splitting: false` build.
  test('never imports the bare `shiki` module specifier (static or dynamic)', async () => {
    const filePath = resolvePath(import.meta.dir, 'index.ts');
    const source = await Bun.file(filePath).text();
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
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments[0] !== undefined &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        specifiers.push(node.arguments[0].text);
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);

    expect(specifiers).not.toContain('shiki');
    expect(specifiers).toContain('shiki/core');
    expect(specifiers).toContain('shiki/langs');
    expect(specifiers).toContain('shiki/themes');
    expect(specifiers).toContain('shiki/wasm');
    expect(specifiers).toContain('@shikijs/engine-oniguruma');
  });

  test('resolves a language far outside the sibling markdown package’s fixed 12-language set', async () => {
    // `packages/markdown` deliberately narrows to 12 languages. This adapter's
    // contract is broader — any language Shiki bundles — so prove a language
    // well outside that fixed set (Rust) still resolves through the real
    // per-language dynamic import, not a hardcoded list.
    const highlight = shikiHighlighter();
    const html = await highlight('fn main() {}', 'rust');
    expect(html.startsWith('<pre')).toBe(true);
    expect(html).toMatch(/<span[^>]*style=/);
  });

  test('loads embedded grammars for compound languages (Markdown with a fenced TypeScript block)', async () => {
    // The previous `import('shiki').codeToHtml` shorthand auto-loaded
    // grammars embedded in the source via `guessEmbeddedLanguages` (fenced
    // code inside Markdown, `<script lang="...">` inside Svelte/Vue/HTML).
    // `ensureLanguageLoaded` alone only loads the requested top-level
    // language, so a Markdown document whose fenced block requests a
    // grammar Markdown itself doesn't declare (`typescript`, here) needs
    // the embedded-language loader to still highlight that nested region.
    const highlight = shikiHighlighter();
    const html = await highlight('```typescript\nconst x: number = 1;\n```\n', 'markdown');
    expect(html.startsWith('<pre')).toBe(true);
    // Without the embedded grammar loaded, Shiki tokenizes the fenced
    // region as one flat run — every token shares Markdown's single plain-
    // text color. With `typescript` loaded, `const`/`number` get the
    // theme's distinct keyword/type colors. So more than one unique
    // `color:` value appearing is the signal that the embedded TypeScript
    // grammar actually tokenized the fence content, not just Markdown's own
    // outer grammar (which alone would still emit *a* styled `<span>`, just
    // always the same color — a weaker assertion this regression would slip
    // through).
    const colors = new Set(
      Array.from(html.matchAll(/color:#[0-9A-Fa-f]{6}/g), (match) => match[0]),
    );
    expect(colors.size).toBeGreaterThan(1);
  });

  test("cinder's own build externalizes every Shiki subpath this adapter imports", async () => {
    // The real regression this issue guards against: `scripts/build.ts` runs
    // with `splitting: false`, so any Shiki-family specifier THIS file
    // imports that is missing from that build's `external` list gets
    // inlined whole into cinder's own published `dist/highlighters/shiki/index.js`
    // — vendoring every bundled grammar (~10 MB) into cinder's package
    // regardless of what a consumer ever highlights. Build this file
    // in isolation with exactly the externals `scripts/build.ts` declares
    // and assert the output stays tiny (our own adapter code only, no
    // vendored Shiki internals).
    const buildScriptPath = resolvePath(import.meta.dir, '../../../scripts/build.ts');
    const buildScriptSource = await Bun.file(buildScriptPath).text();
    // Regex-based rather than exact-substring so this survives quote-style or
    // formatting changes to the externals list — it only pins that each
    // specifier appears as its own quoted string literal somewhere in the file.
    for (const required of ['@shikijs/engine-oniguruma', 'shiki/\\*', 'shiki']) {
      const pattern = new RegExp(`['"]${required}['"]`);
      expect(
        pattern.test(buildScriptSource),
        `scripts/build.ts must externalize a '${required}' specifier for the Shiki adapter`,
      ).toBe(true);
    }

    const entryPath = resolvePath(import.meta.dir, 'index.ts');
    const outdirectory = `${import.meta.dir}/.build-weight-probe-${process.pid}`;
    try {
      const result = await Bun.build({
        entrypoints: [entryPath],
        outdir: outdirectory,
        target: 'browser',
        format: 'esm',
        splitting: false,
        external: ['svelte', 'svelte/*', 'shiki', 'shiki/*', '@shikijs/engine-oniguruma'],
      });
      expect(result.success).toBe(true);
      const totalBytes = result.outputs.reduce((sum, output) => sum + output.size, 0);
      // Our own adapter is a few KB; anything approaching Shiki's grammar
      // bundle (~10 MB) means a subpath leaked into the output uninlined.
      expect(totalBytes).toBeLessThan(100_000);
    } finally {
      await rm(outdirectory, { recursive: true, force: true });
    }
  });
});
