#!/usr/bin/env bun
import { $ } from 'bun';

import {
  error,
  getStagedFiles,
  getTouchedPackages,
  hasRootConfigurationChanges,
  header,
  info,
  installHookProcessCleanup,
  isContinuousIntegration,
  loadWorkspacePackages,
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

// 2) Run lint-staged FIRST so formatters write to disk before typecheck/test
// observe the source.
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

// 4) Root config escalation → full workspace validate.
if (hasRootConfigurationChanges(staged)) {
  warning('Root config file staged; escalating to full workspace typecheck + test');
  let escalationOk = true;
  try {
    info('Running workspace typecheck…');
    const typecheckResult = await runHookCommand('bun', ['run', 'typecheck'], {
      cwd: REPO_ROOT,
      stderr: 'inherit',
      stdout: 'inherit',
    });
    if (typecheckResult.exitCode !== 0) throw new Error('typecheck failed');
    success('typecheck passed');
  } catch {
    error('typecheck failed');
    escalationOk = false;
  }
  try {
    info('Running workspace test…');
    const testResult = await runHookCommand('bun', ['run', 'test'], {
      cwd: REPO_ROOT,
      stderr: 'inherit',
      stdout: 'inherit',
    });
    if (testResult.exitCode !== 0) throw new Error('test failed');
    success('test passed');
  } catch {
    error('test failed');
    escalationOk = false;
  }
  if (!escalationOk) {
    error('Pre-commit checks failed');
    process.exit(1);
  }
  success('All pre-commit checks passed');
  process.exit(0);
}

// 5) Scoped per-package validate.
const workspace = await loadWorkspacePackages();
const touched = getTouchedPackages(workspace, staged);

if (touched.length === 0) {
  success('No source files staged; skipping typecheck/test');
  process.exit(0);
}

info(`Touched packages: ${touched.map((p) => p.name).join(', ')}`);

type Job = {
  readonly packageName: string;
  readonly script: 'typecheck' | 'test';
};

const jobs: Job[] = [];
for (const pkg of touched) {
  if (pkg.hasTypecheck) {
    jobs.push({ packageName: pkg.name, script: 'typecheck' });
  } else {
    info(`${pkg.name}: no typecheck script; skipping`);
  }
  if (pkg.hasTest) {
    jobs.push({ packageName: pkg.name, script: 'test' });
  } else {
    info(`${pkg.name}: no test script; skipping`);
  }
}

if (jobs.length === 0) {
  success('No applicable scripts for touched packages; nothing to run');
  process.exit(0);
}

type JobResult = {
  readonly job: Job;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

const concurrency = Math.min(navigator.hardwareConcurrency, 4);

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

// Small inline async pool — `concurrency` workers pull jobs off a shared index.
// `results` is keyed by job index so the output order matches the job order
// regardless of worker scheduling.
const results: JobResult[] = [];
let nextIndex = 0;
const workers: Promise<void>[] = [];
for (let workerId = 0; workerId < Math.min(concurrency, jobs.length); workerId++) {
  workers.push(
    (async () => {
      while (true) {
        const index = nextIndex++;
        if (index >= jobs.length) return;
        results[index] = await runJob(jobs[index]!);
      }
    })(),
  );
}
await Promise.all(workers);

const failures = results.filter((r) => r.exitCode !== 0);
if (failures.length > 0) {
  for (const failure of failures) {
    error(`\n--- ${failure.job.packageName} ${failure.job.script} (exit ${failure.exitCode}) ---`);
    if (failure.stdout.trim().length > 0) {
      console.log(failure.stdout);
    }
    if (failure.stderr.trim().length > 0) {
      console.error(failure.stderr);
    }
  }
  error(`Pre-commit checks failed (${failures.length} of ${results.length} jobs)`);
  process.exit(1);
}

success(`All pre-commit checks passed (${results.length} jobs in ${elapsed()}ms)`);
process.exit(0);
