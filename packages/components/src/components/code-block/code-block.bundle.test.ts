/**
 * What a consumer's bundle carries when it renders `<CodeBlock>`.
 *
 * Each fixture imports `CodeBlock` from `@lostgradient/cinder`'s root entry and
 * is built the way a plain consumer would build it: a browser target with code
 * splitting and no import optimizer. The test then reads which Shiki grammar
 * and theme modules landed in the emitted output, by the `inputs` keys of every
 * entry in the build metafile's `outputs`.
 *
 * `CodeBlock` must reach no highlighter of its own. A consumer that passes a
 * highlighter registering one grammar and one theme ships exactly those two
 * modules, and a consumer that passes none ships no grammar and no theme. A
 * default highlighter reachable from `CodeBlock`, even behind a lazy
 * `import()`, makes the bundler emit all of Shiki's grammars and themes as
 * chunks, which is the cost these assertions exist to catch.
 *
 * Both builds start at module load, together, so their compile time is not
 * charged to any one test.
 */

import { resolve } from 'node:path';

import { sveltePlugin } from '@lostgradient/testing';
import { describe, expect, test } from 'bun:test';

const FIXTURES = resolve(import.meta.dir, '../../test/fixtures');
const GRAMMAR_MODULE = /@shikijs\/langs\/dist\/([^/]+)\.mjs$/;
const THEME_MODULE = /@shikijs\/themes\/dist\/([^/]+)\.mjs$/;

type BundledShikiModules = { grammars: string[]; themes: string[] };

function namesMatching(paths: readonly string[], pattern: RegExp): string[] {
  const names = new Set<string>();
  for (const path of paths) {
    const name = pattern.exec(path)?.[1];
    if (name !== undefined) names.add(name);
  }
  return [...names].toSorted();
}

async function buildFixture(fixture: string): Promise<BundledShikiModules> {
  const result = await Bun.build({
    entrypoints: [resolve(FIXTURES, fixture)],
    target: 'browser',
    format: 'esm',
    conditions: ['browser', 'svelte'],
    splitting: true,
    metafile: true,
    plugins: [sveltePlugin({ generate: 'client', injectCss: true })],
  });
  if (!result.success) throw new AggregateError(result.logs, `${fixture} failed to build`);
  if (result.metafile === undefined) throw new Error(`${fixture} emitted no metafile`);
  const emittedInputs = Object.values(result.metafile.outputs).flatMap((output) =>
    Object.keys(output.inputs),
  );
  return {
    grammars: namesMatching(emittedInputs, GRAMMAR_MODULE),
    themes: namesMatching(emittedInputs, THEME_MODULE),
  };
}

const [explicitHighlighter, noHighlighter] = await Promise.all([
  buildFixture('code-block-bundle-explicit-highlighter.ts'),
  buildFixture('code-block-bundle-no-highlighter.ts'),
]);

describe('CodeBlock — what a consumer bundle carries', () => {
  test('an explicit highlighter registering json and github-light bundles exactly that grammar and theme', () => {
    expect(explicitHighlighter.grammars).toEqual(['json']);
    expect(explicitHighlighter.themes).toEqual(['github-light']);
  });

  test('no highlighter bundles no grammar and no theme', () => {
    expect(noHighlighter.grammars).toEqual([]);
    expect(noHighlighter.themes).toEqual([]);
  });
});
