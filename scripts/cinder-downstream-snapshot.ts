import { lstat, mkdtemp, readFile, readlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';

type RepositoryRequest = {
  name: string;
  path?: string;
  remote?: string;
  ref?: string;
  commit?: string;
  branch?: string;
  globs?: string[];
  evidence?: Record<string, string[]>;
};

type Request = {
  schemaVersion: 1;
  packages?: Array<{ name: string; version?: string; resolution?: 'latest' | 'published' }>;
  repositories?: RepositoryRequest[];
  issueWindow?: { open?: number; recentlyClosed?: number; since?: string };
};

type PackageMetadata = {
  version?: string;
  dist?: { integrity?: string; tarball?: string };
  exports?: unknown;
};

type PackagePackument = {
  versions?: Record<string, PackageMetadata>;
  time?: Record<string, string>;
};

type RepositoryFile = {
  path: string;
  gitlink?: string;
  symlink?: string;
  sha256?: string;
  bytes?: number;
};

type EvidenceMatch = { path: string; line: number; text: string };

type PackageSnapshot = {
  name: string;
  version: string | undefined;
  tarballIntegrity: string | null;
  tarball: string | null;
  exports: unknown;
};

type RepositorySnapshot = {
  name: string;
  remote: string | null;
  ref: string | null;
  branch: string | null;
  commit: string | null;
  files: RepositoryFile[];
  evidence: Record<string, EvidenceMatch[]>;
};

type CollectionError = { scope: string; message: string };

const usage = 'Usage: bun run scripts/cinder-downstream-snapshot.ts --request FILE [--output FILE]';
const NPM_METADATA_TIMEOUT_MS = 10_000;
const CLONE_TIMEOUT_MS = 120_000;
/**
 * Prefix for every temporary clone directory. Exported so leak-detection tests
 * cannot drift from the name the tool actually uses.
 */
export const CLONE_DIRECTORY_PREFIX = 'cinder-downstream-clone-';
const SENSITIVE_EVIDENCE_ASSIGNMENT =
  /^(.*?(?:["']?[\w.-]*(?:authorization|credential|password|secret|token|api[_-]?key)[\w.-]*["']?)\s*[:=]\s*).*$/iu;

function redactEvidenceLine(line: string): string {
  return line.replace(SENSITIVE_EVIDENCE_ASSIGNMENT, '$1[REDACTED]');
}

export function selectMostRecentlyPublishedVersion(packument: PackagePackument): string {
  const versions = packument.versions ?? {};
  const candidates = Object.entries(packument.time ?? {})
    .filter(
      ([version, publishedAt]) => version in versions && Number.isFinite(Date.parse(publishedAt)),
    )
    .map(([version, publishedAt]) => ({ version, publishedAt: Date.parse(publishedAt) }))
    .toSorted((a, b) => b.publishedAt - a.publishedAt || a.version.localeCompare(b.version));
  const selected = candidates[0]?.version;
  if (!selected) throw new Error('npm registry returned no published versions');
  return selected;
}

/**
 * Reports whether an HTTP(S) remote embeds userinfo credentials. Such a remote would
 * be echoed verbatim into `repositories[].remote` and into any clone-failure message,
 * writing a token into a snapshot that audits are expected to keep and share. SSH
 * remotes such as `git@github.com:owner/repository.git` carry a user name rather than
 * a secret and are left alone.
 */
function embedsCredentials(remote: string): boolean {
  try {
    const url = new URL(remote);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

    return url.username !== '' || url.password !== '';
  } catch {
    return false;
  }
}

/**
 * Explains why a repository request's source fields are unusable, or returns `null`
 * when the entry names exactly one source: a local checkout (`path`, optionally
 * pinned with `branch`/`commit`) or a remote ref (`remote` together with `ref`).
 *
 * A remote request is rejected rather than silently narrowed when it also carries
 * `branch` or `commit` — those only constrain a local checkout, so accepting them
 * would let a misconfigured audit believe it pinned a revision it did not.
 */
export function describeInvalidRepositorySource(repository: RepositoryRequest): string | null {
  const hasPath = Boolean(repository.path);
  const hasRemote = Boolean(repository.remote);
  const hasRef = Boolean(repository.ref);

  if (hasPath && hasRemote) return 'declares both path and remote; declare exactly one';
  if (hasRemote && !hasRef) return 'declares remote without ref';
  if (hasRef && !hasRemote) return 'declares ref without remote';
  if (!hasPath && !hasRemote) return 'declares neither path nor remote; declare exactly one';

  if (hasRemote) {
    if (repository.branch) return 'declares remote with branch; a remote source is pinned by ref';
    if (repository.commit) return 'declares remote with commit; a remote source is pinned by ref';
    if (embedsCredentials(repository.remote ?? '')) {
      return 'declares a remote with embedded credentials; use a credential helper instead';
    }
  }

  return null;
}

async function findNestedRepositoryRoot(root: string, path: string): Promise<string | null> {
  const segments = path.split('/');
  for (let length = 1; length < segments.length; length += 1) {
    const candidate = segments.slice(0, length).join('/');
    try {
      await lstat(resolve(root, candidate, '.git'));
      return candidate;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') continue;
      throw error;
    }
  }
  return null;
}

function matchesRequestedGlobs(path: string, globs: string[] | undefined): boolean {
  return !globs?.length || globs.some((glob) => new Bun.Glob(glob).match(path));
}

/** Resolves the exact commit SHA that a checkout's `HEAD` points at. */
function resolveHeadCommit(root: string): string {
  const revision = Bun.spawnSync(['git', '-C', root, 'rev-parse', '--verify', 'HEAD^{commit}']);
  const commit = revision.exitCode === 0 ? revision.stdout.toString().trim() : null;
  if (!commit) throw new Error('checkout HEAD is unavailable');
  return commit;
}

/**
 * Confirms a local checkout already sits on the requested branch and commit, then
 * returns the resolved commit. A request naming neither resolves to `null`, so a
 * plain path scan stays a pure read of whatever is currently on disk.
 */
function resolveLocalCommit(root: string, repository: RepositoryRequest): string | null {
  if (!repository.commit && !repository.branch) return null;

  const headCommit = resolveHeadCommit(root);
  if (repository.branch) {
    const currentBranch = Bun.spawnSync([
      'git',
      '-C',
      root,
      'symbolic-ref',
      '--quiet',
      '--short',
      'HEAD',
    ]);
    const branchName = currentBranch.exitCode === 0 ? currentBranch.stdout.toString().trim() : null;
    const branchRevision = Bun.spawnSync([
      'git',
      '-C',
      root,
      'rev-parse',
      '--verify',
      `refs/heads/${repository.branch}^{commit}`,
    ]);
    const branchCommit =
      branchRevision.exitCode === 0 ? branchRevision.stdout.toString().trim() : null;
    if (branchName !== repository.branch || branchCommit !== headCommit) {
      throw new Error(
        `requested branch ${repository.branch} does not match checkout HEAD (${branchName ?? 'detached'} at ${headCommit})`,
      );
    }
  }

  if (repository.commit) {
    const commitRevision = Bun.spawnSync([
      'git',
      '-C',
      root,
      'rev-parse',
      '--verify',
      `${repository.commit}^{commit}`,
    ]);
    const requestedCommit =
      commitRevision.exitCode === 0 ? commitRevision.stdout.toString().trim() : null;
    if (!requestedCommit || requestedCommit !== headCommit) {
      throw new Error(
        `requested commit ${repository.commit} does not match checkout HEAD (${headCommit})`,
      );
    }
  }

  return headCommit;
}

/**
 * Clones only `ref` from `remote` into `checkout`, shallow and single-branch so a
 * scheduled audit transfers one commit instead of a repository's whole history. The
 * clone always targets a fresh directory, so no existing source repository is written
 * to and no locally checked-out branch can influence the result.
 */
function cloneRemoteRef(remote: string, ref: string, checkout: string): void {
  const clone = Bun.spawnSync(
    ['git', 'clone', '--depth', '1', '--single-branch', '--branch', ref, '--', remote, checkout],
    { stdout: 'pipe', stderr: 'pipe', timeout: CLONE_TIMEOUT_MS },
  );

  if (clone.exitCode === 0) return;

  const detail = clone.stderr.toString().trim() || `git clone exited ${clone.exitCode}`;
  throw new Error(`cloning ${ref} from ${remote} failed: ${detail}`);
}

/**
 * Removes a temporary checkout, returning a collection error instead of throwing.
 * This runs from a `finally` block, where a thrown error would escape the
 * per-repository `catch` that already handled the real failure and abort the whole
 * run without emitting a snapshot. A checkout the tool could not clean up is worth
 * reporting, but it is not worth losing every other repository's evidence over.
 */
export async function removeTemporaryCheckout(
  directory: string,
  repositoryName: string,
): Promise<CollectionError | null> {
  try {
    await rm(directory, { recursive: true, force: true });
    return null;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      scope: `repository:${repositoryName}`,
      message: `removing the temporary checkout ${directory} failed: ${detail}`,
    };
  }
}

/**
 * Hashes every file matching the request's globs and records the Cinder-mentioning
 * lines for each evidence category. Git internals, nested checkouts, and paths that
 * escape `root` are excluded; secret-shaped assignments are redacted.
 */
async function collectRepositoryEvidence(
  root: string,
  repository: RepositoryRequest,
  outputPath: string | undefined,
): Promise<{ files: RepositoryFile[]; evidence: Record<string, EvidenceMatch[]> }> {
  const files: RepositoryFile[] = [];
  const evidence: Record<string, EvidenceMatch[]> = Object.fromEntries(
    Object.keys(repository.evidence ?? {}).map((kind) => [kind, []]),
  );
  const patterns = repository.globs?.length ? repository.globs : ['**/*'];
  const paths = new Set<string>();
  for (const pattern of patterns)
    for await (const path of new Bun.Glob(pattern).scan({
      cwd: root,
      onlyFiles: false,
      dot: true,
    }))
      paths.add(path);
  const nestedRepositoryRoots = new Set<string>();
  for (const path of paths) {
    const segments = path.split('/');
    const gitMetadataIndex = segments.indexOf('.git');
    if (gitMetadataIndex > 0) {
      nestedRepositoryRoots.add(segments.slice(0, gitMetadataIndex).join('/'));
    }
    const nestedRoot = await findNestedRepositoryRoot(root, path);
    if (nestedRoot) nestedRepositoryRoots.add(nestedRoot);
  }
  const gitIndex = Bun.spawnSync(['git', '-C', root, 'ls-files', '--stage', '-z']);
  if (gitIndex.exitCode === 0) {
    for (const entry of gitIndex.stdout.toString().split('\0')) {
      const match = /^160000 ([0-9a-f]+) \d+\t(.+)$/u.exec(entry);
      if (!match?.[1] || !match[2]) continue;
      nestedRepositoryRoots.add(match[2]);
      if (matchesRequestedGlobs(match[2], repository.globs)) {
        files.push({ path: match[2], gitlink: match[1] });
      }
    }
  }
  for (const path of [...paths].toSorted()) {
    if (path === '.git' || path.startsWith('.git/')) continue;
    if (
      [...nestedRepositoryRoots].some(
        (nestedRoot) => path === nestedRoot || path.startsWith(`${nestedRoot}/`),
      )
    )
      continue;
    const absolutePath = resolve(root, path);
    const relativePath = relative(root, absolutePath);
    if (relativePath === '..' || relativePath.startsWith('../') || isAbsolute(relativePath)) {
      throw new Error(`matched path escapes repository root: ${path}`);
    }
    const information = await lstat(absolutePath);
    if (!information.isFile() && !information.isSymbolicLink()) continue;
    if (outputPath && resolve(outputPath) === absolutePath) continue;
    if (information.isSymbolicLink()) {
      const target = await readlink(absolutePath);
      files.push({ path, symlink: target });
      continue;
    }
    if (!matchesRequestedGlobs(path, repository.globs)) continue;
    const bytes = await readFile(absolutePath);
    files.push({
      path,
      sha256: new Bun.CryptoHasher('sha256').update(bytes).digest('hex'),
      bytes: bytes.byteLength,
    });
    const matchingEvidence = Object.entries(repository.evidence ?? {}).filter(([, globs]) =>
      globs.some((glob) => new Bun.Glob(glob).match(path)),
    );
    if (matchingEvidence.length === 0) continue;
    const text = new TextDecoder().decode(bytes);
    for (const [kind] of matchingEvidence) {
      text.split('\n').forEach((line, index) => {
        if (line.toLowerCase().includes('cinder')) {
          evidence[kind]?.push({ path, line: index + 1, text: redactEvidenceLine(line.trim()) });
        }
      });
    }
  }

  return { files: files.toSorted((a, b) => a.path.localeCompare(b.path)), evidence };
}

function parseArgs(args: string[]): { request?: string; output?: string; help?: boolean } {
  const result: { request?: string; output?: string; help?: boolean } = {};
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--request' || args[index] === '--output') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`${args[index - 1]} requires a value`);
      if (args[index - 1] === '--request') result.request = value;
      else result.output = value;
    } else if (args[index] === '--help') result.help = true;
    else throw new Error(`Unknown option: ${args[index]}`);
  }
  return result;
}

/** Resolves each requested npm package's published version, tarball, and exports. */
async function collectPackages(
  request: Request,
  errors: CollectionError[],
): Promise<PackageSnapshot[]> {
  const packages: PackageSnapshot[] = [];
  for (const packageRequest of (request.packages ?? []).toSorted((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    try {
      const packagePath = `https://registry.npmjs.org/${encodeURIComponent(packageRequest.name)}`;
      const requestedVersion =
        packageRequest.version ?? (packageRequest.resolution === 'latest' ? 'latest' : undefined);
      if (!requestedVersion && packageRequest.resolution !== 'published') {
        throw new Error('version or resolution is required');
      }
      const response = await fetch(
        requestedVersion ? `${packagePath}/${encodeURIComponent(requestedVersion)}` : packagePath,
        { signal: AbortSignal.timeout(NPM_METADATA_TIMEOUT_MS) },
      );
      if (!response.ok) throw new Error(`npm registry returned ${response.status}`);
      const registryPayload = (await response.json()) as PackageMetadata | PackagePackument;
      const resolvedVersion = requestedVersion
        ? undefined
        : selectMostRecentlyPublishedVersion(registryPayload as PackagePackument);
      const metadata = requestedVersion
        ? (registryPayload as PackageMetadata)
        : ((registryPayload as PackagePackument).versions?.[resolvedVersion ?? ''] ??
          (() => {
            throw new Error(`npm registry omitted metadata for ${resolvedVersion}`);
          })());
      packages.push({
        name: packageRequest.name,
        version: metadata.version ?? resolvedVersion ?? requestedVersion,
        tarballIntegrity: metadata.dist?.integrity ?? null,
        tarball: metadata.dist?.tarball ?? null,
        exports: metadata.exports ?? null,
      });
    } catch (error) {
      errors.push({
        scope: `package:${packageRequest.name}`,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return packages;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage);
    return;
  }
  if (!args.request) throw new Error(usage);
  const request = JSON.parse(await readFile(resolve(args.request), 'utf8')) as Request;
  if (request.schemaVersion !== 1) throw new Error('request.schemaVersion must be 1');
  const repositoryRequests = (request.repositories ?? []).toSorted((a, b) =>
    a.name.localeCompare(b.name),
  );
  const invalidSources = repositoryRequests
    .map((repository) => ({
      name: repository.name,
      reason: describeInvalidRepositorySource(repository),
    }))
    .filter((entry): entry is { name: string; reason: string } => entry.reason !== null);
  if (invalidSources.length > 0) {
    throw new Error(
      `invalid repository sources: ${invalidSources
        .map(({ name, reason }) => `${name} ${reason}`)
        .join('; ')}`,
    );
  }

  const errors: CollectionError[] = [];
  const packages = await collectPackages(request, errors);
  const repositories: RepositorySnapshot[] = [];
  for (const repository of repositoryRequests) {
    let cloneDirectory: string | null = null;
    try {
      let root: string;
      let resolvedCommit: string | null;

      if (repository.remote && repository.ref) {
        cloneDirectory = await mkdtemp(join(tmpdir(), CLONE_DIRECTORY_PREFIX));
        root = join(cloneDirectory, 'checkout');
        cloneRemoteRef(repository.remote, repository.ref, root);
        resolvedCommit = resolveHeadCommit(root);
      } else {
        root = resolve(repository.path ?? '.');
        resolvedCommit = resolveLocalCommit(root, repository);
      }

      const { files, evidence } = await collectRepositoryEvidence(root, repository, args.output);
      repositories.push({
        name: repository.name,
        remote: repository.remote ?? null,
        ref: repository.ref ?? null,
        branch: repository.branch ?? null,
        commit: resolvedCommit,
        files,
        evidence,
      });
    } catch (error) {
      errors.push({
        scope: `repository:${repository.name}`,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (cloneDirectory) {
        const cleanupError = await removeTemporaryCheckout(cloneDirectory, repository.name);
        if (cleanupError) errors.push(cleanupError);
      }
    }
  }
  const output = {
    schemaVersion: 1,
    collectedAt: new Date().toISOString(),
    packages,
    repositories,
    issueWindow: request.issueWindow ?? null,
    errors: errors.toSorted((a, b) => a.scope.localeCompare(b.scope)),
  };
  const text = JSON.stringify(output);
  if (args.output) await Bun.write(resolve(args.output), `${text}\n`);
  else console.log(text);
}

if (import.meta.main) await main();
