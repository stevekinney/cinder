#!/usr/bin/env bun
import { $ } from 'bun';

import {
  error,
  getStagedFiles,
  getTouchedPackages,
  hasRootConfigurationChanges,
  header,
  hookDurationWarning,
  info,
  installHookProcessCleanup,
  isContinuousIntegration,
  loadWorkspacePackages,
  phaseMaxConcurrency,
  readHookDurationBaseline,
  REPO_ROOT,
  runHookCommand,
  runWithConcurrencyPool,
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

// 1) Lockfile sync check (run before any other work so a broken lock doesn't
// pollute later steps).
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
    info('Dependencies changed, installing…');
    const installResult = await runHookCommand('bun', ['install'], {
      cwd: REPO_ROOT,
      stderr: 'inherit',
      stdout: 'inherit',
    });
    if (installResult.exitCode === 0) {
      success('Dependencies installed');
    } else {
      warning('bun install failed; run it manually');
    }
    // bun install may regenerate bun.lock even when the staged copy looked
    // up-to-date. Reject the commit if the working-tree lockfile no longer
    // matches what's staged — otherwise the commit ships a stale lockfile.
    const drift = await $`git diff --name-only -- bun.lock`.cwd(REPO_ROOT).text();
    if (drift.trim().length > 0) {
      error('bun.lock was modified by `bun install`; stage the regenerated lockfile and retry');
      process.exit(1);
    }
  }
}

// 2) Run lint-staged FIRST so formatters write to disk before typecheck
// observes the source.
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

// 3) Recompute staged files (lint-staged may have re-staged formatted files).
const staged = await getStagedFiles();

// 4) Root config escalation → full workspace typecheck.
// Tests are not run at commit time: pre-push runs a properly scoped suite
// (test:changed, dependency-closure aware) and CI runs the full suite, so
// commit only needs to catch type errors fast.
if (hasRootConfigurationChanges(staged)) {
  warning('Root config file staged; escalating to full workspace typecheck');
  info('Running workspace typecheck…');
  const typecheckResult = await runHookCommand('bun', ['run', 'typecheck'], {
    cwd: REPO_ROOT,
    stderr: 'inherit',
    stdout: 'inherit',
  });
  if (typecheckResult.exitCode !== 0) {
    error('typecheck failed');
    error('Pre-commit checks failed');
    process.exit(1);
  }
  success('All pre-commit checks passed');
  process.exit(0);
}

// 5) Scoped per-package typecheck.
// Tests are intentionally not run here — pre-push runs a scoped,
// dependency-closure-aware suite (test:changed) and CI runs the full suite,
// so commit stays fast: lockfile-sync + lint-staged + typecheck only.
const workspace = await loadWorkspacePackages();
const touched = getTouchedPackages(workspace, staged);

if (touched.length === 0) {
  success('No source files staged; skipping typecheck');
  process.exit(0);
}

info(`Touched packages: ${touched.map((p) => p.name).join(', ')}`);

type Job = {
  readonly packageName: string;
  readonly script: 'typecheck';
};

const typecheckJobs: Job[] = [];
for (const pkg of touched) {
  if (pkg.hasTypecheck) {
    typecheckJobs.push({ packageName: pkg.name, script: 'typecheck' });
  } else {
    info(`${pkg.name}: no typecheck script; skipping`);
  }
}

if (typecheckJobs.length === 0) {
  success('No applicable scripts for touched packages; nothing to run');
  process.exit(0);
}

type JobResult = {
  readonly job: Job;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

const start = Date.now();
const elapsed = () => Date.now() - start;

/**
 * Run one `bun run --filter` invocation, capturing output for later display
 * and emitting start/done timestamps so parallel dispatch can be verified
 * mechanically from the hook log.
 */
async function runJob(job: Job): Promise<JobResult> {
  console.log(`[start ${job.packageName} ${job.script}] T+${elapsed()}ms`);
  const result = await runHookCommand('bun', ['run', `--filter=${job.packageName}`, job.script], {
    cwd: REPO_ROOT,
    stderr: 'pipe',
    stdout: 'pipe',
  });
  const exitCode = result.exitCode;
  console.log(`[done ${job.packageName} ${job.script}] T+${elapsed()}ms (exit ${exitCode})`);
  return {
    job,
    exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

/**
 * Run a batch of jobs through a small async pool capped at `maxConcurrency`.
 * Returns the full result list in job-index order.
 *
 * Typecheck is read-only and safe to run in parallel across packages.
 */
async function runJobs(jobs: readonly Job[], maxConcurrency: number): Promise<JobResult[]> {
  return runWithConcurrencyPool(jobs, maxConcurrency, (job) => runJob(job));
}

// Typecheck (read-only — safe to run in parallel).
const typecheckResults = await runJobs(typecheckJobs, phaseMaxConcurrency('typecheck'));

const failures = typecheckResults.filter((r) => r.exitCode !== 0);
if (failures.length > 0) {
  for (const failure of failures) {
    error(`\n--- ${failure.job.packageName} ${failure.job.script} (exit ${failure.exitCode}) ---`);
    if (failure.stdout.trim().length > 0) console.log(failure.stdout);
    if (failure.stderr.trim().length > 0) console.error(failure.stderr);
  }
  error(`Pre-commit checks failed (${failures.length} of ${typecheckResults.length} jobs)`);
  process.exit(1);
}

success(`All pre-commit checks passed (${typecheckResults.length} jobs in ${elapsed()}ms)`);
process.exit(0);
