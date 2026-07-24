import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

type Request = {
  schemaVersion: 1;
  packages?: Array<{ name: string; version?: string; resolution?: 'latest' | 'published' }>;
  repositories?: Array<{ name: string; path: string; commit?: string; branch?: string; globs?: string[]; evidence?: Record<string, string[]> }>;
  issueWindow?: { open?: number; recentlyClosed?: number; since?: string };
};

const usage = 'Usage: bun run scripts/cinder-downstream-snapshot.ts --request FILE [--output FILE]';

function parseArgs(args: string[]): { request?: string; output?: string; help?: boolean } {
  const result: { request?: string; output?: string; help?: boolean } = {};
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--request') result.request = args[++index];
    else if (args[index] === '--output') result.output = args[++index];
    else if (args[index] === '--help') result.help = true;
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
  for (const packageRequest of [...(request.packages ?? [])].sort((a, b) => a.name.localeCompare(b.name))) {
    try {
      const version = packageRequest.version ?? (packageRequest.resolution ? 'latest' : undefined);
      if (!version) throw new Error('version or resolution is required');
      const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageRequest.name)}/${encodeURIComponent(version)}`);
      if (!response.ok) throw new Error(`npm registry returned ${response.status}`);
      const metadata = await response.json() as { version?: string; dist?: { integrity?: string; tarball?: string }; exports?: unknown };
      packages.push({ name: packageRequest.name, version: metadata.version ?? version, tarballIntegrity: metadata.dist?.integrity ?? null, tarball: metadata.dist?.tarball ?? null, exports: metadata.exports ?? null });
    } catch (error) {
      errors.push({ scope: `package:${packageRequest.name}`, message: error instanceof Error ? error.message : String(error) });
    }
  }
  const repositories = [];
  for (const repository of [...(request.repositories ?? [])].sort((a, b) => a.name.localeCompare(b.name))) {
    try {
      const root = resolve(repository.path);
      const files = [];
      const evidence: Record<string, Array<{ path: string; line: number; text: string }>> = {};
      for await (const path of new Bun.Glob('**/*').scan({ cwd: root, onlyFiles: true })) {
        if (repository.globs?.length && !repository.globs.some((glob) => new Bun.Glob(glob).match(path))) continue;
        const text = await Bun.file(`${root}/${path}`).text();
        files.push({ path, sha256: new Bun.CryptoHasher('sha256').update(text).digest('hex'), bytes: text.length });
        for (const [kind, globs] of Object.entries(repository.evidence ?? {})) {
          if (!globs.some((glob) => new Bun.Glob(glob).match(path))) continue;
          evidence[kind] ??= [];
          text.split('\n').forEach((line, index) => { if (line.includes('cinder') || line.includes('Cinder')) evidence[kind].push({ path, line: index + 1, text: line.trim() }); });
        }
      }
      repositories.push({ name: repository.name, branch: repository.branch ?? null, commit: repository.commit ?? null, files: files.sort((a, b) => a.path.localeCompare(b.path)), evidence });
    } catch (error) {
      errors.push({ scope: `repository:${repository.name}`, message: error instanceof Error ? error.message : String(error) });
    }
  }
  const output = { schemaVersion: 1, collectedAt: new Date().toISOString(), packages, repositories, issueWindow: request.issueWindow ?? null, errors: errors.sort((a, b) => a.scope.localeCompare(b.scope)) };
  const text = JSON.stringify(output);
  if (args.output) await Bun.write(resolve(args.output), `${text}\n`);
  else console.log(text);
}

if (import.meta.main) await main();
