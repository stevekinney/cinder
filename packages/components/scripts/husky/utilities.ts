import { $ } from 'bun';
import chalk from 'chalk';
import { capitalCase } from 'change-case';
import { readFileSync, rmSync } from 'node:fs';
import { mkdir, open, readdir, readFile, rm, stat } from 'node:fs/promises';
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
 * assert the test phase runs at concurrency 1 without triggering the gate
 * entry path's process.exit / stdin-read / lock side effects.
 *
 * Why `test` must be 1: each package's `test` script runs inline
 * `bun run --filter=<dep> build` steps that wipe and re-emit the shared
 * upstream `dist/` directories (e.g. `@cinder/markdown`, `@cinder/diff`).
 * Running two test jobs in parallel races those `rm -rf dist` + write cycles
 * against each other (and against a third job's bundler that reads the same
 * dist mid-write), yielding non-deterministic
 * `error: "<name>" is not declared in this file`. Lint (oxlint) and typecheck
 * (`tsc --noEmit`) are read-only, so they stay parallel.
 *
 * The atomic-build follow-up (building to a temp dir then renaming over
 * `dist/`) removes the write window, which makes this serialization redundant.
 * Both defences are kept: atomic builds are the root fix; serialization is the
 * belt. Removing serialization after atomic builds land requires its own PR
 * with a verified concurrency stress test.
 */
export function phaseMaxConcurrency(script: GateScript): number {
  if (script === 'test') return 1;
  // CPU-bound default (up to 4 workers). The `?? 1` guards environments where
  // `navigator.hardwareConcurrency` is undefined; `Math.max(1, …)` ensures the
  // floor stays at 1 so a zero / negative value never silently skips all jobs.
  return Math.max(1, Math.min(navigator.hardwareConcurrency ?? 1, 4));
}

export type GateFailure = {
  readonly script: GateScript;
  readonly scope: string;
  readonly lines: readonly string[];
};

const FAILURE_MARKERS: readonly RegExp[] = [
  /^x\s+\S/,
  /^\(fail\)\s+/,
  /\berror TS\d+:/,
  /^\S.*:\d+:\d+\s+error\s+/,
  /^\d+:\d+\s+.+\s{2,}[a-z-]+$/,
  /^\d+:\d+\s+[^\w\s]\s+/,
];

const FILE_PATH_LINE = /^(?:\.?\/)?[\w@./-]+\.[\w-]+$/;
const LINE_COLUMN_DIAGNOSTIC = /^\d+:\d+\s+/;
const LOCATION_DIAGNOSTIC = /:\d+:\d+$/;
const CONTEXTUAL_LINE_COLUMN_DIAGNOSTIC = /:\d+:\d+\s+/;
const TRUNCATED_FAILURES_LINE = /^\.\.\.and (?<count>\d+) more failure lines$/;

function parseWorkspaceOutputLine(line: string): {
  readonly scope: string | null;
  readonly message: string;
} {
  const match = /^(?<scope>(?:@[\w-]+\/)?[\w-]+)\s+(?:lint|typecheck|test):\s*(?<message>.*)$/.exec(
    line,
  );
  return {
    scope: match?.groups?.['scope'] ?? null,
    message: match?.groups?.['message'] ?? line,
  };
}

function normalizeOutputLines(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function summarizeFailures(output: string, maxLines = 5): string[] {
  const lines = normalizeOutputLines(output).map((line) => parseWorkspaceOutputLine(line).message);
  let currentPath: string | null = null;
  const contextualLines = lines.map((line) => {
    if (FILE_PATH_LINE.test(line)) {
      currentPath = line;
      return line;
    }

    const oxlintLocation = /^,-\[(?<location>[^\]]+)\]$/.exec(line);
    if (oxlintLocation?.groups?.['location']) {
      return oxlintLocation.groups['location'];
    }

    if (currentPath && LINE_COLUMN_DIAGNOSTIC.test(line)) {
      return `${currentPath}:${line}`;
    }

    return line;
  });
  const matched = contextualLines.filter(
    (line) =>
      FAILURE_MARKERS.some((marker) => marker.test(line)) ||
      LOCATION_DIAGNOSTIC.test(line) ||
      CONTEXTUAL_LINE_COLUMN_DIAGNOSTIC.test(line),
  );
  const summary = matched.length > 0 ? matched : lines.slice(-maxLines);
  if (summary.length <= maxLines) return summary;

  return [...summary.slice(0, maxLines), `...and ${summary.length - maxLines} more failure lines`];
}

export function inferFailureScope(output: string): string {
  const scopes = new Set<string>();
  for (const line of normalizeOutputLines(output)) {
    const parsed = parseWorkspaceOutputLine(line);
    if (parsed.scope && FAILURE_MARKERS.some((marker) => marker.test(parsed.message))) {
      scopes.add(parsed.scope);
    }
  }

  if (scopes.size === 1) return [...scopes][0] ?? 'workspace';
  if (scopes.size > 1) return 'multiple packages';
  return 'workspace';
}

export function formatFailureSummary(failures: readonly GateFailure[]): string[] {
  const lines = ['PRE-PUSH FAILED'];
  for (const failure of failures) {
    const omittedCount = failure.lines.reduce((count, line) => {
      const match = TRUNCATED_FAILURES_LINE.exec(line);
      return count + Number(match?.groups?.['count'] ?? 0);
    }, 0);
    const count =
      failure.lines.filter((line) => !TRUNCATED_FAILURES_LINE.test(line)).length + omittedCount;
    const noun = count === 1 ? 'failure' : 'failures';
    lines.push(`  ${failure.script} -> ${failure.scope}: ${count} ${noun}`);
    for (const line of failure.lines) {
      lines.push(`    ${line}`);
    }
  }
  return lines;
}

export async function writePrePushLog(output: string, now = new Date()): Promise<string> {
  const tmpDir = join(REPO_ROOT, 'tmp');
  await mkdir(tmpDir, { recursive: true });
  const timestamp = now.toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const logPath = join(tmpDir, `pre-push-${timestamp}.log`);
  await Bun.write(logPath, output);
  return logPath;
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

const DEFAULT_GATE_LOCK_PATH = join(REPO_ROOT, 'tmp', 'pre-push-gate.lock');
const DEFAULT_MALFORMED_GATE_LOCK_GRACE_MILLISECONDS = 30_000;
const DEFAULT_GATE_LOCK_RETRY_MILLISECONDS = 1_000;
const DEFAULT_GATE_LOCK_WAIT_MILLISECONDS = 5 * 60 * 1_000;

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
 * Run a hook gate under a repository-local lock so duplicate pushes do not
 * stack full workspace validations on top of one another.
 */
export async function withGateLock<T>(
  run: () => Promise<T>,
  options: GateLockOptions = {},
): Promise<T> {
  const lockPath = options.lockPath ?? DEFAULT_GATE_LOCK_PATH;
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
          warning('Removing stale malformed pre-push gate lock.');
          await rm(lockPath, { force: true });
          continue;
        }
        if (!waitingMessagePrinted) {
          warning('Another pre-push gate is preparing its lock file. Waiting for it to finish…');
          waitingMessagePrinted = true;
        }
        if (Date.now() - startedAt >= waitMilliseconds) {
          throw new Error(
            `Another pre-push gate left a malformed lock at ${lockPath}; waited ${waitMilliseconds}ms before giving up.`,
            { cause: caught },
          );
        }
        await Bun.sleep(retryMilliseconds);
        continue;
      }

      if (!processAlive(existingLock.pid)) {
        warning('Removing stale pre-push gate lock.');
        await rm(lockPath, { force: true });
        continue;
      }

      if (!waitingMessagePrinted) {
        warning(
          `Another pre-push gate is already running for ${existingLock.repositoryRoot} (pid ${existingLock.pid}). Waiting for it to finish…`,
        );
        waitingMessagePrinted = true;
      }

      if (Date.now() - startedAt >= waitMilliseconds) {
        throw new Error(
          `Another pre-push gate is already running (pid ${existingLock.pid}); waited ${waitMilliseconds}ms for ${lockPath}.`,
          { cause: caught },
        );
      }

      await Bun.sleep(retryMilliseconds);
    }
  }
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
 * filtered to known workspace names) — the edges used to expand a touched set
 * to its reverse-dependency closure in the pre-push gate.
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

/**
 * Expand a set of touched package names to its **reverse-dependency closure**:
 * the touched packages plus every package that transitively *depends on* one of
 * them. A pre-push gate must validate dependents because a change to a package
 * can break a dependent's typecheck/test without that package's own gates
 * failing. Names not present in `packages` (deleted packages, typos) pass
 * through unchanged. Cycle-safe via the visited set.
 */
export function expandToDependents(
  packages: readonly WorkspacePackage[],
  touchedNames: Iterable<string>,
): Set<string> {
  // dependents[X] = packages that list X in their dependencies.
  const dependents = new Map<string, Set<string>>();
  for (const pkg of packages) {
    for (const dependency of pkg.dependencies) {
      let set = dependents.get(dependency);
      if (set === undefined) {
        set = new Set<string>();
        dependents.set(dependency, set);
      }
      set.add(pkg.name);
    }
  }

  const closure = new Set<string>();
  const queue = [...touchedNames];
  while (queue.length > 0) {
    const name = queue.pop()!;
    if (closure.has(name)) continue;
    closure.add(name);
    for (const dependent of dependents.get(name) ?? []) {
      if (!closure.has(dependent)) queue.push(dependent);
    }
  }
  return closure;
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
 * call with either staged files (pre-commit) or a push range (pre-push).
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

/** Whether a ref update introduces a brand-new branch (no remote tip yet). */
export const isNewBranch = (update: PushRefUpdate): boolean => update.remoteSha === ZERO_SHA;

/**
 * The git operations the range helpers need, injected so the pure range logic
 * can be unit-tested with fakes instead of a real repository.
 */
export type GitRunner = {
  /** `git merge-base <a> <b>`; throws if there is no common ancestor. */
  mergeBase(a: string, b: string): Promise<string>;
  /** `git merge-base --is-ancestor <ancestor> <descendant>`. */
  isAncestor(ancestor: string, descendant: string): Promise<boolean>;
  /** `git diff --name-only <range>`. */
  diffNames(range: string): Promise<string[]>;
  /** `git diff --name-status <range>`. */
  diffNameStatus(range: string): Promise<string[]>;
};

/**
 * The default branch a new-branch push is compared against. Overridable via
 * `CINDER_PUSH_BASE_REF` for repositories that branch from something other than
 * `origin/main` (release branches, a differently named remote, stacked
 * branches). If the configured ref can't be resolved, `rangeForUpdate` throws
 * and the caller fails safe to the full suite — so a wrong value is slow, never
 * unsound.
 */
export const pushBaseRef = (): string => Bun.env['CINDER_PUSH_BASE_REF'] ?? 'origin/main';

/**
 * Resolve the `<base>..<localSha>` range to diff for a single ref update.
 *
 * - New branch: base is `merge-base <pushBaseRef()> <localSha>`.
 * - Fast-forward update: base is the existing `remoteSha` (two-dot diff).
 * - Non-fast-forward (rebase/force-push): base is
 *   `merge-base <remoteSha> <localSha>` so a rewritten branch still diffs from
 *   the point it diverged rather than producing a disconnected two-dot diff.
 *
 * Any `merge-base` failure propagates as a throw so the caller falls back to
 * the full suite.
 */
async function rangeForUpdate(update: PushRefUpdate, git: GitRunner): Promise<string> {
  if (isNewBranch(update)) {
    const base = await git.mergeBase(pushBaseRef(), update.localSha);
    return `${base}..${update.localSha}`;
  }
  if (await git.isAncestor(update.remoteSha, update.localSha)) {
    return `${update.remoteSha}..${update.localSha}`;
  }
  const base = await git.mergeBase(update.remoteSha, update.localSha);
  return `${base}..${update.localSha}`;
}

/**
 * Union the names of every file changed across all pushed ref updates. Throws
 * (via {@link rangeForUpdate}) if a range cannot be derived, so the caller can
 * fail safe to the full suite.
 */
export async function changedFilesForRange(
  updates: readonly PushRefUpdate[],
  git: GitRunner,
): Promise<Set<string>> {
  const changed = new Set<string>();
  for (const update of updates) {
    const range = await rangeForUpdate(update, git);
    for (const file of await git.diffNames(range)) {
      if (file.length > 0) changed.add(file);
    }
  }
  return changed;
}

const CSS_LIKE_PATTERN = /\.(css|svelte)$/i;

/**
 * The changed `.css`/`.svelte` files that still exist on disk, suitable for
 * handing to stylelint. Uses `--name-status` so renames/copies resolve to the
 * **destination** path and deletions are dropped; `fileExists` is injected so
 * the helper stays pure and unit-testable. An unrecognized status throws so the
 * caller fails safe to the full suite.
 */
export async function changedCssLikeFiles(
  updates: readonly PushRefUpdate[],
  git: GitRunner,
  fileExists: (path: string) => boolean | Promise<boolean>,
): Promise<string[]> {
  const candidates = new Set<string>();
  for (const update of updates) {
    const range = await rangeForUpdate(update, git);
    for (const rawLine of await git.diffNameStatus(range)) {
      const line = rawLine.trim();
      if (line.length === 0) continue;
      const fields = line.split(/\t+/);
      const status = fields[0] ?? '';
      const code = status[0];
      if (code === 'D') continue; // deleted — nothing to lint
      let path: string | undefined;
      if (code === 'A' || code === 'M' || code === 'T') {
        path = fields[1]; // single path
      } else if (code === 'R' || code === 'C') {
        path = fields[2]; // rename/copy → destination
      } else {
        // Anything else (including unmerged `U`) is unexpected here — throw so
        // the caller fails safe to the full suite rather than silently mis-scope.
        throw new Error(`Unrecognized diff status '${status}' in: ${line}`);
      }
      if (path === undefined || path.length === 0) {
        // A known status with a missing path means the diff output is malformed
        // (e.g. an `R`/`C` line whose destination field never arrived, so
        // `fields[2]` is undefined). Dropping it would silently lose stylelint
        // coverage, so fail safe by throwing.
        throw new Error(`Diff status '${status}' missing its path in: ${line}`);
      }
      if (CSS_LIKE_PATTERN.test(path)) candidates.add(path);
    }
  }

  const existing: string[] = [];
  for (const path of candidates) {
    if (await fileExists(path)) existing.push(path);
  }
  return existing.toSorted();
}

/**
 * Whether a path lives inside one of the loaded workspace packages. Matches
 * against the normalized package directory (no trailing slash) so a file
 * exactly at the package root or anywhere beneath it counts.
 */
export function isUnderWorkspace(path: string, packages: readonly WorkspacePackage[]): boolean {
  return packages.some((pkg) => {
    const dir = pkg.dir.replace(/\/$/, '');
    return path === dir || path.startsWith(`${dir}/`);
  });
}

const DOC_BASENAME_PATTERN = /^(README|CHANGELOG)/i;

/**
 * Whether a path is *clearly documentation* and safe to ignore when deciding
 * whether a push with no touched packages can skip the gates. Path-anchored,
 * not basename-only, so a nested fixture such as
 * `packages/markdown/test/fixtures/README-edge-case.md` is **not** treated as
 * documentation and will instead escalate to the full suite.
 *
 * Ignorable:
 * - a repo-root `README*` / `CHANGELOG*`,
 * - a `README*` / `CHANGELOG*` directly under a package root,
 * - anything under a package's `docs/` directory.
 */
export function isIgnorableDoc(path: string, packages: readonly WorkspacePackage[]): boolean {
  if (!path.includes('/')) {
    return DOC_BASENAME_PATTERN.test(path); // repo-root doc
  }
  for (const pkg of packages) {
    const dir = pkg.dir.replace(/\/$/, '');
    if (path.startsWith(`${dir}/docs/`)) return true;
    const rest = path.startsWith(`${dir}/`) ? path.slice(dir.length + 1) : undefined;
    if (rest !== undefined && !rest.includes('/') && DOC_BASENAME_PATTERN.test(rest)) {
      return true; // README*/CHANGELOG* directly under the package root
    }
  }
  return false;
}
