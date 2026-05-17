/**
 * Drift test for docs/tokens.md.
 *
 * The doc is hand-maintained, so this test makes sure it stays in sync with
 * the actual `--cinder-*` declarations in tokens-base.css. We extract the set
 * of token names from each source and assert they match exactly.
 *
 * Test files may use `any` per project conventions.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

const PACKAGE_ROOT = join(import.meta.dir, '..', '..');
const REPO_ROOT = join(PACKAGE_ROOT, '..', '..');
const TOKENS_CSS = join(PACKAGE_ROOT, 'src', 'styles', 'tokens-base.css');
const TOKENS_DOC = join(REPO_ROOT, 'docs', 'tokens.md');

function extractCssTokens(css: string): Set<string> {
  // Pull just the `:root { ... }` block. The file also has scoped redeclarations
  // (`:root[data-theme='dark']`, the prefers-reduced-motion override, etc.) that
  // would otherwise inflate the token set with duplicates.
  const rootMatch = css.match(/^\s*:root\s*\{([\s\S]*?)\n\}/m);
  const rootBody = rootMatch?.[1];
  if (!rootBody) {
    throw new Error('Could not find :root { ... } block in tokens-base.css');
  }
  // Strip CSS block comments so a `/* --cinder-future: reserved */` aside in the
  // source never gets counted as a real declaration.
  const stripped = rootBody.replace(/\/\*[\s\S]*?\*\//g, '');
  const tokens = new Set<string>();
  const declarationPattern = /--cinder-[a-z0-9-]+(?=\s*:)/g;
  for (const match of stripped.matchAll(declarationPattern)) {
    tokens.add(match[0]);
  }
  return tokens;
}

function extractDocTokens(markdown: string): Set<string> {
  // Doc lists tokens as inline code in table rows: `` `--cinder-space-4` ``.
  // We deliberately only count tokens that appear inside backticks at the start
  // of a table cell (i.e. `| \`--cinder-...\``) so that incidental mentions in
  // prose (e.g. "override `--cinder-accent` to re-derive both") don't count.
  const tokens = new Set<string>();
  const rowPattern = /^\|\s*`(--cinder-[a-z0-9-]+)`/gm;
  for (const match of markdown.matchAll(rowPattern)) {
    if (match[1]) tokens.add(match[1]);
  }
  return tokens;
}

describe('docs/tokens.md drift', () => {
  test('documents exactly the tokens declared in tokens-base.css', async () => {
    const [css, doc] = await Promise.all([
      readFile(TOKENS_CSS, 'utf8'),
      readFile(TOKENS_DOC, 'utf8'),
    ]);

    const cssTokens = extractCssTokens(css);
    const docTokens = extractDocTokens(doc);

    // Sanity floor: a parser regression that silently returns a tiny set would
    // otherwise show up as a confusing "missing from CSS: [137 tokens]" diff
    // rather than a clear "the parser broke" signal. The real count sits well
    // above 100; 50 leaves room to delete tokens without lowering this floor.
    expect(cssTokens.size).toBeGreaterThan(50);
    expect(docTokens.size).toBeGreaterThan(50);

    const missingFromDoc = [...cssTokens].filter((token) => !docTokens.has(token)).toSorted();
    const missingFromCss = [...docTokens].filter((token) => !cssTokens.has(token)).toSorted();

    expect({ missingFromDoc, missingFromCss }).toEqual({
      missingFromDoc: [],
      missingFromCss: [],
    });
  });
});
