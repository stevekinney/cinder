import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, expect, it } from 'bun:test';

import { loadFixtureFile } from './loader.ts';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

it('loads a static fixture file through the Node filesystem boundary', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'visual-fixture-loader-test-'));
  temporaryDirectories.push(directory);
  const fixtureDirectory = join(directory, 'chat');
  const fixturePath = join(fixtureDirectory, 'chat-fixtures.ts');
  mkdirSync(fixtureDirectory);
  writeFileSync(fixturePath, "export default [{ name: 'private-harness', props: {} }];\n", 'utf8');

  const fixtureFile = await loadFixtureFile(fixturePath);
  expect(fixtureFile?.fixtures[0]?.name).toBe('private-harness');
});

it('loads and hashes a host fixture through the Node filesystem boundary', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'visual-fixture-loader-test-'));
  temporaryDirectories.push(directory);
  const fixtureDirectory = join(directory, 'chat');
  const fixturePath = join(fixtureDirectory, 'chat-fixtures.ts');
  mkdirSync(fixtureDirectory);
  writeFileSync(
    fixturePath,
    "export default [{ name: 'private-harness', props: {}, host: './private-harness.fixture.svelte' }];\n",
    'utf8',
  );
  writeFileSync(
    join(fixtureDirectory, 'private-harness.fixture.svelte'),
    '<div>Fixture</div>\n',
    'utf8',
  );

  const fixtureFile = await loadFixtureFile(fixturePath);
  expect(fixtureFile?.contentHash).toMatch(/^[a-f0-9]{64}$/);
});
