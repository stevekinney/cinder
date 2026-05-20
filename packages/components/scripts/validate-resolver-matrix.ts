/**
 * Resolver-matrix validation runner.
 *
 * Runs `tsc --noEmit` against the two consumer tsconfigs under
 * `fixtures/resolver-matrix/typescript-consumer/`, one with
 * `moduleResolution: nodenext`, one with `moduleResolution: bundler`. Both
 * must succeed for the new condition ordering (`types`/`svelte`/`node`/`default`)
 * to be considered safe.
 *
 * Exits non-zero on the first failure. Invoked via `bun run validate:resolver-matrix`.
 */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = join(
  scriptDirectory,
  '..',
  'fixtures',
  'resolver-matrix',
  'typescript-consumer',
);

const matrix: Array<{ label: string; tsconfig: string }> = [
  { label: 'nodenext', tsconfig: 'tsconfig.nodenext.json' },
  { label: 'bundler', tsconfig: 'tsconfig.bundler.json' },
];

let failed = false;

for (const { label, tsconfig } of matrix) {
  process.stdout.write(`resolver-matrix [${label}] — tsc --noEmit -p ${tsconfig}\n`);
  // `bunx tsc` resolves to the workspace-pinned TypeScript (declared in
  // packages/components/package.json devDependencies). This matches the
  // existing `typecheck` script's invocation so the resolver matrix always
  // runs through the same compiler version as the rest of CI.
  const result = spawnSync('bunx', ['tsc', '--noEmit', '-p', tsconfig], {
    cwd: fixtureDirectory,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.stderr.write(`resolver-matrix [${label}] — FAILED\n`);
    failed = true;
  } else {
    process.stdout.write(`resolver-matrix [${label}] — OK\n`);
  }
}

if (failed) process.exit(1);
process.stdout.write('resolver-matrix — all OK\n');
