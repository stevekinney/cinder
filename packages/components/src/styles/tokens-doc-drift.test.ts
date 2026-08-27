/**
 * Drift test for docs/tokens.md.
 *
 * Since CIN-30, docs/tokens.md's token tables are GENERATED (see
 * `generate-artifacts.ts`) from the DTCG corpus at `src/tokens/`, between
 * `<!-- BEGIN/END GENERATED TOKEN TABLE -->` markers -- `tokens:generate
 * -- --check` already fails on any drift between the committed doc and a
 * fresh generation. This test's value-drift check reads the same corpus data
 * the generator does (not `tokens-base.css`, and not by shelling out to the
 * generator itself) as an independent, faster-to-diagnose cross-check: it
 * fails with a clear per-token diff rather than the generator's file-level
 * "drifted, regenerate" error. The other test in this file (focus-ring-policy
 * and theming doc references) is unrelated to CIN-30 and unchanged.
 *
 * Test files may use `any` per project conventions.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { loadCorpus, serializeEntryValue } from '../../scripts/tokens/generate.ts';
import {
  buildBaseDocuments,
  buildBaseIndex,
  buildTokenRegistryFromIndexes,
  themeAwarePaths,
} from '../../scripts/tokens/registry.ts';
import { createValueResolver } from '../../scripts/tokens/resolve.ts';
import { readRootTokenValues } from '../test/token-introspection.ts';

const PACKAGE_ROOT = join(import.meta.dir, '..', '..');
const REPO_ROOT = join(PACKAGE_ROOT, '..', '..');
const TOKENS_CSS = join(PACKAGE_ROOT, 'src', 'styles', 'tokens-base.css');
const TOKENS_DOC = join(REPO_ROOT, 'docs', 'tokens.md');
const FOCUS_RING_POLICY_DOC = join(REPO_ROOT, 'docs', 'focus-ring-policy.md');
const THEMING_DOC = join(REPO_ROOT, 'docs', 'theming.md');

/**
 * The corpus's own view of "every base token's `:root` value", built the
 * same way `generate-artifacts.ts` builds it for docs/tokens.md's "Default"
 * column -- `buildBaseIndex` (Stage 4's `baseIndex`, factored out to
 * `registry.ts`) plus a resolver over the same base documents, so a
 * mismatch here means the doc and the corpus disagree, not that this test's
 * own derivation differs from the generator's.
 */
async function readCorpusTokenValues(): Promise<Map<string, string>> {
  const { resolver, documentsByPath } = await loadCorpus();
  const baseIndex = buildBaseIndex(resolver, documentsByPath);
  const baseDocuments = buildBaseDocuments(resolver, documentsByPath);
  const resolveReferences = createValueResolver(baseDocuments);
  const registry = buildTokenRegistryFromIndexes(
    baseIndex,
    themeAwarePaths(resolver, documentsByPath),
  );

  const values = new Map<string, string>();
  for (const entry of registry.entries) {
    const corpusEntry = baseIndex.get(entry.path)!;
    values.set(entry.cssProperty, serializeEntryValue(corpusEntry, baseIndex, resolveReferences));
  }
  return values;
}

function normalizeTokenValue(value: string): string {
  let normalized = '';
  let quote: '"' | "'" | undefined;
  let whitespace = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (quote !== undefined) {
      normalized += character;
      if (character === quote && value[index - 1] !== '\\') quote = undefined;
      continue;
    }
    if (character === '"' || character === "'") {
      if (whitespace && normalized.length > 0) normalized += ' ';
      whitespace = false;
      quote = character;
      normalized += character;
      continue;
    }
    if (/\s/.test(character)) {
      whitespace = true;
      continue;
    }
    if (character === ',' || character === ')') normalized = normalized.trimEnd();
    else if (whitespace && normalized.length > 0 && !/[(),]$/.test(normalized)) normalized += ' ';
    whitespace = false;
    normalized += character;
  }
  return normalized.trim();
}

function extractDocTokens(markdown: string): { duplicates: string[]; tokens: Map<string, string> } {
  // Doc lists tokens as inline code in table rows: `` `--cinder-space-4` ``.
  // We deliberately only count tokens that appear inside backticks at the start
  // of a table cell (i.e. `| \`--cinder-...\``) so that incidental mentions in
  // prose (e.g. "override `--cinder-accent` to re-derive both") don't count.
  const tokens = new Map<string, string>();
  const duplicates: string[] = [];
  // Matches internal `--_cinder-*` tokens as well as public `--cinder-*` ones:
  // the corpus side of this comparison reads every registry entry, and the docs
  // generator emits a row for each, so a narrower pattern here would report a
  // correctly generated internal token as missing from the doc.
  const rowPattern = /^\|\s*`(--_?cinder-[a-z0-9-]+)`\s*\|\s*`([^`]+)`\s*\|/gm;
  for (const match of markdown.matchAll(rowPattern)) {
    if (!match[1] || !match[2]) continue;
    if (tokens.has(match[1])) duplicates.push(match[1]);
    // Undo the generator's Markdown-table pipe escaping before comparing. The
    // generator writes `\|` so GFM does not read the pipe as a column delimiter,
    // while the corpus side holds the raw `|` -- decoding here keeps both sides
    // of this comparison talking about the same value.
    tokens.set(match[1], normalizeTokenValue(match[2].replaceAll('\\|', '|')));
  }
  return { duplicates: duplicates.toSorted(), tokens };
}

describe('docs/tokens.md drift', () => {
  test('documents exactly the tokens declared in the corpus', async () => {
    const [corpusTokens, doc] = await Promise.all([
      readCorpusTokenValues(),
      readFile(TOKENS_DOC, 'utf8'),
    ]);

    const { duplicates, tokens: docTokens } = extractDocTokens(doc);

    // Sanity floor: a parser regression that silently returns a tiny set would
    // otherwise show up as a confusing "missing from corpus: [137 tokens]" diff
    // rather than a clear "the parser broke" signal. The real count sits well
    // above 100; 50 leaves room to delete tokens without lowering this floor.
    expect(corpusTokens.size).toBeGreaterThan(50);
    expect(docTokens.size).toBeGreaterThan(50);

    const missingFromDoc = [...corpusTokens.keys()]
      .filter((token) => !docTokens.has(token))
      .toSorted();
    const missingFromCorpus = [...docTokens.keys()]
      .filter((token) => !corpusTokens.has(token))
      .toSorted();
    const mismatchedValues = [...corpusTokens]
      .flatMap(([token, value]) => {
        const documented = docTokens.get(token);
        return documented === undefined || documented === normalizeTokenValue(value)
          ? []
          : [`${token}: docs=${documented} source=${normalizeTokenValue(value)}`];
      })
      .toSorted();

    expect({ duplicates, missingFromDoc, missingFromCorpus, mismatchedValues }).toEqual({
      duplicates: [],
      missingFromDoc: [],
      missingFromCorpus: [],
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
