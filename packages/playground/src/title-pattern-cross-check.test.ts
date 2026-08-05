/**
 * Cross-check between the runtime example-title extractor (`example-metadata.ts`)
 * and the build-time gate (`validate-playground.ts`). Both call sites now share
 * a single `TITLE_PATTERN` object exported from `example-metadata.ts` — this
 * file locks that architecture and the shared regex's behavior so a future
 * change to either file is caught immediately instead of surfacing later as a
 * silent rendering mismatch between the dev server and the build gate.
 *
 * The two functions under test do NOT return identical bodies for every input:
 * `extractExampleMetadataFromSource` runs its match through
 * `unescapeStringLiteral()` (decoding `\'`, `\n`, etc.); `readExampleTitle`
 * returns the raw matched body verbatim. What IS shared, and what this file
 * enforces, is that both read the same underlying `TITLE_PATTERN` — so they
 * agree on whether a title was found at all, and on the raw substring matched
 * before either applies its own post-processing.
 */
import { describe, expect, test } from 'bun:test';

import { extractExampleMetadataFromSource, TITLE_PATTERN } from './example-metadata.ts';
import { readExampleTitle } from './validate-playground.ts';

const CASES: Array<{
  name: string;
  source: string;
  expectedBuildGateTitle: string | null;
  expectedRuntimeTitle: string;
}> = [
  {
    name: 'single-quoted',
    source: "export const title = 'Basic usage';",
    expectedBuildGateTitle: 'Basic usage',
    expectedRuntimeTitle: 'Basic usage',
  },
  {
    name: 'double-quoted',
    source: 'export const title = "Basic usage";',
    expectedBuildGateTitle: 'Basic usage',
    expectedRuntimeTitle: 'Basic usage',
  },
  {
    name: 'backtick',
    source: 'export const title = `Basic usage`;',
    expectedBuildGateTitle: 'Basic usage',
    expectedRuntimeTitle: 'Basic usage',
  },
  {
    // Both regexes MATCH the same literal (proving parity of the shared
    // TITLE_PATTERN); the two functions' returned bodies differ because only
    // the runtime extractor decodes escapes — documented, pre-existing,
    // unchanged-by-this-issue behavior. `readExampleTitle` returns the raw
    // matched body verbatim. Verified empirically against the real
    // implementation before writing this case (see PR description).
    name: 'escaped quote inside literal',
    source: "export const title = 'It\\'s basic';",
    expectedBuildGateTitle: "It\\'s basic",
    expectedRuntimeTitle: "It's basic",
  },
  {
    name: 'no title export',
    source: 'export const description = "x";',
    expectedBuildGateTitle: null,
    expectedRuntimeTitle: 'Untitled',
  },
  {
    // Verified empirically: `TITLE_PATTERN` has no awareness of `${…}`
    // interpolation syntax — it matches ANY run of non-backslash characters up
    // to the next same-style quote, so a backtick literal containing `${…}`
    // still matches, with the interpolation captured verbatim as literal text
    // in the body. The source comments in both files calling this
    // "intentionally not supported" describe the AUTHORING convention (titles
    // should be plain literals), not an enforced regex rejection — this issue
    // only shares the existing regex, it does not change what it matches, so
    // the case is asserted against real behavior rather than the aspirational
    // "must not match" description.
    name: 'template literal with interpolation (regex has no awareness of ${…}; matches literally)',
    source: 'export const title = `Count: ${count}`;',
    expectedBuildGateTitle: 'Count: ${count}',
    expectedRuntimeTitle: 'Count: ${count}',
  },
];

describe('title regex cross-check', () => {
  test('TITLE_PATTERN is not global or sticky (safe to share across two independent .match() call sites)', () => {
    expect(TITLE_PATTERN.global).toBe(false);
    expect(TITLE_PATTERN.sticky).toBe(false);
  });

  for (const { name, source, expectedBuildGateTitle, expectedRuntimeTitle } of CASES) {
    test(`${name}: example-metadata.ts and validate-playground.ts agree on whether a title was found`, () => {
      const runtimeTitle = extractExampleMetadataFromSource(source).title;
      const buildGateTitle = readExampleTitle(source);
      expect(buildGateTitle).toBe(expectedBuildGateTitle);
      expect(runtimeTitle).toBe(expectedRuntimeTitle);
      // Parity claim this test actually enforces: the two functions agree on
      // MATCH/NO-MATCH for every case (both null/'Untitled', or both non-null).
      expect(buildGateTitle === null).toBe(
        runtimeTitle === 'Untitled' && expectedBuildGateTitle === null,
      );
    });
  }

  test('exactly one `const TITLE_PATTERN =` definition exists in the package, in example-metadata.ts', async () => {
    const glob = new Bun.Glob('**/*.ts');
    const definitionSites: string[] = [];
    for await (const relativePath of glob.scan({ cwd: import.meta.dirname })) {
      // Exclude this test file's own source — it contains the literal pattern
      // name in prose/comments and would otherwise self-match.
      if (relativePath === 'title-pattern-cross-check.test.ts') continue;
      const text = await Bun.file(`${import.meta.dirname}/${relativePath}`).text();
      if (/\bconst\s+TITLE_PATTERN\s*=/.test(text)) {
        definitionSites.push(relativePath);
      }
    }
    expect(definitionSites).toEqual(['example-metadata.ts']);
  });

  test('validate-playground.ts imports TITLE_PATTERN from example-metadata.ts rather than redefining it', async () => {
    const source = await Bun.file(`${import.meta.dirname}/validate-playground.ts`).text();
    expect(source).toMatch(
      /import\s*\{[^}]*\bTITLE_PATTERN\b[^}]*\}\s*from\s*'\.\/example-metadata\.ts'/,
    );
  });
});
