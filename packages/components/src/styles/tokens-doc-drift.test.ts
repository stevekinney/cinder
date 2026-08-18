/**
 * Drift test for docs/tokens.md.
 *
 * The doc is hand-maintained, so this test makes sure it stays in sync with
 * the actual `--cinder-*` declarations in tokens-base.css. It compares names
 * and authored values; CSS functions remain part of that exact contract.
 *
 * Test files may use `any` per project conventions.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { readRootTokenValues } from '../test/token-introspection.ts';

const PACKAGE_ROOT = join(import.meta.dir, '..', '..');
const REPO_ROOT = join(PACKAGE_ROOT, '..', '..');
const TOKENS_CSS = join(PACKAGE_ROOT, 'src', 'styles', 'tokens-base.css');
const TOKENS_DOC = join(REPO_ROOT, 'docs', 'tokens.md');
const FOCUS_RING_POLICY_DOC = join(REPO_ROOT, 'docs', 'focus-ring-policy.md');
const THEMING_DOC = join(REPO_ROOT, 'docs', 'theming.md');

function normalizeTokenValue(value: string): string {
  let normalized = '';
  let quote: '"' | "'" | undefined;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (quote !== undefined) {
      normalized += character;
      if (character === quote && value[index - 1] !== '\\') quote = undefined;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      normalized += character;
      continue;
    }
    normalized += /\s/.test(character) ? ' ' : character;
  }
  return normalized
    .replace(/ +/g, ' ')
    .replace(/\s*([(),])\s*/g, '$1')
    .trim();
}

function extractDocTokens(markdown: string): { duplicates: string[]; tokens: Map<string, string> } {
  // Doc lists tokens as inline code in table rows: `` `--cinder-space-4` ``.
  // We deliberately only count tokens that appear inside backticks at the start
  // of a table cell (i.e. `| \`--cinder-...\``) so that incidental mentions in
  // prose (e.g. "override `--cinder-accent` to re-derive both") don't count.
  const tokens = new Map<string, string>();
  const duplicates: string[] = [];
  const rowPattern = /^\|\s*`(--cinder-[a-z0-9-]+)`\s*\|\s*`([^`]+)`\s*\|/gm;
  for (const match of markdown.matchAll(rowPattern)) {
    if (!match[1] || !match[2]) continue;
    if (tokens.has(match[1])) duplicates.push(match[1]);
    tokens.set(match[1], normalizeTokenValue(match[2]));
  }
  return { duplicates: duplicates.toSorted(), tokens };
}

describe('docs/tokens.md drift', () => {
  test('documents exactly the tokens declared in tokens-base.css', async () => {
    const [css, doc] = await Promise.all([
      readFile(TOKENS_CSS, 'utf8'),
      readFile(TOKENS_DOC, 'utf8'),
    ]);

    const cssTokens = readRootTokenValues(css);
    const { duplicates, tokens: docTokens } = extractDocTokens(doc);

    // Sanity floor: a parser regression that silently returns a tiny set would
    // otherwise show up as a confusing "missing from CSS: [137 tokens]" diff
    // rather than a clear "the parser broke" signal. The real count sits well
    // above 100; 50 leaves room to delete tokens without lowering this floor.
    expect(cssTokens.size).toBeGreaterThan(50);
    expect(docTokens.size).toBeGreaterThan(50);

    const missingFromDoc = [...cssTokens.keys()]
      .filter((token) => !docTokens.has(token))
      .toSorted();
    const missingFromCss = [...docTokens.keys()]
      .filter((token) => !cssTokens.has(token))
      .toSorted();
    const mismatchedValues = [...cssTokens]
      .flatMap(([token, value]) => {
        const documented = docTokens.get(token);
        return documented === undefined || documented === normalizeTokenValue(value)
          ? []
          : [`${token}: docs=${documented} source=${normalizeTokenValue(value)}`];
      })
      .toSorted();

    expect({ duplicates, missingFromDoc, missingFromCss, mismatchedValues }).toEqual({
      duplicates: [],
      missingFromDoc: [],
      missingFromCss: [],
      mismatchedValues: [],
    });
  });

  test('keeps exact token references in focused guides current', async () => {
    const [css, focusRingPolicy, theming] = await Promise.all([
      readFile(TOKENS_CSS, 'utf8'),
      readFile(FOCUS_RING_POLICY_DOC, 'utf8'),
      readFile(THEMING_DOC, 'utf8'),
    ]);
    const tokens = readRootTokenValues(css);
    const value = (token: string) => {
      const resolved = tokens.get(token);
      expect(resolved).toBeDefined();
      return resolved!;
    };

    expect(focusRingPolicy).toContain(
      `| \`--cinder-ring-width\`        | \`${value('--cinder-ring-width')}\``,
    );
    expect(focusRingPolicy).toContain(
      `| \`--cinder-ring-offset\`       | \`${value('--cinder-ring-offset')}\``,
    );
    expect(focusRingPolicy).toContain(`\`${value('--cinder-ring-offset-color')}\``);

    const scopedThemeBlock = (theme: 'light' | 'dark') => {
      const block = theming.match(
        new RegExp(`^  \\[data-theme='${theme}'\\] \\{([\\s\\S]*?)\\n  \\}`, 'm'),
      )?.[1];
      expect(block).toBeDefined();
      return block!;
    };
    const darkTheme = scopedThemeBlock('dark');
    const lightTheme = scopedThemeBlock('light');

    for (const token of [
      '--cinder-surface',
      '--cinder-surface-raised',
      '--cinder-text',
      '--cinder-border',
      '--cinder-accent',
    ]) {
      const [light, dark] =
        value(token)
          .match(/^light-dark\((.*),(.*)\)$/)
          ?.slice(1)
          .map((arm) => arm.trim()) ?? [];
      expect(light).toBeDefined();
      expect(dark).toBeDefined();
      expect(lightTheme).toContain(`${token}: ${light};`);
      expect(darkTheme).toContain(`${token}: ${dark};`);
    }
  });
});
