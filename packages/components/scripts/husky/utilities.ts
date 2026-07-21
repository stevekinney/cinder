import { $ } from 'bun';
import chalk from 'chalk';
import { capitalCase } from 'change-case';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { mkdir, open, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isObjectRecord } from '../validation-utilities.ts';

/**
 * Absolute path to the repository root, resolved from this file's location.
 * `utilities.ts` lives at `packages/components/scripts/husky/utilities.ts`,
 * so four levels up lands at the workspace root.
 */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

/** Placeholder before a Promise's resolver is captured from its executor. */
function noop(): void {}

/**
 * Read the `code` from a caught value if it looks like a Node system error
 * (`NodeJS.ErrnoException`). Returns `undefined` for anything without a string
 * `code` — avoids an unsafe `as NodeJS.ErrnoException` assertion on `unknown`.
 */
function errnoCode(caught: unknown): string | undefined {
  if (typeof caught === 'object' && caught !== null && 'code' in caught) {
    const { code } = caught;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

export const isContinuousIntegration = () => Bun.env['CI'] === 'true' || Bun.env['CI'] === '1';

export function header(title: string) {
  const text = capitalCase(title);
  console.log('\n' + chalk.bgBlue.black(` ${text} `));
}

export const info = (msg: string) => console.log(chalk.cyan(msg));
export const success = (msg: string) => console.log(chalk.green(msg));
export const warning = (msg: string) => console.log(chalk.yellow(msg));
export const error = (msg: string) => console.error(chalk.red(msg));

export type GateScript = 'lint' | 'typecheck' | 'test';

/**
 * The maximum number of jobs that may run concurrently for a given gate
 * script. This is the side-effect-free seam the regression test imports to
 * assert the concurrency policy without triggering the gate entry path's
 * process.exit / stdin-read side effects.
 *
 * All three gate scripts — lint, typecheck, and test — share the same
 * CPU-bound cap, kept general (rather than hardcoded to pre-commit's actual
 * `typecheck`-only usage) so a future gate script inherits the same policy for
 * free. The `test` case in {@link GateScript} and this function's
 * equal-across-scripts policy are kept because `check:pipeline-coverage` and
 * CI jobs still reason about the same script names, and a future local test
 * dispatch should inherit this cap rather than reinvent it.
 */
export function phaseMaxConcurrency(_script: GateScript): number {
  // CPU-bound default (up to 4 workers). The `?? 1` guards environments where
  // `navigator.hardwareConcurrency` is undefined; `Math.max(1, …)` ensures the
  // floor stays at 1 so a zero / negative value never silently skips all jobs.
  return Math.max(1, Math.min(navigator.hardwareConcurrency ?? 1, 4));
}

/**
 * Run `items` through a bounded async pool, invoking `worker(item, index)` for
 * each and returning the results in input order. At most `maxConcurrency`
 * workers run at once — this is the *mechanism* that {@link phaseMaxConcurrency}
 * feeds (currently pre-commit's parallel per-package typecheck).
 *
 * The concurrency floor is defensive. A non-finite `maxConcurrency` — e.g. a
 * caller computing `Math.min(navigator.hardwareConcurrency, 4)` where
 * `hardwareConcurrency` is `undefined`, yielding `NaN` — must NOT slip through:
 * `NaN` would make `Math.min(concurrency, items.length)` `NaN`, start zero
 * workers, and silently resolve every item to `undefined` — a false green.
 * `Number.isFinite` rejects `NaN`/±Infinity; `Math.max(1, …)` then guards
 * `0`/negatives. This binding lives in ONE place so the hook's job runner and
 * the regression test share the same guarantee.
 */
export async function runWithConcurrencyPool<Item, Result>(
  items: readonly Item[],
  maxConcurrency: number,
  worker: (item: Item, index: number) => Promise<Result>,
): Promise<Result[]> {
  if (items.length === 0) return [];
  const concurrency = Number.isFinite(maxConcurrency) ? Math.max(1, Math.floor(maxConcurrency)) : 1;
  const results: Result[] = Array.from({ length: items.length });
  let nextIndex = 0;
  const workers: Promise<void>[] = [];
  for (let workerId = 0; workerId < Math.min(concurrency, items.length); workerId++) {
    workers.push(
      (async () => {
        while (true) {
          const index = nextIndex++;
          if (index >= items.length) return;
          results[index] = await worker(items[index]!, index);
        }
      })(),
    );
  }
  await Promise.all(workers);
  return results;
}

type HookSignal = 'SIGINT' | 'SIGTERM' | 'SIGHUP';
type CleanupSignal = HookSignal | 'SIGKILL';

const SIGNAL_EXIT_CODES: Record<HookSignal, number> = {
  SIGHUP: 129,
  SIGINT: 130,
  SIGTERM: 143,
};

const activeHookProcessGroups = new Set<number>();
let cleanupHandlersInstalled = false;
let signalCleanupStarted = false;
let hookSignalCleanupPromise: Promise<void> | undefined;

export type HookCommandResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

export type HookCommandOptions = {
  readonly cwd?: string;
  readonly environment?: Record<string, string | undefined>;
  readonly signal?: AbortSignal;
  readonly stdout?: 'inherit' | 'pipe';
  readonly stderr?: 'inherit' | 'pipe';
};

type HookSignalCleanupOptions = {
  readonly exitAfterCleanup?: boolean;
};

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}

function readStreamText(stream: unknown): Promise<string> {
  return stream instanceof ReadableStream ? new Response(stream).text() : Promise.resolve('');
}

const STREAM_DRAIN_GRACE_MILLISECONDS = 1_000;

async function readCapturedStreamsWithGrace(
  stdoutText: Promise<string>,
  stderrText: Promise<string>,
  onTimeout: () => Promise<void>,
): Promise<{ readonly stdout: string; readonly stderr: string }> {
  const captured = Promise.all([stdoutText, stderrText]).then(([stdout, stderr]) => ({
    stderr,
    stdout,
  }));
  const drained = await Promise.race([
    captured,
    Bun.sleep(STREAM_DRAIN_GRACE_MILLISECONDS).then(() => null),
  ]);

  if (drained !== null) return drained;

  await onTimeout();

  return (
    (await Promise.race([
      captured,
      Bun.sleep(STREAM_DRAIN_GRACE_MILLISECONDS).then(() => null),
    ])) ?? { stderr: '', stdout: '' }
  );
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function isProcessGroupAlive(pid: number): boolean {
  try {
    process.kill(-pid, 0);
    return true;
  } catch {
    return isProcessAlive(pid);
  }
}

function signalProcessGroup(pid: number, signal: CleanupSignal): void {
  try {
    process.kill(-pid, signal);
    return;
  } catch {
    // If the process-group signal fails, fall back to the direct child. This
    // keeps cleanup best-effort without hiding the primary process-group path.
  }

  try {
    process.kill(pid, signal);
  } catch {
    // Process already exited.
  }
}

function drainActiveProcessGroups(): number[] {
  const pids = [...activeHookProcessGroups];
  activeHookProcessGroups.clear();
  return pids;
}

export function cleanupHookProcessesImmediately(signal: CleanupSignal = 'SIGTERM'): void {
  for (const pid of drainActiveProcessGroups()) {
    signalProcessGroup(pid, signal);
  }
}

export async function cleanupHookProcesses(signal: CleanupSignal = 'SIGTERM'): Promise<void> {
  const pids = drainActiveProcessGroups();
  await cleanupProcessGroups(pids, signal);
}

async function cleanupProcessGroups(pids: readonly number[], signal: CleanupSignal): Promise<void> {
  for (const pid of pids) {
    signalProcessGroup(pid, signal);
  }

  await Bun.sleep(250);

  for (const pid of pids) {
    if (isProcessGroupAlive(pid)) {
      signalProcessGroup(pid, 'SIGKILL');
    }
  }
}

export async function cleanupForHookSignal(
  signal: HookSignal,
  options: HookSignalCleanupOptions = {},
): Promise<void> {
  if (signalCleanupStarted) return;
  signalCleanupStarted = true;
  hookSignalCleanupPromise = cleanupHookProcesses(signal);
  await hookSignalCleanupPromise;
  if (options.exitAfterCleanup ?? true) {
    process.exit(SIGNAL_EXIT_CODES[signal]);
  }
}

export function installHookProcessCleanup(): void {
  if (cleanupHandlersInstalled) return;
  cleanupHandlersInstalled = true;

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(signal, () => {
      void cleanupForHookSignal(signal);
    });
  }

  process.on('exit', () => {
    cleanupHookProcessesImmediately('SIGTERM');
  });
}

export async function runHookCommand(
  command: string,
  args: readonly string[],
  options: HookCommandOptions = {},
): Promise<HookCommandResult> {
  const stdout = options.stdout ?? 'inherit';
  const stderr = options.stderr ?? 'inherit';
  let aborted = false;
  let abortCleanup: Promise<void> | undefined;
  let notifyAbort: () => void = noop;
  const abortObserved = new Promise<void>((_resolve) => {
    notifyAbort = _resolve;
  });

  let subprocess: ReturnType<typeof Bun.spawn>;
  try {
    subprocess = Bun.spawn([command, ...args], {
      detached: true,
      env: { ...Bun.env, ...options.environment },
      stderr,
      stdin: 'ignore',
      stdout,
      ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    });
  } catch (spawnError) {
    const message = errorMessage(spawnError);
    if (stderr === 'inherit') {
      error(message);
    }
    return {
      exitCode: 1,
      stderr: message,
      stdout: '',
    };
  }

  activeHookProcessGroups.add(subprocess.pid);

  const abort = () => {
    aborted = true;
    abortCleanup ??= cleanupProcessGroups([subprocess.pid], 'SIGTERM');
    notifyAbort();
  };

  options.signal?.addEventListener('abort', abort, { once: true });

  try {
    if (options.signal?.aborted) {
      abort();
    }

    const stdoutText = stdout === 'pipe' ? readStreamText(subprocess.stdout) : Promise.resolve('');
    const stderrText = stderr === 'pipe' ? readStreamText(subprocess.stderr) : Promise.resolve('');

    const exitCodePromise = (async () => {
      const result = await Promise.race([
        subprocess.exited.then((exitCode) => ({ exitCode, type: 'exit' as const })),
        abortObserved.then(() => ({ exitCode: 130, type: 'abort' as const })),
      ]);

      if (result.type === 'abort' || aborted) {
        await abortCleanup;
        return 130;
      }

      return result.exitCode ?? 1;
    })();

    const exitCode = await exitCodePromise;

    const captured = await readCapturedStreamsWithGrace(stdoutText, stderrText, async () => {
      abortCleanup ??= cleanupProcessGroups([subprocess.pid], 'SIGTERM');
      await abortCleanup;
    });

    return {
      exitCode: aborted ? 130 : exitCode,
      stderr: captured.stderr,
      stdout: captured.stdout,
    };
  } finally {
    options.signal?.removeEventListener('abort', abort);
    if (aborted) {
      await abortCleanup;
    }
    if (hookSignalCleanupPromise) {
      await hookSignalCleanupPromise;
    }
    activeHookProcessGroups.delete(subprocess.pid);
  }
}

type GateLockFile = {
  readonly createdAt: string;
  readonly pid: number;
  readonly repositoryRoot: string;
  readonly token: string;
};

type GateLockOptions = {
  readonly beforeMalformedLockStat?: () => void | Promise<void>;
  readonly isProcessAlive?: (pid: number) => boolean;
  readonly lockPath?: string;
  readonly malformedLockGraceMilliseconds?: number;
  readonly retryMilliseconds?: number;
  readonly resendSignal?: (signal: NodeJS.Signals) => void;
  readonly waitMilliseconds?: number;
};

const DEFAULT_MALFORMED_GATE_LOCK_GRACE_MILLISECONDS = 30_000;
const DEFAULT_GATE_LOCK_RETRY_MILLISECONDS = 1_000;
const DEFAULT_GATE_LOCK_WAIT_MILLISECONDS = 5 * 60 * 1_000;
export const LOCAL_VALIDATION_GATE_LOCK_HELD_ENV = 'CINDER_LOCAL_VALIDATION_GATE_LOCK_HELD';

export function gitCommonDirectory(repositoryRoot = REPO_ROOT): string {
  try {
    const commonDirectory = execFileSync(
      'git',
      ['-C', repositoryRoot, 'rev-parse', '--path-format=absolute', '--git-common-dir'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    ).trim();
    if (commonDirectory.length > 0) return commonDirectory;
  } catch {
    // Fall through to the repository-local path for non-Git test fixtures.
  }
  return join(repositoryRoot, '.git');
}

export function gateLockPathForCommonDirectory(commonDirectory: string): string {
  const commonDirectoryHash = createHash('sha256')
    .update(commonDirectory)
    .digest('hex')
    .slice(0, 16);
  return join(tmpdir(), 'cinder-local-validation-gates', `${commonDirectoryHash}.lock`);
}

export function defaultGateLockPath(repositoryRoot = REPO_ROOT): string {
  return gateLockPathForCommonDirectory(gitCommonDirectory(repositoryRoot));
}

function createGateLockFile(token: string): GateLockFile {
  return {
    createdAt: new Date().toISOString(),
    pid: process.pid,
    repositoryRoot: REPO_ROOT,
    token,
  };
}

function defaultIsProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (caught) {
    const errorCode = errnoCode(caught);
    if (errorCode === 'ESRCH') return false;
    return true;
  }
}

function parseGateLock(raw: string): GateLockFile | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isObjectRecord(value)) return null;
    const record = value;
    if (
      typeof record['createdAt'] !== 'string' ||
      typeof record['pid'] !== 'number' ||
      typeof record['repositoryRoot'] !== 'string' ||
      typeof record['token'] !== 'string'
    ) {
      return null;
    }
    return {
      createdAt: record['createdAt'],
      pid: record['pid'],
      repositoryRoot: record['repositoryRoot'],
      token: record['token'],
    };
  } catch {
    return null;
  }
}

async function readGateLock(lockPath: string): Promise<GateLockFile | null> {
  try {
    return parseGateLock(await readFile(lockPath, 'utf8'));
  } catch {
    return null;
  }
}

async function lockAgeMilliseconds(lockPath: string): Promise<number> {
  const fileStats = await stat(lockPath);
  return Date.now() - fileStats.mtimeMs;
}

function releaseGateLockSync(lockPath: string, token: string) {
  try {
    const lock = parseGateLock(readFileSync(lockPath, 'utf8'));
    if (lock?.token === token) rmSync(lockPath, { force: true });
  } catch {
    // Best-effort cleanup: the lock may already have been removed.
  }
}

/**
 * Run expensive local validation work under a shared repository lock so
 * concurrent invocations from linked worktrees do not stack full
 * workspace-scale work (builds, installs, generated-artifact writes) on top
 * of one another.
 */
export async function withGateLock<T>(
  run: () => Promise<T>,
  options: GateLockOptions = {},
): Promise<T> {
  const lockPath = options.lockPath ?? defaultGateLockPath();
  const malformedLockGraceMilliseconds =
    options.malformedLockGraceMilliseconds ?? DEFAULT_MALFORMED_GATE_LOCK_GRACE_MILLISECONDS;
  const retryMilliseconds = options.retryMilliseconds ?? DEFAULT_GATE_LOCK_RETRY_MILLISECONDS;
  const waitMilliseconds = options.waitMilliseconds ?? DEFAULT_GATE_LOCK_WAIT_MILLISECONDS;
  const processAlive = options.isProcessAlive ?? defaultIsProcessAlive;
  const resendSignal = options.resendSignal ?? ((signal) => process.kill(process.pid, signal));
  const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const startedAt = Date.now();
  let waitingMessagePrinted = false;
  let lockAcquired = false;
  let interruptedSignal: NodeJS.Signals | null = null;

  const release = () => {
    if (!lockAcquired) return;
    releaseGateLockSync(lockPath, token);
    lockAcquired = false;
  };

  const handleSignal = (signal: NodeJS.Signals) => {
    interruptedSignal ??= signal;
  };
  const handleSigint = () => handleSignal('SIGINT');
  const handleSigterm = () => handleSignal('SIGTERM');

  while (true) {
    await mkdir(dirname(lockPath), { recursive: true });
    let handle: Awaited<ReturnType<typeof open>> | null = null;
    let enteredRun = false;
    try {
      handle = await open(lockPath, 'wx');
      await handle.writeFile(JSON.stringify(createGateLockFile(token), null, 2) + '\n');
      await handle.close();
      handle = null;
      lockAcquired = true;
      process.once('SIGINT', handleSigint);
      process.once('SIGTERM', handleSigterm);
      try {
        enteredRun = true;
        return await run();
      } finally {
        process.off('SIGINT', handleSigint);
        process.off('SIGTERM', handleSigterm);
        release();
        if (interruptedSignal !== null) resendSignal(interruptedSignal);
      }
    } catch (caught) {
      await handle?.close();
      if (enteredRun) throw caught;
      const errorCode = errnoCode(caught);
      if (errorCode !== 'EEXIST') throw caught;

      const existingLock = await readGateLock(lockPath);
      if (existingLock === null) {
        await options.beforeMalformedLockStat?.();
        let existingLockAgeMilliseconds = 0;
        try {
          existingLockAgeMilliseconds = await lockAgeMilliseconds(lockPath);
        } catch (statError) {
          if (errnoCode(statError) === 'ENOENT') continue;
          throw statError;
        }
        if (existingLockAgeMilliseconds >= malformedLockGraceMilliseconds) {
          warning('Removing stale malformed local validation gate lock.');
          await rm(lockPath, { force: true });
          continue;
        }
        if (!waitingMessagePrinted) {
          warning(
            'Another local validation gate is preparing its lock file. Waiting for it to finish…',
          );
          waitingMessagePrinted = true;
        }
        if (Date.now() - startedAt >= waitMilliseconds) {
          throw new Error(
            `Another local validation gate left a malformed lock at ${lockPath}; waited ${waitMilliseconds}ms before giving up.`,
            { cause: caught },
          );
        }
        await Bun.sleep(retryMilliseconds);
        continue;
      }

      if (!processAlive(existingLock.pid)) {
        warning('Removing stale local validation gate lock.');
        await rm(lockPath, { force: true });
        continue;
      }

      if (!waitingMessagePrinted) {
        warning(
          `Another local validation gate is already running for ${existingLock.repositoryRoot} (pid ${existingLock.pid}). Waiting for it to finish…\n` +
            `  Inspect with: ps -p ${existingLock.pid} -o pid,ppid,etime,stat,command`,
        );
        waitingMessagePrinted = true;
      }

      if (Date.now() - startedAt >= waitMilliseconds) {
        throw new Error(
          `Another local validation gate is already running (pid ${existingLock.pid}); waited ${waitMilliseconds}ms for ${lockPath}.`,
          { cause: caught },
        );
      }

      await Bun.sleep(retryMilliseconds);
    }
  }
}

/**
 * Serialize expensive local validation gates across worktrees.
 *
 * The lock remains for scripts that do heavy, disk-mutating local work:
 * `test-changed.ts` (`bun run test:changed`),
 * `generate-component-artifacts.ts` (`components:generate`), and
 * `validate-consumers.ts` (`validate:consumer`) each call this directly when
 * run standalone, so concurrent worktrees do not stack full builds/installs
 * on top of one another. The marker below lets a script that's already inside
 * one of those locked runs call another without deadlocking on the same lock.
 */
export async function withLocalValidationGateLock<T>(
  run: () => Promise<T>,
  options: GateLockOptions = {},
): Promise<T> {
  if (Bun.env[LOCAL_VALIDATION_GATE_LOCK_HELD_ENV] === '1') return await run();

  return await withGateLock(async () => {
    const previousValue = Bun.env[LOCAL_VALIDATION_GATE_LOCK_HELD_ENV];
    Bun.env[LOCAL_VALIDATION_GATE_LOCK_HELD_ENV] = '1';
    try {
      return await run();
    } finally {
      if (previousValue === undefined) {
        delete Bun.env[LOCAL_VALIDATION_GATE_LOCK_HELD_ENV];
      } else {
        Bun.env[LOCAL_VALIDATION_GATE_LOCK_HELD_ENV] = previousValue;
      }
    }
  }, options);
}

export async function getStagedFiles(): Promise<string[]> {
  const out = await $`git diff --cached --name-only`.text();
  return out.split('\n').filter(Boolean);
}

export async function fileChangedBetween(
  file: string,
  prev: string,
  next: string,
): Promise<boolean> {
  const out = await $`git diff --name-only ${prev}..${next} -- ${file}`.text();
  return out.trim().length > 0;
}

export async function printGitStatistics(refA: string, refB: string) {
  const out = await $`git diff --stat ${refA} ${refB}`.text();
  await Bun.write(Bun.stdout, out);
}

/**
 * A workspace package, derived from `packages/<dir>/package.json`.
 * `dir` is the path prefix used to match staged files (always trailing-slashed).
 * `dependencies` holds the names of *other workspace packages* this package
 * depends on (union of `dependencies`/`devDependencies`/`peerDependencies`,
 * filtered to known workspace names) — internal workspace dependency-graph
 * metadata, kept on the type for any future consumer that needs it (no
 * current husky hook expands a reverse-dependency closure locally; CI's
 * scoping lives in `component-graph.ts` / `changed-components.ts`).
 */
export type WorkspacePackage = {
  readonly name: string;
  readonly dir: string;
  readonly hasLint: boolean;
  readonly hasTypecheck: boolean;
  readonly hasTest: boolean;
  readonly dependencies: ReadonlySet<string>;
};

type PackageManifest = {
  name?: unknown;
  scripts?: Record<string, unknown>;
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
  peerDependencies?: Record<string, unknown>;
};

function isManifest(value: unknown): value is PackageManifest {
  if (!isObjectRecord(value)) return false;
  for (const key of ['scripts', 'dependencies', 'devDependencies', 'peerDependencies'] as const) {
    const field = value[key];
    if (field !== undefined && !isObjectRecord(field)) return false;
  }
  return true;
}

/** Collect dependency names across the runtime/dev/peer fields of a manifest. */
function dependencyNames(manifest: PackageManifest): Set<string> {
  const names = new Set<string>();
  for (const field of [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.peerDependencies,
  ]) {
    if (!isObjectRecord(field)) continue;
    for (const name of Object.keys(field)) names.add(name);
  }
  return names;
}

/**
 * Read every `packages/*\/package.json` once and return the derived workspace
 * package list. Packages without a `name` field are skipped. `hasLint`,
 * `hasTypecheck`, and `hasTest` reflect whether the corresponding npm scripts
 * exist, so the hooks can skip-with-reason instead of failing on a missing
 * script. `dependencies` is filtered to other workspace package names so it
 * can drive reverse-dependency closure.
 *
 * Loading is two-pass: the first pass reads every manifest and learns the set
 * of workspace names; the second pass keeps only the dependency edges that
 * point at another workspace package.
 */
export async function loadWorkspacePackages(): Promise<readonly WorkspacePackage[]> {
  const packagesDir = join(REPO_ROOT, 'packages');
  const entries = await readdir(packagesDir, { withFileTypes: true });

  type Loaded = {
    readonly name: string;
    readonly dir: string;
    readonly hasLint: boolean;
    readonly hasTypecheck: boolean;
    readonly hasTest: boolean;
    readonly rawDependencies: Set<string>;
  };

  const loaded: Loaded[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(packagesDir, entry.name, 'package.json');
    const manifestFile = Bun.file(manifestPath);
    if (!(await manifestFile.exists())) continue;
    const raw: unknown = await manifestFile.json();
    if (!isManifest(raw)) continue;
    if (typeof raw.name !== 'string' || raw.name.length === 0) continue;
    const scripts = raw.scripts ?? {};
    loaded.push({
      name: raw.name,
      dir: `packages/${entry.name}/`,
      hasLint: typeof scripts['lint'] === 'string',
      hasTypecheck: typeof scripts['typecheck'] === 'string',
      hasTest: typeof scripts['test'] === 'string',
      rawDependencies: dependencyNames(raw),
    });
  }

  const workspaceNames = new Set(loaded.map((pkg) => pkg.name));
  return loaded.map((pkg) => ({
    name: pkg.name,
    dir: pkg.dir,
    hasLint: pkg.hasLint,
    hasTypecheck: pkg.hasTypecheck,
    hasTest: pkg.hasTest,
    dependencies: new Set([...pkg.rawDependencies].filter((dep) => workspaceNames.has(dep))),
  }));
}

// Extensions that trigger typecheck/test when modified. `.svelte` and `.css`
// are project-specific (Svelte components, component-scoped styles); `.json`
// catches in-package config such as tsconfig.json. Markdown is excluded
// outright in `isSourceFile` because it never affects typecheck/test outcomes.
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.svelte', '.css', '.json']);

/**
 * Decide whether a staged path should trigger typecheck/test for its package.
 * Markdown is excluded outright. Standalone `README*` / `CHANGELOG*` documents
 * (files with no source extension) are also excluded so doc-only commits
 * inside a package don't drag heavy work in. A source file whose basename
 * happens to start with one of those words (`changelog-helpers.ts`) is still
 * treated as source — the extension check runs first.
 */
export function isSourceFile(path: string): boolean {
  const lower = path.toLowerCase();
  if (lower.endsWith('.md')) return false;
  const hasSourceExtension = [...SOURCE_EXTENSIONS].some((ext) => lower.endsWith(ext));
  if (hasSourceExtension) return true;
  const slashIndex = lower.lastIndexOf('/');
  const basename = slashIndex === -1 ? lower : lower.slice(slashIndex + 1);
  if (basename.startsWith('readme') || basename.startsWith('changelog')) return false;
  return false;
}

/**
 * Given the workspace package list and the staged file list, return the
 * subset of packages whose `dir` prefix matches at least one staged source
 * file. Non-source files (docs) are filtered out via `isSourceFile`.
 */
export function getTouchedPackages(
  packages: readonly WorkspacePackage[],
  stagedFiles: readonly string[],
): WorkspacePackage[] {
  const touched = new Set<string>();
  for (const file of stagedFiles) {
    if (!isSourceFile(file)) continue;
    const pkg = packages.find((p) => file.startsWith(p.dir));
    if (pkg) touched.add(pkg.name);
  }
  return packages.filter((p) => touched.has(p.name));
}

/**
 * Root-level files whose changes affect every package and therefore force
 * the pre-commit hook to escalate to a full workspace typecheck + test.
 *
 * Maintenance: this list is hardcoded and there is no automated drift check.
 * When a new root-level lint, formatter, or compiler config is added (or an
 * existing one is renamed), update this list. Code review should flag any
 * new root config that isn't represented here.
 */
const HIGH_IMPACT_ROOT: readonly string[] = [
  'package.json',
  'bun.lock',
  'tsconfig.json',
  'tsconfig.base.json',
  'tsconfig.build.json',
  'tsconfig.check.json',
  'tsconfig.test.json',
  '.oxlintrc.json',
  'bunfig.toml',
  '.prettierrc.json',
  '.stylelintrc.json',
];

/**
 * Return `true` if any changed file is a high-impact root config file that
 * warrants a full workspace validation instead of scoped per-package checks.
 * Pure path predicate — it matches exact repo-root-relative paths against
 * `HIGH_IMPACT_ROOT` and has no coupling to the staged tree, so it is safe to
 * call with any file list (pre-commit calls it with staged files; nothing
 * else does today, since pre-push no longer runs scoped/full local gates).
 */
export function hasRootConfigurationChanges(files: readonly string[]): boolean {
  return files.some((f) => HIGH_IMPACT_ROOT.includes(f));
}

/** The all-zeros object id git uses for a missing ref (new branch, deletion). */
const ZERO_SHA = '0'.repeat(40);

const SHA_PATTERN = /^[0-9a-f]{40}$/i;

/** A single ref update being pushed: the local tip and the remote tip it replaces. */
export type PushRefUpdate = {
  readonly localSha: string;
  /** The remote tip, or {@link ZERO_SHA} for a brand-new branch. */
  readonly remoteSha: string;
};

/**
 * The parsed result of a `pre-push` stdin payload. The shape discriminates the
 * three cases the caller treats differently: real `updates` to scope, an
 * all-deletions push (skip), and empty/no-op stdin (run full as a precaution).
 */
export type ParsedPushRefs = {
  readonly updates: PushRefUpdate[];
  readonly deletionCount: number;
  readonly ignoredBlankCount: number;
};

/**
 * Parse the `pre-push` stdin payload. Git writes one line per ref:
 * `<local-ref> <local-sha> <remote-ref> <remote-sha>`.
 *
 * - Blank lines are ignored and counted in `ignoredBlankCount`.
 * - Deletion lines (`local-sha` is all-zeros) are dropped and counted in
 *   `deletionCount` — there is no local tree being pushed for that ref.
 * - Every other line must have exactly four whitespace-separated fields with
 *   sha-shaped local/remote ids; a non-blank malformed line **throws** so the
 *   caller can fail safe to the full suite rather than mis-scope.
 */
export function parsePushRefs(stdin: string): ParsedPushRefs {
  const updates: PushRefUpdate[] = [];
  let deletionCount = 0;
  let ignoredBlankCount = 0;

  for (const rawLine of stdin.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0) {
      ignoredBlankCount++;
      continue;
    }
    const fields = line.split(/\s+/);
    if (fields.length !== 4) {
      throw new Error(`Malformed pre-push ref line (expected 4 fields): ${line}`);
    }
    const localSha = fields[1] ?? '';
    const remoteSha = fields[3] ?? '';
    if (localSha === ZERO_SHA) {
      deletionCount++;
      continue;
    }
    if (!SHA_PATTERN.test(localSha) || !(remoteSha === ZERO_SHA || SHA_PATTERN.test(remoteSha))) {
      throw new Error(`Malformed pre-push ref line (bad sha): ${line}`);
    }
    updates.push({ localSha, remoteSha });
  }

  return { updates, deletionCount, ignoredBlankCount };
}

/**
 * Return a warning message when `elapsedMilliseconds` exceeds `budgetMilliseconds`,
 * or `null` when the hook stayed within budget. Pure so both hooks' `process.on('exit', …)`
 * reporters and this module's own test suite can exercise the comparison without
 * timing anything for real — a hook duration budget must warn, never gate, and
 * never depend on wall-clock flakiness in its own tests.
 *
 * `label` names the hook in the message (e.g. `"pre-commit"`) so a developer
 * seeing the warning knows which baseline entry to raise.
 */
export function hookDurationWarning(
  elapsedMilliseconds: number,
  budgetMilliseconds: number,
  label: string,
): string | null {
  if (elapsedMilliseconds <= budgetMilliseconds) return null;
  return (
    `${label} took ${elapsedMilliseconds}ms, over the ${budgetMilliseconds}ms budget in ` +
    `hook-duration-baseline.json. Fix the slowdown, or if the extra time is expected, raise the ` +
    `budget in the same PR.`
  );
}

export type HookDurationBaseline = {
  readonly preCommitWarnMilliseconds: number;
  readonly prePushWarnMilliseconds: number;
};

function isHookDurationBaseline(value: unknown): value is HookDurationBaseline {
  if (!isObjectRecord(value)) return false;
  return (
    typeof value['preCommitWarnMilliseconds'] === 'number' &&
    typeof value['prePushWarnMilliseconds'] === 'number'
  );
}

/**
 * Read and validate `hook-duration-baseline.json`. Returns `undefined` (rather
 * than throwing) on a missing or malformed baseline so a warn-only budget can
 * never become a hard failure — the caller simply skips the duration check for
 * that run.
 */
export async function readHookDurationBaseline(
  path: string = join(REPO_ROOT, 'packages/components/scripts/husky/hook-duration-baseline.json'),
): Promise<HookDurationBaseline | undefined> {
  try {
    const raw: unknown = await Bun.file(path).json();
    return isHookDurationBaseline(raw) ? raw : undefined;
  } catch {
    return undefined;
  }
}
