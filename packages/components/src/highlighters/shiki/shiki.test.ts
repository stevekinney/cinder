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
    const highlight = shikiHighlighter();
    let threw = false;
    try {
      await highlight('hello', 'definitely-not-a-language');
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
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
