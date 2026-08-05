import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, test } from 'bun:test';

import { main } from './generate-readme-usage-examples.mjs';

const testFixturesRoot = join(import.meta.dir, 'test-fixtures', 'readme-usage-examples');

const outputDirectories: string[] = [];
afterEach(() => {
  while (outputDirectories.length > 0) {
    rmSync(outputDirectories.pop()!, { recursive: true, force: true });
  }
});

function makeTemporaryOutputDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'cinder-readme-usage-examples-'));
  outputDirectories.push(directory);
  return directory;
}

describe('generate-readme-usage-examples main()', () => {
  test('returns exactly the three expected failures and no entry for the valid fixture', async () => {
    const outputDirectory = makeTemporaryOutputDirectory();

    const { failures } = await main(testFixturesRoot, outputDirectory);

    expect(failures).toEqual(
      expect.arrayContaining([
        { componentId: 'no-heading-component', reason: 'no-heading' },
        { componentId: 'no-fence-component', reason: 'no-fence' },
        { componentId: 'no-matching-tag-component', reason: 'no-matching-tag' },
      ]),
    );
    expect(failures).toHaveLength(3);
    expect(failures.find((failure) => failure.componentId === 'valid-component')).toBeUndefined();
  });

  test('writes the valid fixture output file with the fence body verbatim', async () => {
    const outputDirectory = makeTemporaryOutputDirectory();

    await main(testFixturesRoot, outputDirectory);

    const outputPath = join(outputDirectory, 'valid-component.svelte');
    expect(existsSync(outputPath)).toBe(true);
    expect(readFileSync(outputPath, 'utf8')).toBe(
      [
        '<script lang="ts">',
        "  import ValidComponent from '@lostgradient/cinder/valid-component';",
        '</script>',
        '',
        '<ValidComponent label="Example" />',
      ].join('\n'),
    );
  });

  test('produces no output file for any of the three broken fixtures', async () => {
    const outputDirectory = makeTemporaryOutputDirectory();

    await main(testFixturesRoot, outputDirectory);

    expect(existsSync(join(outputDirectory, 'no-heading-component.svelte'))).toBe(false);
    expect(existsSync(join(outputDirectory, 'no-fence-component.svelte'))).toBe(false);
    expect(existsSync(join(outputDirectory, 'no-matching-tag-component.svelte'))).toBe(false);
  });
});
