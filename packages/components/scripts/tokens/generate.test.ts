import { describe, expect, test } from 'bun:test';

import {
  buildGeneratedOutputs,
  findDriftedPaths,
  resolvedDirectory,
  tokensBaseCssPath,
} from './generate.ts';

async function readCommitted(paths: Iterable<string>): Promise<Map<string, string | undefined>> {
  const existing = new Map<string, string | undefined>();
  for (const path of paths) {
    existing.set(
      path,
      await Bun.file(path)
        .text()
        .catch(() => undefined),
    );
  }
  return existing;
}

describe('tokens:generate --check', () => {
  test('passes: freshly generated output matches every committed file', async () => {
    const generated = await buildGeneratedOutputs();
    const existing = await readCommitted(generated.keys());

    // Same set of output paths, not just a coincidentally-empty drift list --
    // catches an output silently going missing from the generator as well as
    // a value drifting.
    expect([...generated.keys()].toSorted()).toEqual([
      tokensBaseCssPath,
      ...['dark-reduced-motion', 'dark', 'light-reduced-motion', 'light']
        .map((name) => `${resolvedDirectory}/${name}.json`)
        .toSorted(),
    ]);

    expect(findDriftedPaths(generated, existing)).toEqual([]);
  });

  test('fails: a manual edit to a committed output is rejected', async () => {
    const generated = await buildGeneratedOutputs();
    const existing = await readCommitted(generated.keys());

    // Mutate a COPY of the committed tokens-base.css content in memory --
    // never touches the real file on disk -- so the comparison sees a
    // hand-edited value that no longer matches what the generator produces.
    const mutatedExisting = new Map(existing);
    const committedCss = mutatedExisting.get(tokensBaseCssPath);
    expect(committedCss).toBeDefined();
    expect(committedCss).toContain('--cinder-space-1: 0.25rem;');
    mutatedExisting.set(
      tokensBaseCssPath,
      committedCss!.replace('--cinder-space-1: 0.25rem;', '--cinder-space-1: 999px;'),
    );

    const drifted = findDriftedPaths(generated, mutatedExisting);

    expect(drifted).toEqual([tokensBaseCssPath]);
  });

  test('fails: a resolved-context JSON file edited by hand is rejected', async () => {
    const generated = await buildGeneratedOutputs();
    const existing = await readCommitted(generated.keys());

    const lightPath = `${resolvedDirectory}/light.json`;
    const mutatedExisting = new Map(existing);
    const committedLight = mutatedExisting.get(lightPath);
    expect(committedLight).toBeDefined();
    mutatedExisting.set(lightPath, `${committedLight}\n`);

    expect(findDriftedPaths(generated, mutatedExisting)).toEqual([lightPath]);
  });
});
