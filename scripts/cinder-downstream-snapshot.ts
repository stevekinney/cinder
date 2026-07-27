import { lstat, mkdtemp, readFile, readlink, rm } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

type Request = {
  schemaVersion: 1;
  packages?: Array<{ name: string; version?: string; resolution?: 'latest' | 'published' }>;
  repositories?: Array<{
    name: string;
    path?: string;
    remote?: string;
    ref?: string;
    commit?: string;
    branch?: string;
    globs?: string[];
    evidence?: Record<string, string[]>;
  }>;
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

const usage = 'Usage: bun run scripts/cinder-downstream-snapshot.ts --request FILE [--output FILE]';
const NPM_METADATA_TIMEOUT_MS = 10_000;
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

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage);
    return;
  }
  if (!args.request) throw new Error(usage);
  const request = JSON.parse(await readFile(resolve(args.request), 'utf8')) as Request;
  if (request.schemaVersion !== 1) throw new Error('request.schemaVersion must be 1');
  const packages = [];
  const errors: Array<{ scope: string; message: string }> = [];
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
  const repositories = [];
  for (const repository of (request.repositories ?? []).toSorted((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    let temporaryRoot: string | null = null;
    try {
      const hasPath = repository.path !== undefined;
      const hasRemote = repository.remote !== undefined;
      if (
        hasPath === hasRemote ||
        (hasRemote && repository.ref === undefined) ||
        (!hasRemote && repository.ref !== undefined)
      ) {
        throw new Error('repository source must be exactly path(+optional branch) XOR remote+ref');
      }
      let root: string;
      if (hasRemote) {
        temporaryRoot = await mkdtemp('/tmp/cinder-downstream-');
        const clone = Bun.spawnSync([
          'git',
          'clone',
          '--depth',
          '1',
          '--single-branch',
          '--branch',
          repository.ref!,
          repository.remote!,
          temporaryRoot,
        ]);
        if (clone.exitCode !== 0)
          throw new Error(`clone failed: ${clone.stderr.toString().trim()}`);
        root = temporaryRoot;
      } else {
        root = resolve(repository.path!);
      }
      const files = [];
      const evidence: Record<
        string,
        Array<{ path: string; line: number; text: string }>
      > = Object.fromEntries(Object.keys(repository.evidence ?? {}).map((kind) => [kind, []]));
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
        if (args.output && resolve(args.output) === absolutePath) continue;
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
              evidence[kind]?.push({
                path,
                line: index + 1,
                text: redactEvidenceLine(line.trim()),
              });
            }
          });
        }
      }
      let resolvedCommit = repository.commit ?? null;
      if (repository.commit || repository.branch || repository.remote) {
        const headRevision = Bun.spawnSync([
          'git',
          '-C',
          root,
          'rev-parse',
          '--verify',
          'HEAD^{commit}',
        ]);
        const headCommit =
          headRevision.exitCode === 0 ? headRevision.stdout.toString().trim() : null;
        if (!headCommit) throw new Error('checkout HEAD is unavailable');
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
          const branchName =
            currentBranch.exitCode === 0 ? currentBranch.stdout.toString().trim() : null;
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
        resolvedCommit = headCommit;
      }
      repositories.push({
        name: repository.name,
        ...(repository.remote === undefined
          ? {}
          : { remote: repository.remote, ref: repository.ref! }),
        branch: repository.branch ?? null,
        commit: resolvedCommit,
        files: files.toSorted((a, b) => a.path.localeCompare(b.path)),
        evidence,
      });
    } catch (error) {
      errors.push({
        scope: `repository:${repository.name}`,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (temporaryRoot !== null) await rm(temporaryRoot, { recursive: true, force: true });
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
