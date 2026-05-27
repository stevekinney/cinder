import { $ } from 'bun';
import chalk from 'chalk';
import { capitalCase } from 'change-case';
import { readFileSync, rmSync } from 'node:fs';
import { mkdir, open, readdir, readFile, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Absolute path to the repository root, resolved from this file's location.
 * `utilities.ts` lives at `packages/components/scripts/husky/utilities.ts`,
 * so four levels up lands at the workspace root.
 */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

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
    const errorCode = (caught as NodeJS.ErrnoException).code;
    if (errorCode === 'ESRCH') return false;
    return true;
  }
}

function parseGateLock(raw: string): GateLockFile | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const record = value as Record<string, unknown>;
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
  const isProcessAlive = options.isProcessAlive ?? defaultIsProcessAlive;
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
      const errorCode = (caught as NodeJS.ErrnoException).code;
      if (errorCode !== 'EEXIST') throw caught;

      const existingLock = await readGateLock(lockPath);
      if (existingLock === null) {
        await options.beforeMalformedLockStat?.();
        let existingLockAgeMilliseconds = 0;
        try {
          existingLockAgeMilliseconds = await lockAgeMilliseconds(lockPath);
        } catch (caught) {
          if ((caught as NodeJS.ErrnoException).code === 'ENOENT') continue;
          throw caught;
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

      if (!isProcessAlive(existingLock.pid)) {
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
 */
export type WorkspacePackage = {
  readonly name: string;
  readonly dir: string;
  readonly hasTypecheck: boolean;
  readonly hasTest: boolean;
};

type PackageManifest = {
  name?: unknown;
  scripts?: Record<string, unknown>;
};

function isManifest(value: unknown): value is PackageManifest {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  const scripts = record['scripts'];
  if (scripts !== undefined && (typeof scripts !== 'object' || scripts === null)) return false;
  return true;
}

/**
 * Read every `packages/*\/package.json` once and return the derived workspace
 * package list. Packages without a `name` field are skipped. `hasTypecheck`
 * and `hasTest` reflect whether the corresponding npm scripts exist, so the
 * pre-commit hook can skip-with-reason instead of failing on missing scripts.
 */
export async function loadWorkspacePackages(): Promise<readonly WorkspacePackage[]> {
  const packagesDir = join(REPO_ROOT, 'packages');
  const entries = await readdir(packagesDir, { withFileTypes: true });
  const result: WorkspacePackage[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(packagesDir, entry.name, 'package.json');
    const manifestFile = Bun.file(manifestPath);
    if (!(await manifestFile.exists())) continue;
    const raw: unknown = await manifestFile.json();
    if (!isManifest(raw)) continue;
    if (typeof raw.name !== 'string' || raw.name.length === 0) continue;
    const scripts = raw.scripts ?? {};
    result.push({
      name: raw.name,
      dir: `packages/${entry.name}/`,
      hasTypecheck: typeof scripts['typecheck'] === 'string',
      hasTest: typeof scripts['test'] === 'string',
    });
  }
  return result;
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
 * Return `true` if any staged file is a high-impact root config file that
 * warrants a full workspace validation instead of scoped per-package checks.
 */
export function rootConfigStaged(stagedFiles: readonly string[]): boolean {
  return stagedFiles.some((f) => HIGH_IMPACT_ROOT.includes(f));
}
