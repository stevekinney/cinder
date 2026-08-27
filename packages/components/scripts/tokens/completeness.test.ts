/**
 * Completeness assertion: every `--cinder-*`/`--_cinder-*` custom property
 * declared in `tokens-base.css`'s top-level `:root` block has a matching
 * corpus entry, and vice versa.
 *
 * This requirement predates Stage 4 (CIN-30 ticket text): it was written
 * when `tokens-base.css` was still hand-authored and the corpus was a
 * separate, unverified claim about it. Since Stage 4, `tokens-base.css` IS
 * GENERATED from the corpus, and `tokens:check` runs `tokens:generate --
 * --check`, which fails on any diff between the committed file and a fresh
 * generation -- so completeness is already enforced by construction: a
 * corpus token with no `:root` counterpart, or a `:root` declaration with no
 * corpus counterpart, cannot exist in a committed tree that passed
 * `tokens:check`.
 *
 * This test is IMPLEMENTED ANYWAY, as CIN-30 asks, but it is honestly a
 * clearer, faster, more narrowly-scoped restatement of that same guarantee,
 * not a new one:
 *   - It fails with a precise per-property diff instead of `tokens:generate
 *     -- --check`'s file-level "these paths drifted, regenerate" message.
 *   - It runs under plain `bun test` (this file matches the verification
 *     command `bun test --conditions browser --conditions svelte
 *     packages/components/scripts/tokens`), so it also catches the one path
 *     `tokens:generate -- --check` does NOT cover on its own: a change that
 *     runs `bun test` without also running `tokens:check` (e.g. `lint:invariants`
 *     was skipped or a future script starts running package tests standalone).
 *     Every layer that currently runs `bun test` for this package ALSO runs
 *     `lint:invariants` -> `tokens:check` in the same CI job (unit-tests,
 *     main-green), so as wired today this test does not catch anything those
 *     layers miss -- it is genuinely subsumed by `tokens:generate --
 *     --check`, not a stronger guarantee.
 *
 * No new `package.json` script is added for this file -- it is an ordinary
 * test, picked up by the package's `test` script and this ticket's `bun
 * test --conditions browser --conditions svelte packages/components/scripts/tokens`
 * verification command like every other `*.test.ts` in this directory, so
 * there is nothing to register in `check-pipeline-coverage.ts` (that map
 * tracks named `package.json` commands, not individual test files).
 */

import { readFile } from 'node:fs/promises';

import { describe, expect, test } from 'bun:test';

import { readRootTokenNames } from '../../src/test/token-introspection.ts';
import { loadCorpus, tokensBaseCssPath } from './generate.ts';
import { buildBaseIndex } from './registry.ts';

describe('tokens-base.css / corpus completeness', () => {
  test('every :root declaration has a matching corpus entry, and vice versa', async () => {
    const [css, { resolver, documentsByPath }] = await Promise.all([
      readFile(tokensBaseCssPath, 'utf8'),
      loadCorpus(),
    ]);

    const cssPropertyNames = readRootTokenNames(css);
    const baseIndex = buildBaseIndex(resolver, documentsByPath);
    const corpusPropertyNames = new Set(
      [...baseIndex.values()]
        .map((entry) => entry.cssProperty)
        .filter((name): name is string => typeof name === 'string'),
    );

    expect(cssPropertyNames.size).toBeGreaterThan(50);
    expect(corpusPropertyNames.size).toBeGreaterThan(50);

    const declaredWithoutCorpusEntry = [...cssPropertyNames]
      .filter((name) => !corpusPropertyNames.has(name))
      .toSorted();
    const corpusEntryWithoutDeclaration = [...corpusPropertyNames]
      .filter((name) => !cssPropertyNames.has(name))
      .toSorted();

    expect({ declaredWithoutCorpusEntry, corpusEntryWithoutDeclaration }).toEqual({
      declaredWithoutCorpusEntry: [],
      corpusEntryWithoutDeclaration: [],
    });
  });
});
