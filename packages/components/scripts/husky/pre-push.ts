#!/usr/bin/env bun
import { $ } from 'bun';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  changedCssLikeFiles,
  changedFilesForRange,
  error,
  expandToDependents,
  formatFailureSummary,
  getTouchedPackages,
  hasRootConfigurationChanges,
  header,
  inferFailureScope,
  info,
  installHookProcessCleanup,
  isContinuousIntegration,
  isIgnorableDoc,
  isSourceFile,
  isUnderWorkspace,
  loadWorkspacePackages,
  parsePushRefs,
  REPO_ROOT,
  runHookCommand,
  success,
  summarizeFailures,
  warning,
  withGateLock,
  writePrePushLog,
  type GateFailure,
  type GitRunner,
  type WorkspacePackage,
} from './utilities.ts';

if (isContinuousIntegration()) {
  info('Skipping hook in CI');
  process.exit(0);
}

// Install descendant-process cleanup so an interrupted push (Ctrl-C) doesn't
// leave orphaned `bun run` children behind.
installHookProcessCleanup();

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

/**
 * Run one `bun run --filter` invocation, capturing output for later display.
 * Routed through `runHookCommand` (not `$`) so an interrupted push tears down
 * descendant processes instead of orphaning them.
 */
async function runJob(job: Job): Promise<JobResult> {
  const result = await runHookCommand('bun', ['run', `--filter=${job.packageName}`, job.script], {
    cwd: REPO_ROOT,
    stderr: 'pipe',
    stdout: 'pipe',
  });
  return {
    job,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

/**
 * The outcome of running a batch of jobs: whether all passed, a per-failed-job
 * summary (for the failure digest), and the concatenated captured output (for
 * the full log written on failure).
 */
type BatchOutcome = {
  readonly ok: boolean;
  readonly failures: readonly GateFailure[];
  readonly output: string;
};

/**
 * Run a batch of jobs through a small async pool, print any failures inline,
 * and return a {@link BatchOutcome} so the caller can render a digest and write
 * the full log.
 *
 * `maxConcurrency` caps the pool; the default is CPU-bound (up to 4). The test
 * phase passes `1` to serialize — see the call site in `runScoped` for why.
 */
async function runJobs(
  jobs: readonly Job[],
  maxConcurrency = Math.max(1, Math.min(navigator.hardwareConcurrency ?? 1, 4)),
): Promise<BatchOutcome> {
  if (jobs.length === 0) return { ok: true, failures: [], output: '' };
  // Floor to a finite integer ≥ 1. A non-finite `maxConcurrency` (e.g. a caller
  // computing `Math.min(navigator.hardwareConcurrency, 4)` where
  // `hardwareConcurrency` is undefined → `NaN`) must NOT slip through: `NaN`
  // would make `Math.min(concurrency, jobs.length)` NaN, start zero workers, and
  // silently pass every job — a false green. `Number.isFinite` rejects NaN and
  // ±Infinity; the `Math.max(1, …)` then guards 0 / negatives.
  const concurrency = Number.isFinite(maxConcurrency) ? Math.max(1, Math.floor(maxConcurrency)) : 1;
  const results: JobResult[] = [];
  let nextIndex = 0;
  const workers: Promise<void>[] = [];
  for (let workerId = 0; workerId < Math.min(concurrency, jobs.length); workerId++) {
    workers.push(
      (async () => {
        while (true) {
          const index = nextIndex++;
          if (index >= jobs.length) return;
          const job = jobs[index];
          if (job === undefined) return; // unreachable given the guard above
          try {
            results[index] = await runJob(job);
          } catch (cause) {
            // `$.nothrow()` means runJob normally won't throw, but a spawn
            // failure (missing binary, OOM) could. Record it as a failed job
            // rather than crashing the whole pool with an unhandled rejection.
            const reason = cause instanceof Error ? cause.message : String(cause);
            results[index] = { job, exitCode: 1, stdout: '', stderr: reason };
          }
        }
      })(),
    );
  }
  await Promise.all(workers);

  let output = '';
  for (const result of results) {
    output += `\n\n===== ${result.job.packageName} ${result.job.script} =====\n\n${result.stdout}${result.stderr}`;
  }

  const failedResults = results.filter((r) => r.exitCode !== 0);
  for (const failure of failedResults) {
    error(`\n--- ${failure.job.packageName} ${failure.job.script} (exit ${failure.exitCode}) ---`);
    if (failure.stdout.trim().length > 0) console.log(failure.stdout);
    if (failure.stderr.trim().length > 0) console.error(failure.stderr);
  }

  // Build a per-failure digest (reusing the shared summarizer) so the caller can
  // print a concise summary alongside the full log path. `script` is the gate
  // kind; the failing package name goes in `scope` so the digest reads e.g.
  // "test failed in cinder".
  const failures = failedResults.map((failure): GateFailure => {
    const combined = `${failure.stdout}\n${failure.stderr}`;
    const inferred = inferFailureScope(combined);
    // `inferFailureScope` returns 'workspace' when it can't pin a package; in the
    // scoped hook we always know the package, so prefer that.
    const scope =
      inferred === 'workspace'
        ? failure.job.packageName
        : `${failure.job.packageName} (${inferred})`;
    return {
      script: failure.job.script,
      scope,
      lines: summarizeFailures(combined),
    };
  });

  return { ok: failedResults.length === 0, failures, output };
}

/**
 * Print the deterministic job-plan block the verification asserts against,
 * ordered by execution phase (lint → typecheck → test) then package name so the
 * printed order matches the order jobs actually run.
 */
function printJobPlan(jobs: readonly Job[]): void {
  info('Planned validation jobs:');
  const phaseRank = (script: Script) => SCRIPTS.indexOf(script);
  const lines = jobs
    .toSorted(
      (a, b) =>
        phaseRank(a.script) - phaseRank(b.script) || a.packageName.localeCompare(b.packageName),
    )
    .map((job) => `  ${job.packageName} ${job.script}`);
  for (const line of lines) console.log(line);
}

/**
 * The current full-suite behavior: run the root `lint`/`typecheck`/`test`
 * scripts (which fan out to every package). Used by the root-config escalation
 * and every fail-safe path. Returns `true` on success; the caller maps the
 * result to an exit code under the gate lock.
 *
 * Stylelint is covered here too: the root `lint` script ends with
 * `&& stylelint "packages/**\/src/**\/*.{css,svelte}"`, so the full path lints
 * styles across the workspace. Only the scoped path needs the separate,
 * file-list `runStylelint`.
 */
async function runFull(): Promise<boolean> {
  info('Planned validation jobs (full suite):');
  for (const script of SCRIPTS) console.log(`  <root> ${script}`);
  let ok = true;
  const failures: GateFailure[] = [];
  for (const script of SCRIPTS) {
    info(`Running ${script}…`);
    // The full-suite path can produce very large output. Stream it directly so
    // Bun never keeps the hook alive waiting on captured pipe readers after the
    // command has exited.
    // NOTE: the root `test` script is `bun run --filter='*' test`, which runs
    // every package's tests concurrently — so the same shared-`dist/` rebuild
    // race the scoped path serializes around (see `runScoped`) can still occur
    // here. The atomic-build-output follow-up is the real fix; this path is
    // taken only on root-config escalation / fail-safe, not routine pushes.
    const result = await runHookCommand('bun', ['run', script], {
      cwd: REPO_ROOT,
      stderr: 'inherit',
      stdout: 'inherit',
    });
    if (result.exitCode === 0) {
      success(`${script} passed`);
    } else {
      error(`${script} failed`);
      failures.push({
        script,
        scope: 'workspace',
        lines: [`bun run ${script} exited with code ${result.exitCode}`],
      });
      ok = false;
    }
  }
  if (!ok) {
    for (const line of formatFailureSummary(failures)) error(line);
    error('Pre-push validation failed.');
    error(
      'Run `bun run lint && bun run typecheck && bun run test`, fix the failures, and push again.',
    );
    return false;
  }
  success('Pre-push validation passed (full suite)');
  return true;
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
  const result = await runHookCommand(stylelintBin, [...files], {
    cwd: REPO_ROOT,
    stderr: 'inherit',
    stdout: 'inherit',
  });
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
  | {
      readonly kind: 'scoped';
      readonly jobs: readonly Job[];
      readonly stylelintFiles: readonly string[];
      /** Pre-rendered "N of M packages" summary for the success line. */
      readonly summary: string;
    };

/** Warn with a reason and fall back to the full suite. */
function failSafe(reason: string): Plan {
  warning(`${reason}; running full suite`);
  return { kind: 'full' };
}

/**
 * Derive what to validate from the push range. Everything that decides *scope*
 * lives here so any failure fails safe to the full suite — a thrown derivation
 * error can never let an untested change through. The caller runs the chosen
 * plan under the gate lock and maps the result to an exit code.
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
      return { kind: 'skip', message: 'Only branch deletions pushed; nothing to validate' };
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

  // Stylelint runs over *every* changed existing CSS/Svelte file in the range,
  // not just those under a touched package. Restricting to touched-package dirs
  // would leave a hole: a changed `.css` outside the detected packages (or a
  // root-level style file) would silently skip stylelint. Per-file stylelint is
  // cheap, so linting the full changed set closes that gap.
  const scopedPackages = new Set(jobs.map((job) => job.packageName)).size;
  const summary = `${scopedPackages} of ${workspace.length} packages validated`;
  return { kind: 'scoped', jobs, stylelintFiles: cssLike, summary };
}

/**
 * Run the scoped plan: print the job plan, then run phases in order
 * (lint → typecheck → test), parallel within a phase and sequential across, so
 * a typecheck failure surfaces before long downstream test runs. Returns `true`
 * on success; the caller maps the result to an exit code under the gate lock.
 */
async function runScoped(
  jobs: readonly Job[],
  stylelintFiles: readonly string[],
  summary: string,
): Promise<boolean> {
  printJobPlan(jobs);

  let ok = true;
  const allFailures: GateFailure[] = [];
  let fullOutput = '';
  for (const script of SCRIPTS) {
    const phaseJobs = jobs.filter((job) => job.script === script);

    if (script === 'lint') {
      const targets = [
        ...phaseJobs.map((job) => job.packageName),
        ...(stylelintFiles.length > 0 ? ['stylelint'] : []),
      ];
      info(`Running lint (${targets.join(', ')})…`);
      const lint = await runJobs(phaseJobs);
      const stylelintOk = await runStylelint(stylelintFiles);
      fullOutput += lint.output;
      allFailures.push(...lint.failures);
      if (!stylelintOk) {
        allFailures.push({ script: 'lint', scope: 'stylelint', lines: [] });
      }
      ok = lint.ok && stylelintOk && ok;
      continue;
    }

    if (phaseJobs.length === 0) continue;
    info(`Running ${script} (${phaseJobs.map((job) => job.packageName).join(', ')})…`);
    // The `test` phase runs serially (concurrency 1). Each package's `test`
    // script runs inline `bun run --filter=<dep> build` steps that `rm -rf dist`
    // and re-emit shared dependency `dist/` dirs (e.g. `@cinder/markdown`,
    // `@cinder/editor`). Run in parallel, two jobs race those writes while a
    // third job's bundler reads the dist mid-write, yielding non-deterministic
    // `error: "<name>" is not declared in this file`. Lint (oxlint) and typecheck
    // (`tsc --noEmit`) are read-only, so they stay parallel.
    const phase = await runJobs(phaseJobs, script === 'test' ? 1 : undefined);
    fullOutput += phase.output;
    allFailures.push(...phase.failures);
    ok = phase.ok && ok;

    if (!ok && script === 'typecheck') {
      // Don't spend minutes on tests when typecheck already failed.
      error('Typecheck failed; skipping the test phase.');
      break;
    }
  }

  if (!ok) {
    const logPath = await writePrePushLog(fullOutput);
    for (const line of formatFailureSummary(allFailures)) error(line);
    error(`Full pre-push output: ${logPath}`);
    error('Pre-push validation failed (scoped).');
    error('Fix the failures above and push again.');
    return false;
  }

  success(`Pre-push validation passed (scoped — ${summary})`);
  return true;
}

const plan = await derivePlan(await Bun.stdin.text(), await loadWorkspacePackages());

// A deletion-only / no-source push does no gate work, so it needs no lock.
if (plan.kind === 'skip') {
  success(plan.message);
  process.exit(0);
}

// Serialize the actual gate execution under a repository-local lock so
// concurrent pushes don't stack validations on top of one another. The chosen
// runner (`runFull`/`runScoped`) renders its own failure digest and writes the
// full log before returning, so the dispatch only maps success to an exit code.
let ok = false;

try {
  ok = await withGateLock(() =>
    plan.kind === 'full' ? runFull() : runScoped(plan.jobs, plan.stylelintFiles, plan.summary),
  );
} catch (caught) {
  error(caught instanceof Error ? caught.message : String(caught));
  process.exit(1);
}

process.exit(ok ? 0 : 1);
