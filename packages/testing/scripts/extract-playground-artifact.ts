import { lstat, mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { verifyArtifactTree } from './playground-artifact-tree.ts';

export function safeMember(name: string): boolean {
  if (!name || name.startsWith('/') || name.split('/').includes('..')) return false;
  for (let index = 0; index < name.length; index++) {
    const code = name.charCodeAt(index);
    if (code < 32 || code === 127 || code === 92) return false;
  }
  return true;
}

async function main(): Promise<void> {
  const { values, tokens } = parseArgs({
    args: process.argv.slice(2),
    strict: true,
    allowPositionals: false,
    tokens: true,
    options: { archive: { type: 'string' }, destination: { type: 'string' } },
  });
  const options = tokens.filter((token) => token.kind === 'option');
  if (new Set(options.map((token) => token.name)).size !== options.length)
    throw new Error('[static-playground] duplicate extraction flag');
  const { archive, destination } = values;
  if (!archive || !destination)
    throw new Error(
      'usage: extract-playground-artifact.ts --archive <tar> --destination <fresh-directory>',
    );
  const target = resolve(destination);
  if (
    await lstat(target)
      .then(() => true)
      .catch(() => false)
  )
    throw new Error('[static-playground] extraction destination must be fresh');
  await mkdir(target, { recursive: true });
  const listing = Bun.spawnSync(['tar', '-tf', resolve(archive)]);
  if (listing.exitCode !== 0)
    throw new Error('[static-playground] unable to inspect artifact archive');
  const names = listing.stdout
    .toString()
    .split('\n')
    .filter(Boolean)
    .map((name) => name.replace(/^(?:\.\/)+/, ''));
  for (const name of names) {
    if (!safeMember(name) || name.includes('\n') || name.includes('\r'))
      throw new Error(`[static-playground] unsafe artifact archive member: ${name}`);
  }
  const verbose = Bun.spawnSync(['tar', '-tvf', resolve(archive)]);
  if (verbose.exitCode !== 0)
    throw new Error('[static-playground] unable to inspect archive types');
  const records = verbose.stdout.toString().split('\n').filter(Boolean);
  if (records.length !== names.length)
    throw new Error('[static-playground] archive member listing is ambiguous');
  records.forEach((record, index) => {
    const mode = record[0];
    if (mode !== '-' && mode !== 'd')
      throw new Error(`[static-playground] unsafe artifact archive member: ${names[index]}`);
  });
  const extraction = Bun.spawnSync(['tar', '-xf', resolve(archive), '-C', target]);
  if (extraction.exitCode !== 0)
    throw new Error(
      `[static-playground] artifact extraction failed: ${extraction.stderr.toString()}`,
    );
  const root = await readFile(join(target, 'static-playground-report.json'), 'utf8').catch(
    () => undefined,
  );
  if (!root)
    throw new Error('[static-playground] extracted artifact is missing its producer report');
  const manifest: unknown = JSON.parse(
    await readFile(join(target, 'artifact-tree-manifest.json'), 'utf8'),
  );
  await verifyArtifactTree(target, manifest);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
