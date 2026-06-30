/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

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
