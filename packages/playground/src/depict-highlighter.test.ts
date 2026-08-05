/**
 * Verifies the shared `<CodeBlock>` highlighter really is on the `depict`
 * theme — i.e. that it emits `var(--syntax-*)` references (which
 * `render-shell.ts` declares) rather than the baked hex colors of Shiki's
 * default `github-light` / `github-dark` bundle.
 *
 * This exercises the real adapter, real grammars, and the real Oniguruma
 * engine. Nothing is stubbed, because the bug being guarded against lives
 * entirely in how the adapter resolves the theme registry.
 */

import { describe, expect, it } from 'bun:test';

import { depictHighlighter } from './depict-highlighter.ts';

describe('depictHighlighter', () => {
  it('emits depict CSS variables instead of github-light hex colors', async () => {
    const html = await depictHighlighter('const answer = 42;', 'ts');

    // The whole point: colors arrive as var() references resolved at paint
    // time against the :root declarations in render-shell.ts.
    expect(html).toContain('var(--syntax-keyword)');
    expect(html).toContain('--surface-inset');

    // `background-color:#fff` is what github-light bakes in; its presence
    // means the theme option did not take effect.
    expect(html.toLowerCase()).not.toContain('#fff');
  }, 30_000);

  it('still resolves language grammars (curated theme loaders must not empty the language registry)', async () => {
    // Regression: passing only `themeLoaders` to the /curated adapter entry
    // point leaves `bundledLanguages` as {}, so every language misses and
    // falls back to the escaped-plaintext block — highlighting silently dies.
    const html = await depictHighlighter('const answer = 42;', 'ts');

    expect(html).not.toContain('shiki-plaintext');
    expect(html).toContain('<span');
  }, 30_000);

  it('resolves Shiki language aliases the same way the bundled adapter does', async () => {
    const html = await depictHighlighter('SELECT 1;', 'sql');
    expect(html).not.toContain('shiki-plaintext');
  }, 30_000);
});
