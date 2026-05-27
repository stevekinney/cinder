import { $ } from 'bun';
import chalk from 'chalk';
import { capitalCase } from 'change-case';
import { readdir } from 'node:fs/promises';
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
  let notifyAbort: () => void = () => {};
  const abortObserved = new Promise<void>((resolve) => {
    notifyAbort = resolve;
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

    const [exitCode, capturedStdout, capturedStderr] = await Promise.all([
      exitCodePromise,
      stdoutText,
      stderrText,
    ]);

    return {
      exitCode: aborted ? 130 : exitCode,
      stderr: capturedStderr,
      stdout: capturedStdout,
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
