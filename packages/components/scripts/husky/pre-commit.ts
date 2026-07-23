#!/usr/bin/env bun
import { $ } from 'bun';

import {
  error,
  getStagedFiles,
  header,
  hookDurationWarning,
  info,
  installHookProcessCleanup,
  isContinuousIntegration,
  readHookDurationBaseline,
  REPO_ROOT,
  runHookCommand,
  success,
  warning,
} from './utilities.ts';

if (isContinuousIntegration()) {
  info('Skipping hook in CI');
  process.exit(0);
}

installHookProcessCleanup();

// Soft duration budget: warns (never fails) when the hook runs slower than the
// committed baseline. Started here, before any real work, so the total elapsed
// time on every exit path — including early returns below — is captured.
const hookStartedAt = Date.now();
const durationBaseline = await readHookDurationBaseline();
if (durationBaseline !== undefined) {
  process.on('exit', () => {
    const message = hookDurationWarning(
      Date.now() - hookStartedAt,
      durationBaseline.preCommitWarnMilliseconds,
      'pre-commit',
    );
    if (message !== null) warning(message);
  });
}

header('Pre-commit checks');

// 1) Lockfile staging check (run before any other work so unstaged lockfile
// drift cannot be committed accidentally).
const stagedForLockCheck = await getStagedFiles();
if (stagedForLockCheck.includes('package.json')) {
  info('package.json is staged');
  if (!stagedForLockCheck.includes('bun.lock')) {
    const bunLockStatus = await $`git status --porcelain -- bun.lock`.cwd(REPO_ROOT).text();
    if (bunLockStatus.trim().length > 0) {
      warning('bun.lock has unstaged changes');
      info('Run bun install and stage bun.lock');
      error('Pre-commit checks failed');
      process.exit(1);
    }
    info('bun.lock unchanged; continuing');
  } else {
    info('bun.lock is staged; CI will verify it with a frozen install');
  }
}

// 2) Run the staged formatting and package-sorting pipeline.
info('Running lint-staged…');
const lintStagedResult = await runHookCommand('bunx', ['lint-staged'], {
  cwd: REPO_ROOT,
  stderr: 'inherit',
  stdout: 'inherit',
});
if (lintStagedResult.exitCode === 0) {
  success('lint-staged passed');
} else {
  error('lint-staged failed');
  process.exit(1);
}

success('All pre-commit checks passed');
process.exit(0);
