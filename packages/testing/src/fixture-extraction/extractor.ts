import { join } from 'node:path';

import { loadFixtureFile } from './loader.ts';
import type { FixtureExtractResult } from './types.ts';

export async function extractFixtures(componentsRoot: string): Promise<FixtureExtractResult> {
  const glob = new Bun.Glob('**/*-fixtures.ts');
  const entries: FixtureExtractResult['entries'] = [];
  const violations: string[] = [];
  for await (const relativePath of glob.scan({ cwd: componentsRoot })) {
    const result = await loadFixtureFile(join(componentsRoot, relativePath));
    if (result.kind === 'entry') entries.push(result.entry);
    else if (result.kind === 'violations') violations.push(...result.violations);
  }
  return { entries, violations };
}

export async function writeFixtureManifest(
  result: FixtureExtractResult,
  outputPath: string,
): Promise<void> {
  const manifest = {
    entries: result.entries.map(({ componentName, fixtures, metadata }) => ({
      componentName,
      fixtures,
      metadata,
    })),
  };
  await Bun.write(outputPath, JSON.stringify(manifest, null, 2) + '\n');
}
