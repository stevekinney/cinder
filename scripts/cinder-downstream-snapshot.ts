import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

type Request = {
  schemaVersion: 1;
  packages?: Array<{ name: string; version?: string }>;
  repositories?: Array<{ name: string; path: string; commit?: string; globs?: string[] }>;
};

const usage = 'Usage: bun run scripts/cinder-downstream-snapshot.ts --request FILE [--output FILE]';

function parseArgs(args: string[]): { request?: string; output?: string } {
  const result: { request?: string; output?: string } = {};
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--request') result.request = args[++index];
    else if (args[index] === '--output') result.output = args[++index];
    else if (args[index] === '--help') return result;
  }
  return result;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.request) throw new Error(usage);
  const request = JSON.parse(await readFile(resolve(args.request), 'utf8')) as Request;
  if (request.schemaVersion !== 1) throw new Error('request.schemaVersion must be 1');
  const repositories = [];
  for (const repository of [...(request.repositories ?? [])].sort((a, b) => a.name.localeCompare(b.name))) {
    const root = resolve(repository.path);
    const files = [];
    for await (const path of new Bun.Glob('**/*').scan({ cwd: root, onlyFiles: true })) {
      if (repository.globs?.length && !repository.globs.some((glob) => new Bun.Glob(glob).match(path))) continue;
      const text = await Bun.file(`${root}/${path}`).text();
      files.push({ path, sha256: new Bun.CryptoHasher('sha256').update(text).digest('hex'), bytes: text.length });
    }
    repositories.push({ name: repository.name, commit: repository.commit ?? null, files: files.sort((a, b) => a.path.localeCompare(b.path)) });
  }
  const output = { schemaVersion: 1, collectedAt: new Date().toISOString(), packages: [...(request.packages ?? [])].sort((a, b) => a.name.localeCompare(b.name)), repositories };
  const text = JSON.stringify(output);
  if (args.output) await Bun.write(resolve(args.output), `${text}\n`);
  else console.log(text);
}

if (import.meta.main) await main();
