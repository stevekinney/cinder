#!/usr/bin/env bun
import { $ } from 'bun';

import {
  error,
  getStagedFiles,
  header,
  info,
  isContinuousIntegration,
  success,
  warning,
} from './utilities.ts';

if (isContinuousIntegration()) {
  info('Skipping hook in CI');
  process.exit(0);
}

header('Pre-commit checks');
let ok = true;

// 1) package/lock checks
const staged = await getStagedFiles();
if (staged.includes('package.json')) {
  info('package.json is staged');
  if (!staged.includes('bun.lock')) {
    const bunLockStatus = await $`git status --porcelain -- bun.lock`.text();
    if (bunLockStatus.trim().length > 0) {
      warning('bun.lock has unstaged changes');
      info('Run bun install and stage bun.lock');
      ok = false;
    } else {
      info('bun.lock unchanged; continuing');
    }
  } else {
    info('Dependencies changed, installing…');
    try {
      await $`bun install`;
      success('Dependencies installed');
    } catch {
      warning('bun install failed; run it manually');
    }
  }
}

// 2) lint:fix
info('Running lint:fix…');
try {
  await $`bun run lint:fix`;
  success('lint:fix passed');
} catch {
  error('lint:fix failed');
  ok = false;
}

// 3) typecheck
info('Running typecheck…');
try {
  await $`bun run typecheck`;
  success('typecheck passed');
} catch {
  error('typecheck failed');
  ok = false;
}

// 4) test
info('Running test…');
try {
  await $`bun run test`;
  success('test passed');
} catch {
  error('test failed');
  ok = false;
}

// 5) lint-staged (format staged files; always last)
info('Running lint-staged…');
try {
  await $`bun exec lint-staged`;
  success('Lint-staged passed');
} catch {
  error('Lint-staged failed');
  ok = false;
}

if (!ok) {
  error('Pre-commit checks failed');
  process.exit(1);
}

success('All pre-commit checks passed');

process.exit(0);
