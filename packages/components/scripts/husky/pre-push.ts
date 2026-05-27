#!/usr/bin/env bun
import { $ } from 'bun';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  changedCssLikeFiles,
  changedFilesForRange,
  error,
  expandToDependents,
  getTouchedPackages,
  type GitRunner,
  hasRootConfigurationChanges,
  header,
  info,
  isContinuousIntegration,
  isIgnorableDoc,
  isSourceFile,
  isUnderWorkspace,
  loadWorkspacePackages,
  parsePushRefs,
  REPO_ROOT,
  success,
  warning,
  type WorkspacePackage,
} from './utilities.ts';

if (isContinuousIntegration()) {
  info('Skipping hook in CI');
  process.exit(0);
}

const SCRIPTS = ['lint', 'typecheck', 'test'] as const;
type Script = (typeof SCRIPTS)[number];

type Job = {
  readonly packageName: string;
  readonly script: Script;
};

type JobResult = {
  readonly job: Job;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

/** Real git operations, backed by `git` in the repo root. */
const git: GitRunner = {
  async mergeBase(a, b) {
    const result = await $`git merge-base ${a} ${b}`.cwd(REPO_ROOT).nothrow().quiet();
    if (result.exitCode !== 0) {
      throw new Error(`git merge-base ${a} ${b} failed (exit ${result.exitCode})`);
    }
    const sha = result.stdout.toString().trim();
    if (sha.length === 0) throw new Error(`git merge-base ${a} ${b} produced no output`);
    return sha;
  },
  async isAncestor(ancestor, descendant) {
    const result = await $`git merge-base --is-ancestor ${ancestor} ${descendant}`
      .cwd(REPO_ROOT)
      .nothrow()
      .quiet();
    // 0 = ancestor, 1 = not an ancestor. Any other code is an error worth
    // surfacing as a throw so the caller falls back to the full suite.
    if (result.exitCode === 0) return true;
    if (result.exitCode === 1) return false;
    throw new Error(`git merge-base --is-ancestor failed (exit ${result.exitCode})`);
  },
  async diffNames(range) {
    const out = await $`git diff --name-only ${range}`.cwd(REPO_ROOT).text();
    return out.split('\n').filter(Boolean);
  },
  async diffNameStatus(range) {
    const out = await $`git diff --name-status ${range}`.cwd(REPO_ROOT).text();
    return out.split('\n').filter(Boolean);
  },
};

/** Run one `bun run --filter` invocation, capturing output for later display. */
async function runJob(job: Job): Promise<JobResult> {
  const result = await $`bun run --filter=${job.packageName} ${job.script}`
    .cwd(REPO_ROOT)
    .nothrow()
    .quiet();
  return {
    job,
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

/**
 * Run a batch of jobs through a small async pool, then report any failures.
 * Returns `true` when every job in the batch succeeded.
 */
async function runJobs(jobs: readonly Job[]): Promise<boolean> {
  if (jobs.length === 0) return true;
  const concurrency = Math.min(navigator.hardwareConcurrency, 4);
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
  for (const failure of failures) {
    error(`\n--- ${failure.job.packageName} ${failure.job.script} (exit ${failure.exitCode}) ---`);
    if (failure.stdout.trim().length > 0) console.log(failure.stdout);
    if (failure.stderr.trim().length > 0) console.error(failure.stderr);
  }
  return failures.length === 0;
}

/** Print the deterministic, sorted job-plan block the verification asserts against. */
function printJobPlan(jobs: readonly Job[]): void {
  info('Planned validation jobs:');
  const lines = jobs.map((job) => `  ${job.packageName} ${job.script}`).toSorted();
  for (const line of lines) console.log(line);
}

/**
 * The current full-suite behavior: run the root `lint`/`typecheck`/`test`
 * scripts (which fan out to every package). Used by the root-config escalation
 * and every fail-safe path. Exits the process directly.
 */
async function runFull(): Promise<never> {
  info('Planned validation jobs (full suite):');
  for (const script of SCRIPTS) console.log(`  <root> ${script}`);
  let ok = true;
  for (const script of SCRIPTS) {
    info(`Running ${script}…`);
    try {
      await $`bun run ${script}`.cwd(REPO_ROOT);
      success(`${script} passed`);
    } catch {
      error(`${script} failed`);
      ok = false;
    }
  }
  if (!ok) {
    error('Pre-push validation failed.');
    error(
      'Run `bun run lint && bun run typecheck && bun run test`, fix the failures, and push again.',
    );
    process.exit(1);
  }
  success('Pre-push validation passed (full suite)');
  process.exit(0);
}

/** Run stylelint over an explicit, existing file list. Returns success. */
async function runStylelint(files: readonly string[]): Promise<boolean> {
  if (files.length === 0) {
    info('Planned stylelint files: none (no changed CSS/Svelte in scope)');
    return true;
  }
  info('Planned stylelint files:');
  for (const file of [...files].toSorted()) console.log(`  ${file}`);
  // Resolve the locally installed binary the same way the root lint script
  // does, rather than a network-capable runner, so the hook can never pull a
  // different stylelint than the pinned dev dependency.
  const stylelintBin = join(REPO_ROOT, 'node_modules', '.bin', 'stylelint');
  if (!existsSync(stylelintBin)) {
    throw new Error(`local stylelint binary not found at ${stylelintBin}`);
  }
  const result = await $`${stylelintBin} ${files}`.cwd(REPO_ROOT).nothrow();
  if (result.exitCode !== 0) {
    error(`stylelint failed (exit ${result.exitCode})`);
    return false;
  }
  return true;
}

header('Pre-push: scoped lint + typecheck + test (push range)');

type Plan =
  | { readonly kind: 'skip'; readonly message: string }
  | { readonly kind: 'full' }
  | { readonly kind: 'scoped'; readonly jobs: Job[]; readonly stylelintFiles: string[] };

/** Warn with a reason, then run the full suite and exit. */
async function failSafe(reason: string): Promise<never> {
  warning(`${reason}; running full suite`);
  return runFull();
}

/**
 * Derive what to validate from the push range. Everything that decides *scope*
 * lives here so any failure fails safe to the full suite — `failSafe`/`runFull`
 * never return, so a thrown derivation error can never let an untested change
 * through. The actual gate executions happen in the caller, where a non-zero
 * exit is a real failure to surface, not a derivation error to escalate.
 */
async function derivePlan(
  stdinText: string,
  workspace: readonly WorkspacePackage[],
): Promise<Plan> {
  let parsed;
  try {
    parsed = parsePushRefs(stdinText);
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    return failSafe(`Could not parse push refs (${reason})`);
  }

  if (parsed.updates.length === 0) {
    if (parsed.deletionCount > 0) {
      success('Only branch deletions pushed; nothing to validate');
      process.exit(0);
    }
    return failSafe('No push refs on stdin (or hook run by hand without piped refs)');
  }

  let changed: Set<string>;
  let cssLike: string[];
  try {
    changed = await changedFilesForRange(parsed.updates, git);
    cssLike = await changedCssLikeFiles(parsed.updates, git, (path) =>
      existsSync(join(REPO_ROOT, path)),
    );
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    return failSafe(`Could not derive push scope (${reason})`);
  }

  if (hasRootConfigurationChanges([...changed])) {
    warning('Root configuration file changed; escalating to full workspace validation');
    return { kind: 'full' };
  }

  const touched = getTouchedPackages(workspace, [...changed]);

  if (touched.length === 0) {
    const inPackageUnclassified = [...changed].filter(
      (path) =>
        isUnderWorkspace(path, workspace) &&
        !isSourceFile(path) &&
        !isIgnorableDoc(path, workspace),
    );
    if (inPackageUnclassified.length > 0) {
      warning(
        `Unclassified in-package change(s); escalating to full suite: ${inPackageUnclassified.join(', ')}`,
      );
      return { kind: 'full' };
    }
    return { kind: 'skip', message: 'No source changes in push range; skipping gates' };
  }

  const touchedNames = touched.map((pkg) => pkg.name);
  const byName = new Map(workspace.map((pkg) => [pkg.name, pkg] as const));

  const jobs: Job[] = [];
  // Lint is scoped naively — oxlint does not cross package boundaries.
  for (const pkg of touched) {
    if (pkg.hasLint) jobs.push({ packageName: pkg.name, script: 'lint' });
  }
  // Typecheck/test expand to the reverse-dependency closure: a change can break
  // a dependent without failing its own gates.
  const closure = expandToDependents(workspace, touchedNames);
  for (const name of closure) {
    const pkg = byName.get(name);
    if (pkg === undefined) continue;
    if (pkg.hasTypecheck) jobs.push({ packageName: name, script: 'typecheck' });
    if (pkg.hasTest) jobs.push({ packageName: name, script: 'test' });
  }

  const touchedDirs = touched.map((pkg) => pkg.dir.replace(/\/$/, ''));
  const stylelintFiles = cssLike.filter((path) =>
    touchedDirs.some((dir) => path === dir || path.startsWith(`${dir}/`)),
  );

  return { kind: 'scoped', jobs, stylelintFiles };
}

/**
 * Run the scoped plan: print the job plan, then run phases in order
 * (lint → typecheck → test), parallel within a phase and sequential across, so
 * a typecheck failure surfaces before long downstream test runs. Exits the
 * process directly.
 */
async function runScoped(jobs: readonly Job[], stylelintFiles: readonly string[]): Promise<never> {
  printJobPlan(jobs);

  let ok = true;
  for (const script of SCRIPTS) {
    const phaseJobs = jobs.filter((job) => job.script === script);

    if (script === 'lint') {
      const lintOk = await runJobs(phaseJobs);
      const stylelintOk = await runStylelint(stylelintFiles);
      ok = lintOk && stylelintOk && ok;
      continue;
    }

    if (phaseJobs.length === 0) continue;
    info(`Running ${script} (${phaseJobs.map((job) => job.packageName).join(', ')})…`);
    const phaseOk = await runJobs(phaseJobs);
    ok = phaseOk && ok;

    if (!ok && script === 'typecheck') {
      // Don't spend minutes on tests when typecheck already failed.
      error('Typecheck failed; skipping the test phase.');
      break;
    }
  }

  if (!ok) {
    error('Pre-push validation failed (scoped).');
    error('Fix the failures above and push again.');
    process.exit(1);
  }

  success('Pre-push validation passed (scoped)');
  process.exit(0);
}

const plan = await derivePlan(await Bun.stdin.text(), await loadWorkspacePackages());

switch (plan.kind) {
  case 'skip':
    success(plan.message);
    process.exit(0);
  case 'full':
    await runFull();
    break;
  case 'scoped':
    await runScoped(plan.jobs, plan.stylelintFiles);
    break;
}
