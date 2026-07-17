import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadKnownSlugs } from './component-graph.ts';
import { fullSuiteTestPathGroups, parseFullSuiteChunk } from './test-changed.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, '..');
const chunkEnvironmentName = 'CINDER_TEST_FULL_SUITE_CHUNK';

const bunTestFlags = [
  '--conditions',
  'browser',
  '--conditions',
  'svelte',
  '--parallel=1',
  '--coverage',
  '--coverage-reporter=lcov',
] as const;

async function main(): Promise<number> {
  const componentSlugs = [...(await loadKnownSlugs())];
  const groups = fullSuiteTestPathGroups(componentSlugs);
  const selectedChunk = parseFullSuiteChunk(process.env[chunkEnvironmentName], groups.length);

  if (selectedChunk === null) {
    throw new Error(`${chunkEnvironmentName} is required for coverage chunk runs.`);
  }

  const coverageDirectory = `coverage/chunk-${selectedChunk}`;
  rmSync(resolve(packageRoot, coverageDirectory), { force: true, recursive: true });

  process.stderr.write(`run-coverage-chunk: full suite chunk ${selectedChunk}/${groups.length}\n`);

  const result = Bun.spawnSync(
    [
      'bun',
      'test',
      ...bunTestFlags,
      '--coverage-dir',
      coverageDirectory,
      ...groups[selectedChunk - 1]!,
    ],
    {
      cwd: packageRoot,
      env: { ...process.env, TZ: 'UTC', LANG: 'en_US.UTF-8' },
      stderr: 'inherit',
      stdout: 'inherit',
    },
  );

  return result.exitCode;
}

if (import.meta.main) {
  try {
    process.exit(await main());
  } catch (caught) {
    console.error('run-coverage-chunk failed:', caught);
    process.exit(1);
  }
}
