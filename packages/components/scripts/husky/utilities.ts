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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isManifest(value: unknown): value is PackageManifest {
  if (!isRecord(value)) return false;
  for (const key of ['scripts', 'dependencies', 'devDependencies', 'peerDependencies'] as const) {
    const field = value[key];
    if (field !== undefined && !isRecord(field)) return false;
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
    if (!isRecord(field)) continue;
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
