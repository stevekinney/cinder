import { lstat, readFile, readlink } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

type Request = {
  schemaVersion: 1;
  packages?: Array<{ name: string; version?: string; resolution?: 'latest' | 'published' }>;
  repositories?: Array<{
    name: string;
    path: string;
    commit?: string;
    branch?: string;
    globs?: string[];
    evidence?: Record<string, string[]>;
  }>;
  issueWindow?: { open?: number; recentlyClosed?: number; since?: string };
};

const usage = 'Usage: bun run scripts/cinder-downstream-snapshot.ts --request FILE [--output FILE]';

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
      const version = packageRequest.version ?? (packageRequest.resolution ? 'latest' : undefined);
      if (!version) throw new Error('version or resolution is required');
      const response = await fetch(
        `https://registry.npmjs.org/${encodeURIComponent(packageRequest.name)}/${encodeURIComponent(version)}`,
      );
      if (!response.ok) throw new Error(`npm registry returned ${response.status}`);
      const metadata = (await response.json()) as {
        version?: string;
        dist?: { integrity?: string; tarball?: string };
        exports?: unknown;
      };
      packages.push({
        name: packageRequest.name,
        version: metadata.version ?? version,
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
    try {
      const root = resolve(repository.path);
      const files = [];
      const evidence: Record<string, Array<{ path: string; line: number; text: string }>> = {};
      const patterns = repository.globs?.length ? repository.globs : ['**/*'];
      const paths = new Set<string>();
      for (const pattern of patterns)
        for await (const path of new Bun.Glob(pattern).scan({
          cwd: root,
          onlyFiles: false,
          dot: true,
        }))
          paths.add(path);
      for (const path of [...paths].toSorted()) {
        if (path === '.git' || path.startsWith('.git/')) continue;
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
        if (
          repository.globs?.length &&
          !repository.globs.some((glob) => new Bun.Glob(glob).match(path))
        )
          continue;
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
          evidence[kind] ??= [];
          text.split('\n').forEach((line, index) => {
            if (line.toLowerCase().includes('cinder')) {
              evidence[kind].push({ path, line: index + 1, text: line.trim() });
            }
          });
        }
      }
      let resolvedCommit = repository.commit ?? null;
      if (repository.commit || repository.branch) {
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
