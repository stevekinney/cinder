#!/usr/bin/env bun
// next.ts — single-task → merged-PR pipeline driver.
//
// Pulls the next available task from `tasks next`, drafts a plan if missing,
// drives a worktree-isolated `claude -p` agent through commit →
// committee-review → PR → address-pr → merge, then marks the task complete.
//
// Usage:
//   bun scripts/next.ts                    # run one task to completion
//   bun scripts/next.ts --concurrency 3    # run 3 tasks in parallel
//   bun scripts/next.ts --help

import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

// =============================================================================
// Colors — Bun.color makes everything sparkle
// =============================================================================

const colorsEnabled = process.stderr.isTTY && !process.env.NO_COLOR;
const reset = '\x1b[0m';

function paint(name: string, text: string): string {
  if (!colorsEnabled) return text;
  const ansi = Bun.color(name, 'ansi');
  return ansi ? `${ansi}${text}${reset}` : text;
}

const palette = {
  task: (s: string) => paint('#a78bfa', s),
  phase: (s: string) => paint('#38bdf8', s),
  ok: (s: string) => paint('#22c55e', s),
  warn: (s: string) => paint('#fbbf24', s),
  err: (s: string) => paint('#ef4444', s),
  dim: (s: string) => paint('#94a3b8', s),
  bold: (s: string) => (colorsEnabled ? `\x1b[1m${s}${reset}` : s),
  heading: (s: string) => paint('#f97316', s),
  worker: (n: number) => {
    const wheel = ['#f472b6', '#34d399', '#60a5fa', '#fbbf24', '#a78bfa', '#fb7185'];
    return (s: string) => paint(wheel[n % wheel.length]!, s);
  },
};

// =============================================================================
// Logging
// =============================================================================

type LogLevel = 'INFO' | 'PHASE' | 'WARN' | 'ERROR' | 'TASK' | 'OK';

const levelPainter: Record<LogLevel, (s: string) => string> = {
  INFO: palette.dim,
  PHASE: palette.phase,
  WARN: palette.warn,
  ERROR: palette.err,
  TASK: palette.task,
  OK: palette.ok,
};

let logPrefix = '';

function log(level: LogLevel, message: string): void {
  const timestamp = new Date().toISOString().slice(11, 19);
  const stamp = palette.dim(`[${timestamp}]`);
  const tag = palette.bold(levelPainter[level](`[${level}]`));
  const prefix = logPrefix ? `${logPrefix} ` : '';
  process.stderr.write(`${stamp} ${prefix}${tag} ${message}\n`);
}

// =============================================================================
// Subprocess helpers
// =============================================================================

const activeChildren = new Set<ReturnType<typeof Bun.spawn>>();
const activeWorktrees = new Set<string>();

type RunOptions = {
  cwd?: string;
  stdin?: string;
  env?: Record<string, string>;
  /**
   * When true, tee the child's stdout and stderr to our own stderr in real
   * time so the operator isn't flying blind during a long-running command.
   * The captured strings are still returned. Default: false (silent capture).
   */
  tee?: boolean;
};

type RunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

async function run(args: string[], options: RunOptions = {}): Promise<RunResult> {
  const child = Bun.spawn(args, {
    cwd: options.cwd ?? process.cwd(),
    stdin: options.stdin === undefined ? 'ignore' : 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
    env: options.env ?? process.env,
  });
  activeChildren.add(child);

  if (options.stdin !== undefined && child.stdin) {
    child.stdin.write(options.stdin);
    await child.stdin.end();
  }

  try {
    if (options.tee) {
      // Stream both pipes to our stderr while accumulating into strings.
      // Both pipes must be drained concurrently — serial reads deadlock once
      // either pipe buffer fills.
      const decoderOut = new TextDecoder();
      const decoderErr = new TextDecoder();
      let stdout = '';
      let stderr = '';
      const drainOut = (async () => {
        for await (const chunk of child.stdout) {
          const text = decoderOut.decode(chunk, { stream: true });
          process.stderr.write(text);
          stdout += text;
        }
        stdout += decoderOut.decode();
      })();
      const drainErr = (async () => {
        for await (const chunk of child.stderr) {
          const text = decoderErr.decode(chunk, { stream: true });
          process.stderr.write(text);
          stderr += text;
        }
        stderr += decoderErr.decode();
      })();
      await Promise.all([drainOut, drainErr]);
      const exitCode = await child.exited;
      return { exitCode, stdout, stderr };
    }
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    return { exitCode, stdout, stderr };
  } finally {
    activeChildren.delete(child);
  }
}

async function runOk(args: string[], options: RunOptions = {}): Promise<string> {
  const result = await run(args, options);
  if (result.exitCode !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit ${result.exitCode}`;
    throw new Error(`Command failed: ${args.join(' ')}\n${detail}`);
  }
  return result.stdout;
}

/** Sugar: run a command with tee output and throw on non-zero. */
async function runOkVisible(args: string[], options: RunOptions = {}): Promise<string> {
  return runOk(args, { ...options, tee: true });
}

async function runStreaming(
  args: string[],
  options: RunOptions = {},
): Promise<{ exitCode: number; captured: string }> {
  const child = Bun.spawn(args, {
    cwd: options.cwd ?? process.cwd(),
    stdin: options.stdin === undefined ? 'ignore' : 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
    env: options.env ?? process.env,
  });
  activeChildren.add(child);

  if (options.stdin !== undefined && child.stdin) {
    child.stdin.write(options.stdin);
    await child.stdin.end();
  }

  const decoder = new TextDecoder();
  let captured = '';

  const drainStdout = (async () => {
    for await (const chunk of child.stdout) {
      const text = decoder.decode(chunk, { stream: true });
      process.stderr.write(text);
      captured += text;
    }
    captured += decoder.decode();
  })();

  const stderrDecoder = new TextDecoder();
  const drainStderr = (async () => {
    for await (const chunk of child.stderr) {
      process.stderr.write(stderrDecoder.decode(chunk, { stream: true }));
    }
  })();

  try {
    await Promise.all([drainStdout, drainStderr]);
    const exitCode = await child.exited;
    return { exitCode, captured };
  } finally {
    activeChildren.delete(child);
  }
}

// =============================================================================
// Tasks CLI wrappers
// =============================================================================

type Task = {
  id: string;
  title: string;
  status: string;
  description?: string;
  plan?: string | null;
  branch?: string | null;
  createdAt?: string;
  lastModifiedAt?: string;
};

type ProgressEntry = {
  message: string;
  createdAt?: string;
  provider?: string | null;
  session?: string | null;
};

/**
 * Read the next ready task from the local tasks CLI.
 *
 * `tasks next` prints either a JSON object on stdout (with diagnostics on
 * stderr) or no stdout at all when the queue is empty. We tolerate leading
 * whitespace / blank lines but treat any non-JSON content as a parse error
 * with the raw stdout surfaced so the operator can debug.
 */
async function fetchNextTask(): Promise<Task | null> {
  const result = await run(['tasks', 'next']);
  if (result.exitCode !== 0) {
    throw new Error(
      `tasks next failed (exit ${result.exitCode}):\n${result.stderr.trim() || result.stdout.trim()}`,
    );
  }
  const trimmed = result.stdout.trim();
  if (!trimmed) return null;

  // Defensive: locate the first '{' to ignore any accidental warning prefix.
  const start = trimmed.indexOf('{');
  if (start === -1) {
    throw new Error(`tasks next returned non-JSON output:\n${trimmed}`);
  }
  try {
    return JSON.parse(trimmed.slice(start)) as Task;
  } catch (error) {
    throw new Error(
      `tasks next emitted invalid JSON: ${(error as Error).message}\nRaw output:\n${trimmed}`,
    );
  }
}

async function getTask(id: string): Promise<Task> {
  const result = await runOk(['tasks', 'get', id]);
  return JSON.parse(result.trim()) as Task;
}

async function setStatus(
  id: string,
  status: 'in-progress' | 'in-review' | 'completed' | 'ready',
): Promise<void> {
  await runOk(['tasks', 'set-status', id, status]);
}

async function setBranch(id: string, branch: string): Promise<void> {
  await runOk(['tasks', 'set-branch', id, branch]);
}

async function clearBranch(id: string): Promise<void> {
  await runOk(['tasks', 'clear-branch', id]);
}

async function addProgress(id: string, message: string): Promise<void> {
  await runOk(['tasks', 'add-progress', id, '--message', message]);
}

/**
 * Fetch progress entries for a task. Returns [] on parse failure (the CLI
 * may print a header line + JSON or pure JSON depending on version; we
 * tolerate both).
 */
async function getProgress(id: string): Promise<ProgressEntry[]> {
  const result = await run(['tasks', 'progress', id]);
  if (result.exitCode !== 0) return [];
  const trimmed = result.stdout.trim();
  if (!trimmed) return [];
  const start = trimmed.indexOf('[');
  if (start === -1) return [];
  try {
    return JSON.parse(trimmed.slice(start)) as ProgressEntry[];
  } catch {
    return [];
  }
}

async function listAllTasks(): Promise<Task[]> {
  const result = await runOk(['tasks', 'list', '--all']);
  const trimmed = result.trim();
  if (!trimmed) return [];
  const start = trimmed.indexOf('[');
  if (start === -1) return [];
  try {
    return JSON.parse(trimmed.slice(start)) as Task[];
  } catch (error) {
    throw new Error(`tasks list emitted invalid JSON`, { cause: error });
  }
}

/** Deterministic branch name derived from a task id. Single source of truth. */
function taskBranchName(taskId: string): string {
  return `next/${taskId.slice(0, 8)}`;
}

// =============================================================================
// Atomic task claim — file-based lock
//
// The `tasks` CLI has no atomic claim operation. With multiple workers,
// `tasks next` + `tasks set-status` is a TOCTOU race: two workers can read
// the same ready task before either has marked it in-progress.
//
// We close that race with a per-task lock directory under
// `tmp/next-locks/<task-id>/`. `mkdir` is atomic on POSIX — it either
// creates the directory or fails with EEXIST. Whichever worker wins the
// mkdir owns the task; losers re-call `tasks next` to try another task.
//
// The lock file inside the directory records the owning PID + ISO
// timestamp so an operator can audit stuck locks. Stale locks (older than
// LOCK_STALE_MS where the PID is no longer alive) are reaped on claim.
// =============================================================================

const LOCK_STALE_MS = 6 * 60 * 60 * 1000; // 6 hours
const heldLocks = new Set<string>();

function lockDirectory(taskId: string): string {
  return join(repoRoot, 'tmp', 'next-locks', taskId);
}

/** True when the PID is still alive on this machine. */
function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * Drop a stale lock if its owning process is dead or the lock is older than
 * LOCK_STALE_MS. Returns true if a stale lock was reaped (and the caller
 * should retry the claim).
 */
function reapStaleLock(directory: string): boolean {
  const metaPath = join(directory, 'owner.json');
  if (!existsSync(metaPath)) {
    // Lock dir exists but no metadata — treat as stale.
    try {
      rmSync(directory, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }
  try {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as { pid: number; claimedAt: string };
    const ageMs = Date.now() - new Date(meta.claimedAt).getTime();
    const stale = !pidAlive(meta.pid) || ageMs > LOCK_STALE_MS;
    if (stale) {
      log('WARN', `Reaping stale lock (pid ${meta.pid}, age ${Math.round(ageMs / 1000)}s)`);
      rmSync(directory, { recursive: true, force: true });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Lower-level lock primitive — acquires the lock directory only. No task-status
 * logic. Used by recovery actions on tasks in `in-progress` / `in-review`, and
 * composed by `tryClaimTask` for the normal ready-task claim path.
 */
function acquireTaskLock(taskId: string): boolean {
  const directory = lockDirectory(taskId);
  mkdirSync(join(repoRoot, 'tmp', 'next-locks'), { recursive: true });

  try {
    mkdirSync(directory); // atomic; throws EEXIST if another worker won
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'EEXIST') throw error;
    if (reapStaleLock(directory)) {
      try {
        mkdirSync(directory);
      } catch {
        return false;
      }
    } else {
      return false;
    }
  }

  writeFileSync(
    join(directory, 'owner.json'),
    JSON.stringify({ pid: process.pid, claimedAt: new Date().toISOString(), taskId }, null, 2),
  );
  heldLocks.add(directory);
  return true;
}

/**
 * Atomically claim a `ready` task: acquire the lock then re-read the task and
 * confirm its status is still `ready`. Guards against a stale `tasks next`
 * result where another worker won the status flip between our peek and lock.
 */
async function tryClaimTask(taskId: string): Promise<boolean> {
  if (!acquireTaskLock(taskId)) return false;

  const fresh = await getTask(taskId);
  if (fresh.status !== 'ready') {
    log(
      'INFO',
      `Task ${taskId.slice(0, 8)} no longer ready (status: ${fresh.status}) — releasing lock`,
    );
    releaseLock(lockDirectory(taskId));
    return false;
  }
  return true;
}

function releaseLock(directory: string): void {
  try {
    rmSync(directory, { recursive: true, force: true });
  } catch (error) {
    log('WARN', `Failed to release lock at ${directory}: ${(error as Error).message}`);
  }
  heldLocks.delete(directory);
}

/**
 * Pull the next task from `tasks next` and claim it atomically. Returns the
 * claimed task or null when the queue is drained or every available task is
 * already locked by another worker. Bounded retry to avoid spinning forever
 * when the queue is large but every task is locked.
 */
async function claimNextTask(maxAttempts = 5): Promise<Task | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const candidate = await fetchNextTask();
    if (!candidate) return null;
    const won = await tryClaimTask(candidate.id);
    if (won) return candidate;
    log(
      'INFO',
      `Task ${candidate.id.slice(0, 8)} locked by another worker — trying next (${attempt}/${maxAttempts})`,
    );
    // Small jitter so multiple workers don't refetch in lockstep.
    await Bun.sleep(500 + Math.floor(Math.random() * 500));
  }
  log('WARN', `Could not claim any task after ${maxAttempts} attempts — backing off`);
  return null;
}

// =============================================================================
// Claude CLI invocation
// =============================================================================

const CLAUDE_FLAGS = ['-p', '--dangerously-skip-permissions'] as const;

/**
 * Spawn `claude -p` with the given prompt on stdin and stream output.
 *
 * The script creates and `cd`s into the worktree itself; we deliberately
 * do NOT pass `--worktree` (which would have claude create a nested
 * worktree on top of ours).
 *
 * Model aliases: `sonnet`, `opus`, `haiku` — or a full model id. Validated
 * by claude itself at startup; if it's wrong the process exits non-zero
 * and the pipeline aborts the task before doing any real work.
 */
async function claudeDrive(
  prompt: string,
  options: { cwd?: string; model?: string } = {},
): Promise<{ exitCode: number; captured: string }> {
  const args = ['claude', ...CLAUDE_FLAGS];
  if (options.model) args.push('--model', options.model);
  return runStreaming(args, { cwd: options.cwd, stdin: prompt });
}

// =============================================================================
// Git helpers
// =============================================================================

let repoRoot = '';

async function resolveRepoRoot(): Promise<string> {
  const result = await run(['git', 'rev-parse', '--show-toplevel']);
  if (result.exitCode !== 0) {
    throw new Error('Must run inside a git repository.');
  }
  return result.stdout.trim();
}

/**
 * Fetch `origin/<baseBranch>` without touching the local main checkout.
 *
 * Why fetch-only: workers run in parallel. Mutating the shared main worktree
 * (merge, conflict resolution, etc.) from a worker means `.git/index.lock`
 * races and — worse — handing claude `--dangerously-skip-permissions` against
 * the live main branch. Worktrees are created from `origin/<baseBranch>`, so
 * a fresh fetch is all we need.
 *
 * `git fetch` is concurrent-safe via packed-refs locking; concurrent fetches
 * from multiple workers either succeed or one waits briefly. No working-tree
 * mutation occurs.
 */
async function fetchBase(baseBranch: string): Promise<void> {
  log('PHASE', `Fetching origin/${baseBranch}`);
  await runOkVisible(['git', 'fetch', 'origin', baseBranch], { cwd: repoRoot });
  log('OK', `origin/${baseBranch} fetched`);
}

async function worktreeExists(directory: string): Promise<boolean> {
  const list = await run(['git', 'worktree', 'list', '--porcelain'], { cwd: repoRoot });
  return list.stdout.includes(`worktree ${directory}`);
}

/**
 * Create a fresh worktree on `branch` based at `origin/${baseBranch}`.
 *
 * The worktree directory name encodes the *full* task id plus a worker tag,
 * so two workers that race on different tasks with the same 8-char short-id
 * prefix can never collide. The branch name remains deterministic — the PR
 * is found by branch, not by directory.
 */
async function createWorktree(taskId: string, branch: string, baseBranch: string): Promise<string> {
  const workerTag = process.env.NEXT_WORKER_INDEX ?? 'solo';
  const directory = resolve(repoRoot, '..', 'worktrees', `next-${workerTag}-${taskId}`);
  mkdirSync(resolve(directory, '..'), { recursive: true });

  if (await worktreeExists(directory)) {
    const removed = await run(['git', 'worktree', 'remove', '--force', directory], {
      cwd: repoRoot,
    });
    if (removed.exitCode !== 0) {
      log('WARN', `Could not remove stale worktree at ${directory}: ${removed.stderr.trim()}`);
    }
  }
  // Branch delete is best-effort — failure is normal when the branch does not
  // exist. A failure for any *other* reason (e.g. branch tied to a worktree)
  // will surface when `git worktree add` rejects the branch below.
  await run(['git', 'branch', '-D', branch], { cwd: repoRoot });

  await runOkVisible(['git', 'worktree', 'add', directory, '-b', branch, `origin/${baseBranch}`], {
    cwd: repoRoot,
  });
  activeWorktrees.add(directory);
  log('OK', `Worktree at ${palette.dim(directory)} on branch ${palette.task(branch)}`);
  return directory;
}

/**
 * Tear down a worktree and its associated local branch. Best-effort; never
 * throws because this runs in `finally` blocks where the caller is already
 * handling a primary success/failure path.
 */
async function cleanupWorktree(directory: string, branch?: string): Promise<void> {
  if (existsSync(directory)) {
    const removed = await run(['git', 'worktree', 'remove', '--force', directory], {
      cwd: repoRoot,
    });
    if (removed.exitCode !== 0) {
      log('WARN', `worktree remove failed for ${directory}: ${removed.stderr.trim()}`);
    }
  }
  activeWorktrees.delete(directory);
  if (branch) {
    // Best-effort local branch delete — will fail if the branch isn't fully
    // merged into HEAD (e.g. PR was closed without merging). That's fine;
    // we don't want to clobber unmerged work.
    await run(['git', 'branch', '-d', branch], { cwd: repoRoot });
  }
}

async function countCommitsAhead(worktree: string, baseBranch: string): Promise<number> {
  const result = await run(['git', 'rev-list', '--count', `origin/${baseBranch}..HEAD`], {
    cwd: worktree,
  });
  if (result.exitCode !== 0) return 0;
  return Number.parseInt(result.stdout.trim(), 10) || 0;
}

async function pushBranch(worktree: string, branch: string): Promise<void> {
  await runOkVisible(['git', 'push', '-u', 'origin', branch], { cwd: worktree });
}

// =============================================================================
// GitHub PR helpers
// =============================================================================

type PrSummary = {
  number: number;
  url: string;
  state: string;
  mergeable: string | null;
  mergeStateStatus: string | null;
  headRefName?: string;
  headRefOid?: string;
  baseRefName?: string;
  createdAt?: string;
  body?: string;
};

async function findOpenPr(branch: string): Promise<PrSummary | null> {
  const result = await run(
    [
      'gh',
      'pr',
      'list',
      '--head',
      branch,
      '--state',
      'open',
      '--json',
      'number,url,state,mergeable,mergeStateStatus',
    ],
    { cwd: repoRoot },
  );
  if (result.exitCode !== 0) return null;
  const list = JSON.parse(result.stdout || '[]') as PrSummary[];
  return list[0] ?? null;
}

type ChecksSummary = { pending: number; failing: number; passing: number; total: number };

/** Fetch the aggregate CI state for a PR. `gh pr checks` exits non-zero on failing checks, so always parse output. */
async function getPrChecks(prNumber: number): Promise<ChecksSummary> {
  const result = await run(['gh', 'pr', 'checks', String(prNumber), '--json', 'state'], {
    cwd: repoRoot,
  });
  const empty: ChecksSummary = { pending: 0, failing: 0, passing: 0, total: 0 };

  const parsed = parseChecksJson(result.stdout);
  if (parsed) return parsed;

  // Fallback: plain-text parser for older `gh` versions.
  const fallback = await run(['gh', 'pr', 'checks', String(prNumber)], { cwd: repoRoot });
  const lines = fallback.stdout.split('\n').filter(Boolean);
  const summary = { ...empty };
  for (const line of lines) {
    summary.total++;
    if (/\b(pending|queued|in_progress)\b/i.test(line)) summary.pending++;
    else if (/\b(fail|error|cancelled|timed_out)\b/i.test(line)) summary.failing++;
    else if (/\b(pass|success)\b/i.test(line)) summary.passing++;
  }
  return summary;
}

function parseChecksJson(stdout: string): ChecksSummary | null {
  if (!stdout.trim()) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(stdout);
  } catch {
    return null;
  }
  if (!Array.isArray(raw)) return null;
  const summary: ChecksSummary = { pending: 0, failing: 0, passing: 0, total: 0 };
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const state = (entry as { state?: unknown }).state;
    if (typeof state !== 'string') continue;
    summary.total++;
    const upper = state.toUpperCase();
    if (upper === 'PENDING' || upper === 'QUEUED' || upper === 'IN_PROGRESS') summary.pending++;
    else if (
      upper === 'FAILURE' ||
      upper === 'ERROR' ||
      upper === 'CANCELLED' ||
      upper === 'TIMED_OUT'
    )
      summary.failing++;
    else if (upper === 'SUCCESS') summary.passing++;
  }
  return summary;
}

type ReviewState = {
  unresolvedThreads: number;
  reviewerLogins: Set<string>;
};

/** Single GraphQL round-trip for review threads + reviewer logins. */
async function getReviewState(prNumber: number): Promise<ReviewState> {
  const repoView = await runOk(['gh', 'repo', 'view', '--json', 'owner,name'], { cwd: repoRoot });
  const repoInfo = JSON.parse(repoView) as { owner: { login: string }; name: string };
  const query = `query($owner:String!,$name:String!,$number:Int!){
    repository(owner:$owner,name:$name){
      pullRequest(number:$number){
        reviewThreads(first:100){nodes{isResolved}}
        reviews(first:100){nodes{author{login}}}
        latestReviews:reviews(first:100){nodes{state author{login}}}
      }
    }
  }`;
  const result = await run(
    [
      'gh',
      'api',
      'graphql',
      '-f',
      `query=${query}`,
      '-F',
      `owner=${repoInfo.owner.login}`,
      '-F',
      `name=${repoInfo.name}`,
      '-F',
      `number=${prNumber}`,
    ],
    { cwd: repoRoot },
  );
  const empty: ReviewState = { unresolvedThreads: 0, reviewerLogins: new Set() };
  if (result.exitCode !== 0) return empty;

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    return empty;
  }
  if (!isReviewStatePayload(parsed)) return empty;

  const pr = parsed.data.repository.pullRequest;
  const reviewerLogins = new Set<string>();
  for (const node of pr.reviews.nodes) {
    if (node.author?.login) reviewerLogins.add(node.author.login.toLowerCase());
  }
  return {
    unresolvedThreads: pr.reviewThreads.nodes.filter((node) => !node.isResolved).length,
    reviewerLogins,
  };
}

type ReviewStatePayload = {
  data: {
    repository: {
      pullRequest: {
        reviewThreads: { nodes: Array<{ isResolved: boolean }> };
        reviews: { nodes: Array<{ author: { login: string } | null }> };
      };
    };
  };
};

function isReviewStatePayload(value: unknown): value is ReviewStatePayload {
  if (typeof value !== 'object' || value === null) return false;
  const data = (value as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null) return false;
  const pullRequest = (data as { repository?: { pullRequest?: unknown } }).repository?.pullRequest;
  if (typeof pullRequest !== 'object' || pullRequest === null) return false;
  const pr = pullRequest as { reviewThreads?: unknown; reviews?: unknown };
  return (
    typeof pr.reviewThreads === 'object' &&
    pr.reviewThreads !== null &&
    Array.isArray((pr.reviewThreads as { nodes?: unknown }).nodes) &&
    typeof pr.reviews === 'object' &&
    pr.reviews !== null &&
    Array.isArray((pr.reviews as { nodes?: unknown }).nodes)
  );
}

async function mergePr(prNumber: number): Promise<void> {
  await runOkVisible(['gh', 'pr', 'merge', String(prNumber), '--squash', '--delete-branch'], {
    cwd: repoRoot,
  });
}

// =============================================================================
// Phase: ensure a plan exists
// =============================================================================

async function ensurePlan(task: Task): Promise<Task> {
  if (task.plan && existsSync(join(repoRoot, task.plan))) {
    log('OK', `Plan exists at ${palette.dim(task.plan)}`);
    return task;
  }
  log('PHASE', `Drafting plan for ${palette.task(task.id.slice(0, 8))}`);
  const planPath = `tmp/plans/${task.id}.md`;
  const prompt = `You are drafting an implementation plan for a single task. Do NOT implement — plan only.

# Task
- ID: ${task.id}
- Title: ${task.title}
${task.description ? `- Description: ${task.description}` : ''}

# What to produce
A focused implementation plan written to \`${planPath}\` (relative to repo root: ${repoRoot}). The plan should:
- Examine the existing codebase and match its conventions before proposing new patterns.
- List the specific files to create or edit, with the role each one plays.
- Sketch the data model, types, and public APIs the work introduces.
- Call out edge cases, failure modes, and rollback considerations.
- Identify test coverage needed (unit, integration, browser) and what should be added vs. left alone.
- Stay scoped to this single task — do not expand into adjacent work.

# Required steps
1. Read the task and any referenced files in the repository.
2. Write the plan to \`${planPath}\`. Create the directory if it doesn't exist.
3. Invoke the \`plan-review\` skill via the Skill tool to adversarially review the plan. Iterate until plan-review approves (it writes an approval sentinel on success). Cap at the skill's built-in round limit; do not loop indefinitely.
4. Associate the approved plan with the task: \`tasks set-plan ${task.id} ${planPath}\`.

# Done criteria
- \`${planPath}\` exists and contains the approved plan.
- \`tasks get ${task.id}\` returns a record whose \`plan\` field equals \`${planPath}\`.

Do not modify any source files. Do not commit. Do not open a PR.`;
  const result = await claudeDrive(prompt, { cwd: repoRoot });
  if (result.exitCode !== 0) {
    throw new Error(`plan-drafting agent exited non-zero (${result.exitCode})`);
  }
  const updated = await getTask(task.id);
  if (!updated.plan) {
    throw new Error(`Plan still missing after plan-drafting agent for ${task.id}`);
  }
  return updated;
}

// =============================================================================
// Phase: implementation + commit + committee-review
// =============================================================================

async function driveImplementation(task: Task, worktree: string, planPath: string): Promise<void> {
  log('PHASE', `Implementing task ${palette.task(task.id.slice(0, 8))} in worktree`);

  const planContent = existsSync(planPath)
    ? await Bun.file(planPath).text()
    : '(plan file missing)';

  const prompt = `You are working on this task in an isolated git worktree.

# Task
- ID: ${task.id}
- Title: ${task.title}
- Status: in-progress
${task.description ? `- Description: ${task.description}` : ''}

# Plan (authoritative)
${planContent}

# Required outcomes
1. Implement the plan in this worktree (cwd is already the worktree).
2. Run the project's verify commands (lint, typecheck, test, format:check) and fix anything you break.
3. Commit your work with \`git commit\` — do NOT skip hooks, do NOT use --no-verify. At least one commit must land on this branch.
4. After committing, invoke the \`committee-review\` skill via the Skill tool and drive it to completion. The skill will run parallel reviews, implement feedback, and open a pull request when consensus is reached.
5. Do not merge the PR yourself.

If you get genuinely stuck, write a one-line "STUCK: <reason>" to stderr and exit. Otherwise drive all the way through committee-review.`;

  const result = await claudeDrive(prompt, { cwd: worktree, model: 'sonnet' });
  if (result.exitCode !== 0) {
    throw new Error(`Implementation agent exited non-zero (${result.exitCode})`);
  }
  if (/STUCK:/i.test(result.captured)) {
    throw new Error(`Implementation agent reported STUCK`);
  }
}

// =============================================================================
// Phase: ensure PR exists
// =============================================================================

async function ensurePr(task: Task, worktree: string, branch: string): Promise<PrSummary> {
  let pr = await findOpenPr(branch);
  if (pr) {
    log('OK', `Found existing PR #${pr.number}: ${palette.dim(pr.url)}`);
    return pr;
  }

  // Make sure the branch is pushed.
  await pushBranch(worktree, branch);

  log('PHASE', `Opening PR for ${palette.task(branch)}`);
  const title = task.title.length > 70 ? task.title.slice(0, 67) + '...' : task.title;
  const body = `## Summary\n\n${task.description ?? task.title}\n\nTask: \`${task.id}\`\n`;
  const created = await run(
    ['gh', 'pr', 'create', '--head', branch, '--base', 'main', '--title', title, '--body', body],
    { cwd: worktree, tee: true },
  );

  // committee-review (or any concurrent process) may have opened the PR
  // between our initial findOpenPr() and gh pr create — in that case `gh`
  // exits non-zero with "a pull request already exists". Re-query before
  // treating this as a failure.
  if (created.exitCode !== 0) {
    pr = await findOpenPr(branch);
    if (pr) {
      log(
        'OK',
        `PR already existed (raced with committee-review) #${pr.number}: ${palette.dim(pr.url)}`,
      );
      return pr;
    }
    throw new Error(`gh pr create failed and no open PR found:\n${created.stderr.trim()}`);
  }

  pr = await findOpenPr(branch);
  if (!pr) {
    throw new Error(`PR not found after creation for ${branch}`);
  }
  log('OK', `PR opened #${pr.number}: ${palette.dim(pr.url)}`);
  return pr;
}

// =============================================================================
// Phase: address-pr loop
//
// Readiness detection lives in this file. /address-pr is only invoked when
// there is concrete work to do (failing checks or unresolved threads). The
// loop:
//   1. Waits for pending checks to settle (bounded by waitForChecks).
//   2. Waits for review bots to weigh in (bounded by waitForReviewBots).
//   3. If the PR is clean → return.
//   4. Otherwise spawn /address-pr, then re-evaluate immediately.
// =============================================================================

const CHECK_POLL_INTERVAL_MS = 30_000;
const CHECK_POLL_MAX_ATTEMPTS = 120; // 60 minutes — Playwright suites can run long
const REVIEW_BOT_WAIT_MS = 60_000;
const REVIEW_BOT_MAX_ATTEMPTS = 5; // 5 minutes
const ADDRESS_PR_MAX_ROUNDS = 5;

const DEFAULT_EXPECTED_BOTS = ['copilot-pull-request-reviewer'];

/** Parse a comma-separated bot login list. Returns null when input is absent or empty. */
function parseExpectedBots(raw: string | undefined): string[] | null {
  if (!raw) return null;
  const list = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return list.length > 0 ? list : null;
}

type ReadinessSnapshot = {
  checks: ChecksSummary;
  unresolvedThreads: number;
  reviewerLogins: Set<string>;
  expectedBotsPending: string[];
};

/** Format a one-line summary suitable for log output. */
function formatSnapshot(snapshot: ReadinessSnapshot): string {
  const { checks, unresolvedThreads, expectedBotsPending } = snapshot;
  const checkParts = [
    palette.ok(`${checks.passing} pass`),
    palette.warn(`${checks.pending} pending`),
    palette.err(`${checks.failing} fail`),
  ];
  const threadStr =
    unresolvedThreads === 0
      ? palette.ok('0 unresolved')
      : palette.warn(`${unresolvedThreads} unresolved`);
  const botStr =
    expectedBotsPending.length === 0
      ? palette.ok('all bots in')
      : palette.warn(`awaiting ${expectedBotsPending.join(', ')}`);
  return `${checkParts.join(' / ')}; ${threadStr}; ${botStr}`;
}

/**
 * Strip the `[bot]` suffix that GitHub adds to bot account logins so that
 * `copilot-pull-request-reviewer` and `copilot-pull-request-reviewer[bot]`
 * compare equal.
 */
function normalizeLogin(login: string): string {
  return login.toLowerCase().replace(/\[bot\]$/, '');
}

async function getReadiness(prNumber: number, expectedBots: string[]): Promise<ReadinessSnapshot> {
  const [checks, reviewState] = await Promise.all([
    getPrChecks(prNumber),
    getReviewState(prNumber),
  ]);
  const seenLogins = new Set(Array.from(reviewState.reviewerLogins).map(normalizeLogin));
  const expectedBotsPending = expectedBots.filter((bot) => !seenLogins.has(normalizeLogin(bot)));
  return {
    checks,
    unresolvedThreads: reviewState.unresolvedThreads,
    reviewerLogins: reviewState.reviewerLogins,
    expectedBotsPending,
  };
}

/** Poll until pending checks resolve or the budget runs out. Returns the last snapshot regardless. */
async function waitForChecks(prNumber: number, expectedBots: string[]): Promise<ReadinessSnapshot> {
  let snapshot = await getReadiness(prNumber, expectedBots);
  for (
    let attempt = 1;
    attempt <= CHECK_POLL_MAX_ATTEMPTS && snapshot.checks.pending > 0;
    attempt++
  ) {
    log(
      'INFO',
      `Checks pending (${attempt}/${CHECK_POLL_MAX_ATTEMPTS}) — sleeping ${CHECK_POLL_INTERVAL_MS / 1000}s: ${formatSnapshot(snapshot)}`,
    );
    await Bun.sleep(CHECK_POLL_INTERVAL_MS);
    snapshot = await getReadiness(prNumber, expectedBots);
  }
  if (snapshot.checks.pending > 0) {
    log(
      'WARN',
      `Checks still pending after ${CHECK_POLL_MAX_ATTEMPTS} attempts — proceeding anyway`,
    );
  }
  return snapshot;
}

/** Wait for any expected review bots to post their first review. Returns the latest snapshot. */
async function waitForReviewBots(
  prNumber: number,
  expectedBots: string[],
  initial: ReadinessSnapshot,
): Promise<ReadinessSnapshot> {
  let snapshot = initial;
  for (
    let attempt = 1;
    attempt <= REVIEW_BOT_MAX_ATTEMPTS && snapshot.expectedBotsPending.length > 0;
    attempt++
  ) {
    log(
      'INFO',
      `Awaiting review bots (${attempt}/${REVIEW_BOT_MAX_ATTEMPTS}): ${snapshot.expectedBotsPending.join(', ')}`,
    );
    await Bun.sleep(REVIEW_BOT_WAIT_MS);
    snapshot = await getReadiness(prNumber, expectedBots);
  }
  if (snapshot.expectedBotsPending.length > 0) {
    log(
      'WARN',
      `Bots never reviewed within budget: ${snapshot.expectedBotsPending.join(', ')} — proceeding anyway`,
    );
  }
  return snapshot;
}

/** True when the PR has nothing left to address. */
function isReady(snapshot: ReadinessSnapshot): boolean {
  return (
    snapshot.checks.pending === 0 &&
    snapshot.checks.failing === 0 &&
    snapshot.unresolvedThreads === 0 &&
    snapshot.expectedBotsPending.length === 0
  );
}

/**
 * Drive the PR to a mergeable state. Detects readiness locally; only spawns
 * /address-pr when there is concrete failing-CI or unresolved-thread work.
 */
async function pollPrUntilReady(
  prNumber: number,
  worktree: string,
  expectedBots: string[],
): Promise<void> {
  for (let round = 1; round <= ADDRESS_PR_MAX_ROUNDS; round++) {
    log('PHASE', `PR readiness check ${round}/${ADDRESS_PR_MAX_ROUNDS} for PR #${prNumber}`);

    let snapshot = await getReadiness(prNumber, expectedBots);
    log('INFO', formatSnapshot(snapshot));

    // Act on any actionable signal immediately — a single failing check or a
    // single unresolved thread is enough to dispatch /address-pr. Don't wait
    // for the rest of CI to settle before starting work on what's already
    // broken. The address-pr skill itself loops until everything it can fix
    // is fixed, so partial signal is fine to start on.
    if (snapshot.checks.failing === 0 && snapshot.unresolvedThreads === 0) {
      // Nothing actionable yet. Wait for pending checks / bots so we either
      // converge on ready, or surface failures/threads that we can act on.
      snapshot = await waitForChecks(prNumber, expectedBots);
      snapshot = await waitForReviewBots(prNumber, expectedBots, snapshot);
      log('INFO', formatSnapshot(snapshot));

      if (isReady(snapshot)) {
        log('OK', `PR #${prNumber} is ready to merge`);
        return;
      }

      if (snapshot.checks.failing === 0 && snapshot.unresolvedThreads === 0) {
        // Only blockers were "bots not yet reviewed" or "checks still pending" —
        // both already exhausted their waits. Nothing for /address-pr to do.
        log('WARN', `PR #${prNumber} not fully clean but has no actionable feedback — accepting`);
        return;
      }
    }

    log(
      'PHASE',
      `Delegating to /address-pr (round ${round}/${ADDRESS_PR_MAX_ROUNDS}): ${palette.err(`${snapshot.checks.failing} failing`)}, ${palette.warn(`${snapshot.unresolvedThreads} unresolved`)}`,
    );
    const prompt = `/address-pr ${prNumber}

Use the \`address-pr\` skill via the Skill tool. The driving script has detected actionable work on this PR right now: ${snapshot.checks.failing} failing check(s) and ${snapshot.unresolvedThreads} unresolved review thread(s).

Work on whatever is actionable — even a single failing check or a single unresolved thread is enough to start. Do not wait for other pending checks or bots before acting on what's already broken.

Loop until ALL conditions are met:
- Zero unresolved review threads
- CI is green (no failing checks)
- All requested review bots have posted

Do not bail. Do not stop until address-pr reports complete.`;
    const result = await claudeDrive(prompt, { cwd: worktree, model: 'sonnet' });
    if (result.exitCode !== 0) {
      log('WARN', `/address-pr exited non-zero (${result.exitCode}) on round ${round}`);
    }
  }

  const final = await getReadiness(prNumber, expectedBots);
  if (isReady(final)) {
    log('OK', `PR #${prNumber} reached ready state on final check`);
    return;
  }
  throw new Error(
    `PR #${prNumber} did not reach a ready state after ${ADDRESS_PR_MAX_ROUNDS} /address-pr rounds: ${formatSnapshot(final)}`,
  );
}

// =============================================================================
// Recovery sweep
//
// Detects tasks stranded by an interrupted pipeline run (kill -9, crash,
// machine sleep) and reconciles them. The `--recover` mode is annotate-only
// and never destroys local work. The `--resume <task-id>` mode is the only
// path that can re-enter the PR phase (poll/merge/complete).
// =============================================================================

const PR_SEARCH_INDEX_GRACE_MS = 10 * 60 * 1000;

type ProgressPhase =
  | 'claim'
  | 'branch-set'
  | 'push'
  | 'pr-created'
  | 'in-review'
  | 'address-pr'
  | 'merge';
const PROGRESS_PHASE_PREFIX = 'next-phase:';

type ManualReasonCode =
  | 'dirty-worktree'
  | 'merged-dirty-worktree'
  | 'multiple-prs'
  | 'closed-unmerged-pr'
  | 'wrong-base'
  | 'stale-branch-no-pr'
  | 'empty-remote-branch'
  | 'orphan-worktree'
  | 'recent-search-zero'
  | 'past-claim-with-missing-state'
  | 'other';

type RecoveryVerdict =
  | { kind: 'rollback-safe'; reason: string }
  | { kind: 'complete-safe'; reason: string; pr: PrSummary }
  | { kind: 'resumable'; reason: string; pr: PrSummary; needsPr: false }
  | { kind: 'resumable'; reason: string; pr: null; needsPr: true; branch: string }
  | { kind: 'manual'; reason: string; code: ManualReasonCode; evidence: string[]; pr?: PrSummary };

type RecoveryInputs = {
  task: Task;
  now: number;
  worktreePath: string | null;
  worktreeDirty: boolean;
  worktreeUnpushed: number;
  localBranchExists: boolean;
  localCommitsAheadOfMain: number;
  remoteBranchExists: boolean;
  remoteCommitsAheadOfMain: number;
  candidatePrs: PrSummary[];
  directBranchPrs: PrSummary[];
  fallbackBranchPrs: PrSummary[];
  progressPhases: ProgressPhase[];
  liveLockHeld: boolean;
};

/**
 * Pure classifier: takes observable state, returns a verdict. No I/O, no
 * Date.now() (caller passes `now`), no logging. Directly testable.
 */
export function classifyRecovery(inputs: RecoveryInputs): RecoveryVerdict {
  if (inputs.liveLockHeld) {
    return {
      kind: 'manual',
      code: 'other',
      reason: 'live lock held by another process',
      evidence: [],
    };
  }

  // Identity-verify candidate PRs in the classifier itself (defense in depth).
  const verifiedPrs = inputs.candidatePrs.filter((pr) => {
    if (!pr.body || !pr.body.includes(inputs.task.id)) return false;
    if (inputs.task.createdAt && pr.createdAt && pr.createdAt < inputs.task.createdAt) return false;
    return true;
  });

  // Dirty/unpushed worktree forces manual unless paired with a merged-on-main PR
  // (which becomes the explicit `merged-dirty-worktree` manual code).
  const worktreeBlocks = inputs.worktreeDirty || inputs.worktreeUnpushed > 0;

  // Multiple verified PRs → always manual.
  if (verifiedPrs.length >= 2) {
    return {
      kind: 'manual',
      code: 'multiple-prs',
      reason: `${verifiedPrs.length} PRs match this task id; operator must reconcile`,
      evidence: verifiedPrs.map((pr) => pr.url),
    };
  }

  // Exactly one verified PR.
  if (verifiedPrs.length === 1) {
    const pr = verifiedPrs[0]!;
    const state = pr.state.toUpperCase();
    if (state === 'MERGED') {
      if (pr.baseRefName !== 'main') {
        return {
          kind: 'manual',
          code: 'wrong-base',
          reason: `PR #${pr.number} merged on '${pr.baseRefName}' (expected 'main')`,
          evidence: [pr.url],
          pr,
        };
      }
      if (worktreeBlocks) {
        return {
          kind: 'manual',
          code: 'merged-dirty-worktree',
          reason: `PR #${pr.number} merged on main but local worktree is dirty at ${inputs.worktreePath}`,
          evidence: [pr.url, inputs.worktreePath ?? '(no worktree path)'],
          pr,
        };
      }
      return { kind: 'complete-safe', reason: `PR #${pr.number} merged on main`, pr };
    }
    if (state === 'OPEN') {
      if (worktreeBlocks) {
        return {
          kind: 'manual',
          code: 'dirty-worktree',
          reason: `PR #${pr.number} is open but local worktree is dirty at ${inputs.worktreePath}`,
          evidence: [pr.url, inputs.worktreePath ?? '(no worktree path)'],
          pr,
        };
      }
      return {
        kind: 'resumable',
        reason: `PR #${pr.number} open; resume to continue`,
        pr,
        needsPr: false,
      };
    }
    // Closed-unmerged or other terminal non-merged state.
    return {
      kind: 'manual',
      code: 'closed-unmerged-pr',
      reason: `PR #${pr.number} state=${state} (closed without merge)`,
      evidence: [pr.url],
      pr,
    };
  }

  // No verified PR. Dirty worktree always manual.
  if (worktreeBlocks) {
    return {
      kind: 'manual',
      code: 'dirty-worktree',
      reason: `local worktree at ${inputs.worktreePath} has uncommitted or unpushed work`,
      evidence: [inputs.worktreePath ?? '(no worktree path)'],
    };
  }

  // Beyond-claim phase markers block rollback when state is missing.
  const pastClaim = inputs.progressPhases.filter((p) => p !== 'claim').length > 0;

  if (inputs.task.branch) {
    // Branch set on task.
    const provenanceOk = inputs.task.branch === taskBranchName(inputs.task.id);
    if (inputs.remoteBranchExists) {
      if (!provenanceOk) {
        return {
          kind: 'manual',
          code: 'stale-branch-no-pr',
          reason: `remote branch ${inputs.task.branch} exists but does not match taskBranchName(${inputs.task.id.slice(0, 8)})`,
          evidence: [inputs.task.branch],
        };
      }
      if (inputs.remoteCommitsAheadOfMain === 0) {
        return {
          kind: 'manual',
          code: 'empty-remote-branch',
          reason: `remote branch ${inputs.task.branch} exists but is not ahead of origin/main`,
          evidence: [inputs.task.branch],
        };
      }
      return {
        kind: 'resumable',
        reason: `remote branch ${inputs.task.branch} exists with no PR; resume to create PR`,
        pr: null,
        needsPr: true,
        branch: inputs.task.branch,
      };
    }
    // Remote branch absent. Need direct branch lookup zero + grace window + no past-claim markers.
    const withinGrace =
      inputs.task.lastModifiedAt !== undefined &&
      inputs.now - Date.parse(inputs.task.lastModifiedAt) < PR_SEARCH_INDEX_GRACE_MS;
    if (withinGrace) {
      return {
        kind: 'manual',
        code: 'recent-search-zero',
        reason: 'PR search returned zero within the indexing grace window — proof not yet durable',
        evidence: [inputs.task.branch],
      };
    }
    if (inputs.directBranchPrs.length > 0) {
      return {
        kind: 'manual',
        code: 'other',
        reason: 'direct branch lookup found PRs that body-search missed; reconcile manually',
        evidence: inputs.directBranchPrs.map((pr) => pr.url),
      };
    }
    if (pastClaim) {
      return {
        kind: 'manual',
        code: 'past-claim-with-missing-state',
        reason: `task has past-claim phase markers (${inputs.progressPhases.join(', ')}) but no PR/remote branch`,
        evidence: inputs.progressPhases,
      };
    }
    return {
      kind: 'rollback-safe',
      reason: 'two-source PR absence proof + no remote branch + no past-claim markers',
    };
  }

  // task.branch is null.
  if (inputs.worktreePath) {
    return {
      kind: 'manual',
      code: 'orphan-worktree',
      reason: `worktree at ${inputs.worktreePath} exists but task has no branch metadata`,
      evidence: [inputs.worktreePath],
    };
  }
  if (inputs.fallbackBranchPrs.length > 0) {
    return {
      kind: 'manual',
      code: 'other',
      reason: 'fallback branch-name lookup found PRs that body-search missed',
      evidence: inputs.fallbackBranchPrs.map((pr) => pr.url),
    };
  }
  if (pastClaim) {
    return {
      kind: 'manual',
      code: 'past-claim-with-missing-state',
      reason: `task has past-claim phase markers (${inputs.progressPhases.join(', ')}) but no branch metadata`,
      evidence: inputs.progressPhases,
    };
  }
  const withinGrace =
    inputs.task.lastModifiedAt !== undefined &&
    inputs.now - Date.parse(inputs.task.lastModifiedAt) < PR_SEARCH_INDEX_GRACE_MS;
  if (withinGrace) {
    return {
      kind: 'manual',
      code: 'recent-search-zero',
      reason: 'PR search returned zero within the indexing grace window',
      evidence: [],
    };
  }
  return {
    kind: 'rollback-safe',
    reason: 'task never reached branch-setting; safe to return to ready',
  };
}

/** Normalized fingerprint for verdict-drift detection across lock acquisition. */
export function verdictFingerprint(v: RecoveryVerdict): string {
  const pr =
    v.kind === 'manual' || v.kind === 'complete-safe' || v.kind === 'resumable'
      ? (v as { pr?: PrSummary | null }).pr
      : null;
  const normalized = {
    kind: v.kind,
    code: v.kind === 'manual' ? v.code : null,
    needsPr: v.kind === 'resumable' ? v.needsPr : null,
    pr: pr
      ? {
          number: pr.number,
          url: pr.url,
          state: pr.state,
          headRefName: pr.headRefName ?? null,
          headRefOid: pr.headRefOid ?? null,
          baseRefName: pr.baseRefName ?? null,
        }
      : null,
    evidence: v.kind === 'manual' ? v.evidence.slice().sort() : null,
  };
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex').slice(0, 16);
}

// ---- I/O probes ----

/**
 * Find any worktree directory belonging to this task by id-glob. Returns the
 * first match (workers tag with NEXT_WORKER_INDEX, so collisions on the same
 * task id are impossible in practice).
 */
function findWorktreeForTask(taskId: string): string | null {
  const root = resolve(repoRoot, '..', 'worktrees');
  if (!existsSync(root)) return null;
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (entry.includes(taskId)) {
      const full = resolve(root, entry);
      if (existsSync(full)) return full;
    }
  }
  return null;
}

async function isWorktreeDirty(worktree: string): Promise<boolean> {
  const result = await run(['git', 'status', '--porcelain'], { cwd: worktree });
  if (result.exitCode !== 0) return true; // err on the side of "dirty"
  return result.stdout.trim().length > 0;
}

async function countUnpushed(worktree: string, branch: string): Promise<number> {
  const result = await run(['git', 'rev-list', '--count', `origin/${branch}..HEAD`], {
    cwd: worktree,
  });
  if (result.exitCode !== 0) {
    // Branch may not exist on remote; compare to origin/main instead.
    const fallback = await run(['git', 'rev-list', '--count', 'origin/main..HEAD'], {
      cwd: worktree,
    });
    if (fallback.exitCode !== 0) return 0;
    return Number.parseInt(fallback.stdout.trim(), 10) || 0;
  }
  return Number.parseInt(result.stdout.trim(), 10) || 0;
}

async function localBranchExists(branch: string): Promise<boolean> {
  const result = await run(['git', 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], {
    cwd: repoRoot,
  });
  return result.exitCode === 0;
}

async function remoteBranchExists(branch: string): Promise<boolean> {
  const result = await run(['git', 'ls-remote', '--exit-code', 'origin', `refs/heads/${branch}`], {
    cwd: repoRoot,
  });
  return result.exitCode === 0;
}

async function remoteCommitsAheadOfMain(branch: string): Promise<number> {
  const result = await run(['git', 'rev-list', '--count', `origin/main..origin/${branch}`], {
    cwd: repoRoot,
  });
  if (result.exitCode !== 0) return 0;
  return Number.parseInt(result.stdout.trim(), 10) || 0;
}

async function localCommitsAheadOfMain(branch: string): Promise<number> {
  const result = await run(['git', 'rev-list', '--count', `origin/main..${branch}`], {
    cwd: repoRoot,
  });
  if (result.exitCode !== 0) return 0;
  return Number.parseInt(result.stdout.trim(), 10) || 0;
}

/**
 * Search PRs whose body contains the task id. Returns identity candidates;
 * the classifier re-verifies body identity.
 */
async function findPrsForTask(taskId: string): Promise<PrSummary[]> {
  const result = await run(
    [
      'gh',
      'pr',
      'list',
      '--search',
      taskId,
      '--state',
      'all',
      '--limit',
      '20',
      '--json',
      'number,url,state,headRefName,headRefOid,baseRefName,createdAt,body',
    ],
    { cwd: repoRoot },
  );
  if (result.exitCode !== 0) return [];
  try {
    const raw = JSON.parse(result.stdout || '[]') as Array<Record<string, unknown>>;
    return raw.map(normalizePrSummary).filter((pr): pr is PrSummary => pr !== null);
  } catch {
    return [];
  }
}

async function findPrsForBranch(branch: string): Promise<PrSummary[]> {
  const result = await run(
    [
      'gh',
      'pr',
      'list',
      '--head',
      branch,
      '--state',
      'all',
      '--limit',
      '20',
      '--json',
      'number,url,state,headRefName,headRefOid,baseRefName,createdAt,body',
    ],
    { cwd: repoRoot },
  );
  if (result.exitCode !== 0) return [];
  try {
    const raw = JSON.parse(result.stdout || '[]') as Array<Record<string, unknown>>;
    return raw.map(normalizePrSummary).filter((pr): pr is PrSummary => pr !== null);
  } catch {
    return [];
  }
}

function normalizePrSummary(raw: Record<string, unknown>): PrSummary | null {
  if (
    typeof raw.number !== 'number' ||
    typeof raw.url !== 'string' ||
    typeof raw.state !== 'string'
  )
    return null;
  return {
    number: raw.number,
    url: raw.url,
    state: raw.state,
    mergeable: null,
    mergeStateStatus: null,
    headRefName: typeof raw.headRefName === 'string' ? raw.headRefName : undefined,
    headRefOid: typeof raw.headRefOid === 'string' ? raw.headRefOid : undefined,
    baseRefName: typeof raw.baseRefName === 'string' ? raw.baseRefName : undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
    body: typeof raw.body === 'string' ? raw.body : undefined,
  };
}

function isLiveLockHeld(taskId: string): boolean {
  const directory = lockDirectory(taskId);
  if (!existsSync(directory)) return false;
  const metaPath = join(directory, 'owner.json');
  if (!existsSync(metaPath)) return false;
  try {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as { pid: number; claimedAt: string };
    if (meta.pid === process.pid) return false; // our own lock; not "live" from another process
    const ageMs = Date.now() - new Date(meta.claimedAt).getTime();
    if (ageMs > LOCK_STALE_MS) return false;
    return pidAlive(meta.pid);
  } catch {
    return false;
  }
}

function extractProgressPhases(entries: ProgressEntry[]): ProgressPhase[] {
  const seen = new Set<ProgressPhase>();
  for (const entry of entries) {
    const message = entry.message ?? '';
    const idx = message.indexOf(PROGRESS_PHASE_PREFIX);
    if (idx === -1) continue;
    const phase = message
      .slice(idx + PROGRESS_PHASE_PREFIX.length)
      .trim()
      .split(/\s+/)[0];
    if (
      phase === 'claim' ||
      phase === 'branch-set' ||
      phase === 'push' ||
      phase === 'pr-created' ||
      phase === 'in-review' ||
      phase === 'address-pr' ||
      phase === 'merge'
    ) {
      seen.add(phase);
    }
  }
  return Array.from(seen);
}

/** Collect every input the classifier needs for a single task. */
async function collectRecoveryInputs(task: Task): Promise<RecoveryInputs> {
  const branch = task.branch ?? null;
  const fallbackBranch = taskBranchName(task.id);

  const worktreePath = findWorktreeForTask(task.id);
  const [worktreeDirty, worktreeUnpushed] = worktreePath
    ? await Promise.all([
        isWorktreeDirty(worktreePath),
        countUnpushed(worktreePath, branch ?? fallbackBranch),
      ])
    : [false, 0];

  const localExists = branch ? await localBranchExists(branch) : false;
  const localAhead = branch && localExists ? await localCommitsAheadOfMain(branch) : 0;
  const remoteExists = branch ? await remoteBranchExists(branch) : false;
  const remoteAhead = branch && remoteExists ? await remoteCommitsAheadOfMain(branch) : 0;

  const [candidatePrs, directBranchPrs, fallbackBranchPrs, progressEntries] = await Promise.all([
    findPrsForTask(task.id),
    branch ? findPrsForBranch(branch) : Promise.resolve([] as PrSummary[]),
    !branch ? findPrsForBranch(fallbackBranch) : Promise.resolve([] as PrSummary[]),
    getProgress(task.id),
  ]);

  return {
    task,
    now: Date.now(),
    worktreePath,
    worktreeDirty,
    worktreeUnpushed,
    localBranchExists: localExists,
    localCommitsAheadOfMain: localAhead,
    remoteBranchExists: remoteExists,
    remoteCommitsAheadOfMain: remoteAhead,
    candidatePrs,
    directBranchPrs,
    fallbackBranchPrs,
    progressPhases: extractProgressPhases(progressEntries),
    liveLockHeld: isLiveLockHeld(task.id),
  };
}

// ---- Phase-marker writer (used by the normal pipeline) ----

async function recordPhase(taskId: string, phase: ProgressPhase): Promise<void> {
  try {
    await addProgress(taskId, `${PROGRESS_PHASE_PREFIX}${phase}`);
  } catch (error) {
    log('WARN', `phase-marker write failed for ${phase}: ${(error as Error).message}`);
  }
}

// ---- Progress note idempotency ----

function annotationFingerprint(v: RecoveryVerdict): string {
  const code = v.kind === 'manual' ? v.code : '';
  const evidence = v.kind === 'manual' ? v.evidence.slice().sort().join('|') : '';
  const fp = createHash('sha256')
    .update(`${v.kind}|${code}|${evidence}`)
    .digest('hex')
    .slice(0, 16);
  return `recovery-annot:${v.kind}:${code}:${fp}`;
}

function mutationFingerprint(kind: 'rollback-safe' | 'complete-safe'): string {
  return `recovery-mutate:${kind}:${randomUUID()}`;
}

async function shouldSkipAnnotation(taskId: string, fingerprint: string): Promise<boolean> {
  const entries = await getProgress(taskId);
  if (entries.length === 0) return false;
  const latest = entries[entries.length - 1]!;
  return (latest.message ?? '').startsWith(fingerprint);
}

async function writeAnnotation(
  taskId: string,
  verdict: RecoveryVerdict,
  body: string,
): Promise<void> {
  const fingerprint = annotationFingerprint(verdict);
  if (await shouldSkipAnnotation(taskId, fingerprint)) {
    log('INFO', `Skipping duplicate annotation for ${taskId.slice(0, 8)} (${verdict.kind})`);
    return;
  }
  await addProgress(taskId, `${fingerprint} ${body}`);
}

async function writeMutationNote(
  taskId: string,
  kind: 'rollback-safe' | 'complete-safe',
  body: string,
): Promise<void> {
  await addProgress(taskId, `${mutationFingerprint(kind)} ${body}`);
}

// ---- Action driver ----

type RecoveryRunResult = {
  taskId: string;
  verdict: RecoveryVerdict;
  acted: boolean;
};

async function runRecoveryForTask(
  task: Task,
  prelock: RecoveryVerdict,
): Promise<RecoveryRunResult> {
  const shortId = task.id.slice(0, 8);
  if (
    prelock.kind === 'manual' &&
    prelock.code === 'other' &&
    prelock.reason.includes('live lock held')
  ) {
    log('WARN', `Task ${shortId} locked by another process — skipping`);
    return { taskId: task.id, verdict: prelock, acted: false };
  }

  // Acquire the lock. Recovery uses the low-level primitive — it must not
  // be coupled to ready-task semantics.
  if (!acquireTaskLock(task.id)) {
    log('WARN', `Could not acquire lock for ${shortId} — skipping`);
    return { taskId: task.id, verdict: prelock, acted: false };
  }
  const lockPath = lockDirectory(task.id);

  try {
    // Reclassify after lock acquisition.
    const freshTask = await getTask(task.id);
    if (freshTask.status !== 'in-progress' && freshTask.status !== 'in-review') {
      log(
        'INFO',
        `Task ${shortId} status drifted to ${freshTask.status} during lock acquisition — skipping`,
      );
      return { taskId: task.id, verdict: prelock, acted: false };
    }
    const freshInputs = await collectRecoveryInputs(freshTask);
    const fresh = classifyRecovery(freshInputs);
    const prelockFp = verdictFingerprint(prelock);
    const freshFp = verdictFingerprint(fresh);
    if (prelockFp !== freshFp) {
      log('INFO', `verdict drift for ${shortId}: ${prelockFp} → ${freshFp}; using fresh verdict`);
    }
    await dispatchRecoveryAction(freshTask, fresh);
    return { taskId: task.id, verdict: fresh, acted: true };
  } finally {
    releaseLock(lockPath);
  }
}

async function dispatchRecoveryAction(task: Task, verdict: RecoveryVerdict): Promise<void> {
  const shortId = task.id.slice(0, 8);
  log(
    'PHASE',
    `Recovery action for ${palette.task(shortId)}: ${palette.bold(verdict.kind)} — ${verdict.reason}`,
  );
  switch (verdict.kind) {
    case 'rollback-safe':
      await executeRollbackSafe(task);
      return;
    case 'complete-safe':
      await executeCompleteSafe(task, verdict.pr);
      return;
    case 'resumable':
      await executeResumableAnnotation(task, verdict);
      return;
    case 'manual':
      await executeManualAnnotation(task, verdict);
      return;
  }
}

async function executeRollbackSafe(task: Task): Promise<void> {
  await writeMutationNote(
    task.id,
    'rollback-safe',
    'recovery: rollback-safe — no PR, no remote branch, no local work; returning to ready',
  );

  const worktreePath = findWorktreeForTask(task.id);
  if (worktreePath && existsSync(worktreePath)) {
    const removed = await run(['git', 'worktree', 'remove', '--force', worktreePath], {
      cwd: repoRoot,
    });
    if (removed.exitCode !== 0) {
      log('WARN', `worktree remove failed for ${worktreePath}: ${removed.stderr.trim()}`);
    }
  }

  if (task.branch) {
    const ahead = await localCommitsAheadOfMain(task.branch);
    if (ahead === 0 && (await localBranchExists(task.branch))) {
      await run(['git', 'branch', '-D', task.branch], { cwd: repoRoot });
    }
  }

  if (task.branch) {
    try {
      await clearBranch(task.id);
    } catch (error) {
      log('WARN', `clear-branch failed for ${task.id.slice(0, 8)}: ${(error as Error).message}`);
    }
  }
  await setStatus(task.id, 'ready');
  log('OK', `Task ${task.id.slice(0, 8)} returned to ready`);
}

async function executeCompleteSafe(task: Task, pr: PrSummary): Promise<void> {
  await writeMutationNote(
    task.id,
    'complete-safe',
    `recovery: complete-safe — PR #${pr.number} verified merged on main; cleaning up`,
  );

  const worktreePath = findWorktreeForTask(task.id);
  if (worktreePath && existsSync(worktreePath)) {
    const removed = await run(['git', 'worktree', 'remove', '--force', worktreePath], {
      cwd: repoRoot,
    });
    if (removed.exitCode !== 0) {
      log('WARN', `worktree remove failed for ${worktreePath}: ${removed.stderr.trim()}`);
    }
  }

  if (task.branch && (await localBranchExists(task.branch))) {
    const safe = await isLocalBranchSafeToDelete(task.branch, pr.headRefOid);
    if (safe) {
      await run(['git', 'branch', '-D', task.branch], { cwd: repoRoot });
    } else {
      log(
        'INFO',
        `Preserving local branch ${task.branch} (tip diverges from PR head and is not reachable from origin/main)`,
      );
    }
  }

  await setStatus(task.id, 'completed');
  log(
    'OK',
    palette.bold(palette.ok(`Task ${task.id.slice(0, 8)} marked completed — PR #${pr.number}`)),
  );
}

/**
 * Safe to delete a local branch after squash-merge when either: every commit
 * on the branch is reachable from origin/main, or the branch tip equals the
 * PR's head OID at merge time. `git branch --merged main` does not work after
 * squash merges (squash-merged branches never appear there).
 */
async function isLocalBranchSafeToDelete(
  branch: string,
  prHeadOid: string | undefined,
): Promise<boolean> {
  const tip = await run(['git', 'rev-parse', branch], { cwd: repoRoot });
  if (tip.exitCode !== 0) return false;
  if (prHeadOid && tip.stdout.trim() === prHeadOid) return true;
  const ahead = await run(['git', 'rev-list', '--count', `origin/main..${branch}`], {
    cwd: repoRoot,
  });
  if (ahead.exitCode !== 0) return false;
  return (Number.parseInt(ahead.stdout.trim(), 10) || 0) === 0;
}

async function executeResumableAnnotation(
  task: Task,
  verdict: Extract<RecoveryVerdict, { kind: 'resumable' }>,
): Promise<void> {
  const body = verdict.needsPr
    ? `recovery: resumable — remote branch ${verdict.branch} exists with no PR; run \`bun scripts/next.ts --resume ${task.id}\` to create the PR and continue`
    : `recovery: resumable — PR #${verdict.pr.number} open at ${verdict.pr.url}; run \`bun scripts/next.ts --resume ${task.id}\` to continue`;
  await writeAnnotation(task.id, verdict, body);
}

async function executeManualAnnotation(
  task: Task,
  verdict: Extract<RecoveryVerdict, { kind: 'manual' }>,
): Promise<void> {
  const evidenceStr =
    verdict.evidence.length > 0 ? ` Evidence: ${verdict.evidence.join(', ')}` : '';
  const body = `recovery: manual (${verdict.code}) — ${verdict.reason}.${evidenceStr}`;
  await writeAnnotation(task.id, verdict, body);
}

// ---- Sweep driver ----

async function runRecoverySweep(): Promise<void> {
  log('PHASE', palette.heading('Recovery sweep starting'));
  const tasks = await listAllTasks();
  const stranded = tasks.filter((t) => t.status === 'in-progress' || t.status === 'in-review');
  if (stranded.length === 0) {
    log('OK', 'No stranded tasks (no in-progress / in-review tasks found)');
    return;
  }
  log('INFO', `Found ${stranded.length} stranded task(s)`);

  let acted = 0;
  let skipped = 0;
  const summary: Record<RecoveryVerdict['kind'], number> = {
    'rollback-safe': 0,
    'complete-safe': 0,
    resumable: 0,
    manual: 0,
  };

  for (const task of stranded) {
    const shortId = task.id.slice(0, 8);
    log('TASK', `${palette.task(shortId)} (${task.status}): ${task.title}`);
    try {
      const inputs = await collectRecoveryInputs(task);
      const verdict = classifyRecovery(inputs);
      log(
        'INFO',
        `pre-lock verdict: ${verdict.kind}${verdict.kind === 'manual' ? ` (${verdict.code})` : ''} — ${verdict.reason}`,
      );
      const result = await runRecoveryForTask(task, verdict);
      summary[result.verdict.kind]++;
      if (result.acted) acted++;
      else skipped++;
    } catch (error) {
      log('ERROR', `recovery for ${shortId} failed: ${(error as Error).message}`);
      skipped++;
    }
  }

  log(
    'OK',
    palette.bold(
      `Sweep finished: ${palette.ok(`${acted} acted`)}, ${palette.warn(`${skipped} skipped`)} — ` +
        `${palette.ok(`${summary['rollback-safe']} rollback`)}, ${palette.ok(`${summary['complete-safe']} complete`)}, ` +
        `${palette.phase(`${summary.resumable} resumable`)}, ${palette.warn(`${summary.manual} manual`)}`,
    ),
  );
}

// ---- --resume driver ----

/**
 * Create a worktree from an existing remote branch (instead of creating a new
 * branch from origin/main, like `createWorktree` does).
 */
async function createWorktreeFromRemote(taskId: string, branch: string): Promise<string> {
  const workerTag = process.env.NEXT_WORKER_INDEX ?? 'solo';
  const directory = resolve(repoRoot, '..', 'worktrees', `next-${workerTag}-${taskId}`);
  mkdirSync(resolve(directory, '..'), { recursive: true });

  if (await worktreeExists(directory)) {
    const removed = await run(['git', 'worktree', 'remove', '--force', directory], {
      cwd: repoRoot,
    });
    if (removed.exitCode !== 0) {
      log('WARN', `Could not remove stale worktree at ${directory}: ${removed.stderr.trim()}`);
    }
  }
  // Best-effort local branch delete (will fail if branch doesn't exist locally, which is normal).
  await run(['git', 'branch', '-D', branch], { cwd: repoRoot });

  await runOkVisible(['git', 'worktree', 'add', '-B', branch, directory, `origin/${branch}`], {
    cwd: repoRoot,
  });
  activeWorktrees.add(directory);
  log('OK', `Worktree at ${palette.dim(directory)} on remote branch ${palette.task(branch)}`);
  return directory;
}

async function runResume(taskId: string): Promise<number> {
  const task = await getTask(taskId);
  if (task.status !== 'in-progress' && task.status !== 'in-review') {
    log(
      'ERROR',
      `Cannot resume task ${taskId.slice(0, 8)}: status is '${task.status}' (expected in-progress or in-review)`,
    );
    return 1;
  }

  const inputs = await collectRecoveryInputs(task);
  const prelock = classifyRecovery(inputs);
  if (prelock.kind !== 'resumable') {
    const detail = prelock.kind === 'manual' ? ` (${prelock.code})` : '';
    log(
      'ERROR',
      `Task ${task.id.slice(0, 8)} is not resumable: pre-lock verdict is ${prelock.kind}${detail} — ${prelock.reason}`,
    );
    if (prelock.kind === 'complete-safe')
      log('INFO', `Run \`bun scripts/next.ts --recover\` to mark it completed`);
    return 1;
  }

  if (!acquireTaskLock(task.id)) {
    log('ERROR', `Could not acquire lock for ${task.id.slice(0, 8)} — another process holds it`);
    return 1;
  }
  const lockPath = lockDirectory(task.id);

  try {
    // Post-lock reclassification.
    const freshTask = await getTask(task.id);
    if (freshTask.status !== 'in-progress' && freshTask.status !== 'in-review') {
      log(
        'ERROR',
        `Task ${task.id.slice(0, 8)} status drifted to '${freshTask.status}' — aborting resume`,
      );
      return 1;
    }
    const freshInputs = await collectRecoveryInputs(freshTask);
    const fresh = classifyRecovery(freshInputs);
    const prelockFp = verdictFingerprint(prelock);
    const freshFp = verdictFingerprint(fresh);
    if (prelockFp !== freshFp) {
      log('WARN', `verdict drift during lock acquisition: ${prelockFp} → ${freshFp}`);
    }
    if (fresh.kind !== 'resumable') {
      const detail = fresh.kind === 'manual' ? ` (${fresh.code})` : '';
      log('ERROR', `Post-lock verdict changed to ${fresh.kind}${detail} — ${fresh.reason}`);
      return 1;
    }

    // Determine authoritative branch.
    const authoritativeBranch = fresh.needsPr
      ? fresh.branch
      : (fresh.pr.headRefName ?? freshTask.branch ?? taskBranchName(freshTask.id));
    if (freshTask.branch !== authoritativeBranch) {
      log(
        'INFO',
        `Repairing task.branch: ${freshTask.branch ?? '(null)'} → ${authoritativeBranch}`,
      );
      await setBranch(freshTask.id, authoritativeBranch);
      await addProgress(
        freshTask.id,
        `recovery: repaired task.branch from ${freshTask.branch ?? '(null)'} to ${authoritativeBranch} on resume`,
      );
    }

    await fetchBase('main');
    await fetchBranch(authoritativeBranch);

    // Reconstitute worktree.
    let worktreePath = findWorktreeForTask(freshTask.id);
    if (worktreePath) {
      if (await isWorktreeDirty(worktreePath)) {
        log(
          'ERROR',
          `Worktree at ${worktreePath} is dirty — manual recovery required, refusing to overwrite`,
        );
        return 1;
      }
    } else {
      worktreePath = await createWorktreeFromRemote(freshTask.id, authoritativeBranch);
    }

    // Re-enter pipeline.
    let pr: PrSummary;
    if (fresh.needsPr) {
      log('PHASE', `Opening PR for ${palette.task(authoritativeBranch)} (resume → ensurePr)`);
      pr = await ensurePr(freshTask, worktreePath, authoritativeBranch);
      await recordPhase(freshTask.id, 'pr-created');
    } else {
      pr = fresh.pr;
    }

    const result = await finishPrPhase(freshTask, worktreePath, pr);
    log(
      'OK',
      palette.bold(
        palette.ok(`Task ${freshTask.id.slice(0, 8)} resumed and shipped — PR #${result.prNumber}`),
      ),
    );
    return 0;
  } catch (error) {
    log('ERROR', `Resume failed: ${(error as Error).message}`);
    return 1;
  } finally {
    releaseLock(lockPath);
  }
}

/** Fetch a single remote branch by name. */
async function fetchBranch(branch: string): Promise<void> {
  log('PHASE', `Fetching origin/${branch}`);
  const result = await run(['git', 'fetch', 'origin', branch], { cwd: repoRoot });
  if (result.exitCode !== 0) {
    throw new Error(`git fetch origin ${branch} failed: ${result.stderr.trim()}`);
  }
}

// =============================================================================
// One-task pipeline
// =============================================================================

/**
 * Drive a PR from open through merged. Extracted so both runOneTask and the
 * --resume driver share the same back half.
 *
 * Side effects: sets task status to in-review, polls/addresses the PR, removes
 * the worktree before merging, merges the PR, sets task status to completed.
 */
async function finishPrPhase(
  task: Task,
  worktree: string,
  pr: PrSummary,
): Promise<{ taskId: string; prNumber: number }> {
  const shortId = task.id.slice(0, 8);

  log('PHASE', `Setting ${palette.task(shortId)} to in-review`);
  await setStatus(task.id, 'in-review');
  await recordPhase(task.id, 'in-review');

  const expectedBots = parseExpectedBots(process.env.NEXT_EXPECTED_BOTS) ?? DEFAULT_EXPECTED_BOTS;
  await pollPrUntilReady(pr.number, worktree, expectedBots);
  await recordPhase(task.id, 'address-pr');

  // Tear down the worktree before merging so `gh pr merge --delete-branch`
  // can drop the local branch. Otherwise git refuses with "branch used by
  // worktree" and gh exits non-zero even though the remote merge succeeded.
  log('PHASE', `Removing worktree before merge`);
  await cleanupWorktree(worktree);

  log('PHASE', `Merging PR #${pr.number}`);
  await mergePr(pr.number);
  await recordPhase(task.id, 'merge');

  log('PHASE', `Marking ${palette.task(shortId)} as completed`);
  await setStatus(task.id, 'completed');

  return { taskId: task.id, prNumber: pr.number };
}

async function runOneTask(): Promise<{ taskId: string; prNumber: number } | null> {
  const next = await claimNextTask();
  if (!next) {
    log('INFO', 'No available tasks (or all available are locked by other workers)');
    return null;
  }
  const shortId = next.id.slice(0, 8);
  const lockPath = lockDirectory(next.id);
  log('TASK', `${palette.bold(palette.task(`Task ${shortId}`))}: ${next.title}`);

  let task = await ensurePlan(next);

  log('PHASE', `Marking ${palette.task(shortId)} as in-progress`);
  await setStatus(task.id, 'in-progress');
  await recordPhase(task.id, 'claim');

  await fetchBase('main');

  const branch = taskBranchName(task.id);
  let worktree: string | null = null;

  // Track how far we got so the cleanup block can pick the right recovery
  // status. Crash before a PR exists → roll the task back to `ready` so a
  // future run can retry it. After PR exists, leave it `in-review` so a
  // human can take over without losing the branch/PR context.
  let prCreated = false;
  let completed = false;

  try {
    worktree = await createWorktree(task.id, branch, 'main');
    await setBranch(task.id, branch);
    await recordPhase(task.id, 'branch-set');

    await driveImplementation(task, worktree, join(repoRoot, task.plan!));

    const commitsAhead = await countCommitsAhead(worktree, 'main');
    if (commitsAhead === 0) {
      throw new Error(`No commits on ${branch} after implementation phase — agent did not commit`);
    }
    log('OK', `${commitsAhead} commit(s) on ${palette.task(branch)}`);
    await recordPhase(task.id, 'push');

    const pr = await ensurePr(task, worktree, branch);
    prCreated = true;
    await recordPhase(task.id, 'pr-created');

    const result = await finishPrPhase(task, worktree, pr);
    worktree = null;
    completed = true;

    log('OK', palette.bold(palette.ok(`Task ${shortId} shipped — PR #${result.prNumber}`)));
    return result;
  } finally {
    if (!completed && !prCreated) {
      // Best-effort: return the task to the queue so another run can claim it.
      // Suppress errors — we are already in a failure path.
      try {
        await setStatus(task.id, 'ready');
        log('INFO', `Rolled task ${shortId} back to ready`);
      } catch (error) {
        log('WARN', `Could not reset task ${shortId} to ready: ${(error as Error).message}`);
      }
    }
    if (worktree) {
      // Pass the branch only when the task completed (merged) — on failure
      // paths we want to keep the local branch around so an operator can
      // inspect it.
      await cleanupWorktree(worktree, completed ? branch : undefined);
    } else if (completed) {
      // Worktree was already removed pre-merge. `gh pr merge --delete-branch`
      // should have dropped the local branch, but a partial failure could
      // have left it behind — best-effort cleanup.
      await run(['git', 'branch', '-d', branch], { cwd: repoRoot });
    }
    releaseLock(lockPath);
  }
}

// =============================================================================
// Concurrency: tmux-backed, with a graceful fallback
// =============================================================================

function hasTmux(): boolean {
  try {
    const result = Bun.spawnSync(['which', 'tmux']);
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

const SELF_PATH = resolve(import.meta.path);

async function runWorkerChild(): Promise<number> {
  // Child mode: run one task and exit. Stays a thin wrapper so the parent
  // logic and child logic share runOneTask().
  try {
    const result = await runOneTask();
    return result ? 0 : 2; // 2 = no work available
  } catch (error) {
    log('ERROR', (error as Error).message);
    return 1;
  }
}

async function spawnWorkerInline(index: number): Promise<number> {
  const tint = palette.worker(index);
  const prefix = tint(`[worker-${index}]`);
  const child = Bun.spawn(['bun', SELF_PATH, '--__worker'], {
    cwd: process.cwd(),
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, NEXT_WORKER_INDEX: String(index) },
  });
  activeChildren.add(child);

  const decoder = new TextDecoder();
  const stream = async (
    source: ReadableStream<Uint8Array>,
    sink: NodeJS.WriteStream,
  ): Promise<void> => {
    let buffer = '';
    for await (const chunk of source) {
      buffer += decoder.decode(chunk, { stream: true });
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        sink.write(`${prefix} ${buffer.slice(0, newline)}\n`);
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
      }
    }
    if (buffer) sink.write(`${prefix} ${buffer}\n`);
  };

  try {
    await Promise.all([
      stream(child.stdout, process.stdout),
      stream(child.stderr, process.stderr),
      child.exited,
    ]);
    return await child.exited;
  } finally {
    activeChildren.delete(child);
  }
}

async function runInlineConcurrency(concurrency: number): Promise<void> {
  log('INFO', palette.heading(`Starting ${concurrency} inline workers (no tmux)`));
  const results = await Promise.all(
    Array.from({ length: concurrency }, (_, index) => spawnWorkerInline(index + 1)),
  );
  const successes = results.filter((code) => code === 0).length;
  const noWork = results.filter((code) => code === 2).length;
  const failures = results.filter((code) => code === 1).length;
  log(
    'OK',
    `Workers finished: ${palette.ok(`${successes} shipped`)}, ${palette.warn(`${noWork} no-work`)}, ${palette.err(`${failures} failed`)}`,
  );
}

/**
 * Run N workers in their own tmux windows.
 *
 * Each window runs `bun next.ts --__worker` directly. We set
 * `remain-on-exit on` on the session so dead panes stay visible (so an
 * operator who attaches after a worker exited can still see its output),
 * but we use `#{pane_dead}` to detect completion — that way the parent
 * does NOT depend on the worker shell staying alive (the original
 * `read -n 1` keep-alive caused an unbounded parent poll).
 */
async function runTmuxConcurrency(concurrency: number): Promise<void> {
  const session = `next-${Date.now().toString(36)}`;
  log('INFO', palette.heading(`Starting ${concurrency} tmux workers in session ${session}`));

  const workerCommand = `bun ${SELF_PATH} --__worker`;

  // Create the session detached with worker 1.
  await runOk([
    'tmux',
    'new-session',
    '-d',
    '-s',
    session,
    '-n',
    'worker-1',
    'bash',
    '-lc',
    `NEXT_WORKER_INDEX=1 ${workerCommand}`,
  ]);

  // Keep dead panes visible so output is still readable on attach.
  await run(['tmux', 'set-option', '-t', session, 'remain-on-exit', 'on']);

  for (let index = 2; index <= concurrency; index++) {
    await runOk([
      'tmux',
      'new-window',
      '-t',
      session,
      '-n',
      `worker-${index}`,
      'bash',
      '-lc',
      `NEXT_WORKER_INDEX=${index} ${workerCommand}`,
    ]);
  }

  log('OK', palette.bold(`tmux session ${palette.task(session)} ready`));
  log('INFO', `Attach: ${palette.dim(`tmux attach -t ${session}`)}`);
  log('INFO', `Kill all workers: ${palette.dim(`tmux kill-session -t ${session}`)}`);

  const TMUX_POLL_TIMEOUT_MS = 6 * 60 * 60 * 1000; // 6 hours
  const start = Date.now();

  while (true) {
    const list = await run([
      'tmux',
      'list-windows',
      '-t',
      session,
      '-F',
      '#{window_name}:#{pane_dead}',
    ]);
    if (list.exitCode !== 0) {
      log('INFO', `tmux session ${session} ended`);
      return;
    }
    const lines = list.stdout.trim().split('\n').filter(Boolean);
    // pane_dead is '1' when the pane's process has exited. With remain-on-exit
    // on, the pane stays so we can read this flag reliably.
    const alive = lines.filter((line) => !line.endsWith(':1')).length;
    if (alive === 0) {
      log('OK', `All ${concurrency} workers finished`);
      await run(['tmux', 'kill-session', '-t', session]);
      return;
    }
    if (Date.now() - start > TMUX_POLL_TIMEOUT_MS) {
      log(
        'ERROR',
        `tmux session ${session} exceeded 6h supervisor timeout — leaving session running for inspection`,
      );
      return;
    }
    await Bun.sleep(15_000);
  }
}

// =============================================================================
// Signal handling — clean up children, locks, and worktrees on Ctrl+C.
//
// The handler runs synchronously after SIGTERMing children. We do NOT await
// async cleanup here: signal handlers must commit before process.exit(), so
// the cleanup uses Bun.spawnSync and synchronous fs ops. Children are given
// 2s to exit on SIGTERM before SIGKILL.
// =============================================================================

let cleaningUp = false;

function cleanupAndExit(code: number): never {
  if (cleaningUp) process.exit(code);
  cleaningUp = true;
  log(
    'WARN',
    `Caught signal — tearing down ${activeChildren.size} child(ren), ${activeWorktrees.size} worktree(s), ${heldLocks.size} lock(s)`,
  );

  // 1. SIGTERM all active children.
  for (const child of activeChildren) {
    try {
      child.kill('SIGTERM');
    } catch {
      // best effort
    }
  }

  // 2. Brief grace period, then SIGKILL anything that ignored SIGTERM.
  //    Bun.sleepSync blocks the event loop, which is what we want here.
  Bun.sleepSync(2000);
  for (const child of activeChildren) {
    try {
      child.kill('SIGKILL');
    } catch {
      // best effort
    }
  }

  // 3. Release lock directories so the next run isn't blocked.
  for (const directory of heldLocks) {
    try {
      rmSync(directory, { recursive: true, force: true });
    } catch {
      // best effort
    }
  }

  // 4. Remove worktrees synchronously. `git worktree remove --force` is fast
  //    and bounded; we accept a few hundred ms per worktree.
  for (const directory of activeWorktrees) {
    if (!existsSync(directory)) continue;
    try {
      Bun.spawnSync(['git', 'worktree', 'remove', '--force', directory], { cwd: repoRoot });
    } catch {
      // best effort
    }
  }

  process.exit(code);
}

process.on('SIGINT', () => cleanupAndExit(130));
process.on('SIGTERM', () => cleanupAndExit(143));

// =============================================================================
// CLI entry
// =============================================================================

const HELP = `${palette.heading('bun scripts/next.ts')} — task → merged-PR pipeline

${palette.bold('Usage')}
  bun scripts/next.ts                       Run one task to completion
  bun scripts/next.ts --concurrency <n>     Run n tasks in parallel (tmux if available)
  bun scripts/next.ts --serialize           Keep pulling tasks until \`tasks next\` is empty
  bun scripts/next.ts --serialize --concurrency <n>
                                            Run batches of n until the queue drains
  bun scripts/next.ts --recover             Run a recovery sweep and exit (annotate-only)
  bun scripts/next.ts --recover-then-run    Sweep first, then claim and run the next task
  bun scripts/next.ts --resume <task-id>    Continue a resumable task through merge
  bun scripts/next.ts --help                Show this help

${palette.bold('Recovery')}
  --recover scans tasks left in in-progress/in-review (by a kill -9, crash,
  or sleep), classifies each as rollback-safe / complete-safe / resumable /
  manual, and records a progress note describing what was found. It never
  destroys local work and never creates PRs. --resume <task-id> is the only
  path that can re-enter the PR phase (poll + merge + complete) for a single
  resumable task.

${palette.bold('Pipeline')}
  1. ${palette.dim('tasks next')} — pull the highest-priority available task
  2. ${palette.dim('claude -p')} drafts a plan (inline prompt + plan-review) if missing
  3. ${palette.dim('tasks set-status in-progress')}
  4. ${palette.dim('git fetch origin main')} (workers never touch the main checkout)
  5. Create an isolated worktree on branch ${palette.task('next/<short-id>')}
  6. ${palette.dim('claude -p --model sonnet')} (cwd = worktree) drives
     implementation + commit + ${palette.task('committee-review')}
  7. Open a PR if one doesn't already exist
  8. ${palette.dim('tasks set-status in-review')}
  9. Poll PR with ${palette.dim('tasks pr')}, drive ${palette.task('/address-pr')} until clean
  10. Squash-merge and mark the task ${palette.ok('completed')}

${palette.bold('Concurrency')}
  With ${palette.dim('--concurrency')} > 1, spawns N child workers — each one runs the
  full pipeline above against a different task. tmux is used when available;
  otherwise output is multiplexed inline with per-worker color prefixes.

${palette.bold('Environment')}
  Requires: bun, claude (with --dangerously-skip-permissions), gh, tasks, git.
  ${palette.dim('NEXT_EXPECTED_BOTS')}  Comma-separated list of bot logins to wait for before
                       deciding a PR is ready (default: copilot-pull-request-reviewer).
                       Set to a single space to disable bot-waiting entirely.
`;

/**
 * Verify the binaries and skills this script depends on are reachable before
 * we claim any task. Fail-fast here is much cheaper than discovering a
 * missing dependency mid-pipeline (after a worktree exists and a task is
 * marked in-progress).
 */
async function preflightChecks(): Promise<void> {
  const required = ['git', 'gh', 'tasks', 'claude', 'bun'];
  const missing: string[] = [];
  await Promise.all(
    required.map(async (binary) => {
      const result = await run(['which', binary]);
      if (result.exitCode !== 0) missing.push(binary);
    }),
  );
  if (missing.length > 0) {
    throw new Error(`Missing required binaries on PATH: ${missing.join(', ')}`);
  }

  // gh must be authenticated; otherwise pr create/merge will fail later in
  // the pipeline with a less-actionable error.
  const auth = await run(['gh', 'auth', 'status']);
  if (auth.exitCode !== 0) {
    throw new Error(`gh is not authenticated. Run \`gh auth login\` first.\n${auth.stderr.trim()}`);
  }

  // Smoke-test `claude -p` with the model we'll actually use. This catches
  // a missing API key, an invalid model alias, and an unrunnable claude
  // install — all of which are unfun to discover after claiming a task.
  // We send the cheapest possible prompt and bound the call at 30s.
  log('INFO', 'Validating claude -p invocation (cheap smoke test)…');
  const claudeCheck = await run(
    [
      'claude',
      '-p',
      '--dangerously-skip-permissions',
      '--model',
      'sonnet',
      'reply with the single word: ok',
    ],
    { env: { ...process.env, CLAUDE_BUDGET_MS: '30000' }, tee: true },
  );
  if (claudeCheck.exitCode !== 0) {
    throw new Error(
      `claude -p smoke test failed (exit ${claudeCheck.exitCode}):\n${claudeCheck.stderr.trim() || claudeCheck.stdout.trim()}`,
    );
  }
  log('OK', 'claude -p is reachable');
}

type ParsedNextArgs = {
  help?: boolean;
  concurrency?: string;
  serialize?: boolean;
  __worker?: boolean;
  recover?: boolean;
  'recover-then-run'?: boolean;
  resume?: string;
};

/** Whether the parent process should run a recovery sweep. */
export function shouldRunRecoverySweep(values: ParsedNextArgs): boolean {
  if (values.__worker) return false;
  return Boolean(values.recover) || Boolean(values['recover-then-run']);
}

/** Whether the parent process should run --resume <task-id>. */
export function shouldRunResume(values: ParsedNextArgs): boolean {
  if (values.__worker) return false;
  return typeof values.resume === 'string' && values.resume.length > 0;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      help: { type: 'boolean', short: 'h' },
      concurrency: { type: 'string' },
      serialize: { type: 'boolean' },
      __worker: { type: 'boolean' },
      recover: { type: 'boolean' },
      'recover-then-run': { type: 'boolean' },
      resume: { type: 'string' },
    },
    allowPositionals: false,
  }) as { values: ParsedNextArgs };

  if (values.help) {
    process.stdout.write(HELP);
    return;
  }

  repoRoot = await resolveRepoRoot();

  if (values.__worker) {
    const index = process.env.NEXT_WORKER_INDEX ?? '?';
    logPrefix = palette.worker(Number.parseInt(index, 10) || 0)(`[worker-${index}]`);
    const code = await runWorkerChild();
    process.exit(code);
  }

  await preflightChecks();

  if (shouldRunResume(values)) {
    const code = await runResume(values.resume!);
    process.exit(code);
  }

  if (shouldRunRecoverySweep(values)) {
    await runRecoverySweep();
    if (!values['recover-then-run']) return;
    // Fall through to normal claim/run loop.
  }

  const concurrency = values.concurrency ? Number.parseInt(values.concurrency, 10) : 1;
  if (!Number.isFinite(concurrency) || concurrency < 1) {
    throw new Error(`--concurrency must be a positive integer, got: ${values.concurrency}`);
  }

  const serialize = Boolean(values.serialize);

  if (concurrency > 1) {
    log(
      'WARN',
      palette.warn(
        `Concurrency ${concurrency}: \`tasks next\` is not atomic — two workers can claim the same task. ` +
          `If your tasks CLI supports an atomic claim, prefer that. Watch worker logs for branch collisions.`,
      ),
    );
  }

  if (concurrency === 1 && !serialize) {
    await runOneTask();
    return;
  }

  if (concurrency === 1 && serialize) {
    let batch = 0;
    while (true) {
      batch++;
      log('INFO', palette.heading(`Serialize batch ${batch}`));
      const peek = await fetchNextTask();
      if (!peek) {
        log('OK', palette.bold(palette.ok(`Queue drained after ${batch - 1} task(s)`)));
        return;
      }
      const result = await runOneTask();
      if (!result) {
        log('OK', palette.bold(palette.ok(`Queue drained after ${batch - 1} task(s)`)));
        return;
      }
    }
  }

  // Concurrency > 1: run a batch. If --serialize, keep batching until empty.
  let batch = 0;
  while (true) {
    batch++;
    const peek = await fetchNextTask();
    if (!peek) {
      log('OK', palette.bold(palette.ok(`Queue drained after ${batch - 1} batch(es)`)));
      return;
    }
    if (serialize)
      log('INFO', palette.heading(`Serialize batch ${batch} (concurrency ${concurrency})`));

    if (hasTmux()) {
      await runTmuxConcurrency(concurrency);
    } else {
      log('WARN', 'tmux not found — falling back to inline output multiplexing');
      await runInlineConcurrency(concurrency);
    }

    if (!serialize) return;
  }
}

main().catch((error) => {
  log('ERROR', (error as Error).message);
  process.exit(1);
});
