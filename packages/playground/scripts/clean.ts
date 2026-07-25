import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const playgroundRoot = join(import.meta.dir, '..');
await rm(join(playgroundRoot, '.tmp'), { recursive: true, force: true });

const sourceDirectory = join(playgroundRoot, 'src');
const sourceEntries = (await readdir(sourceDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('.tmp-'))
  .map((entry) => entry.name);
await Promise.all(
  sourceEntries.map((entry) =>
    rm(join(playgroundRoot, 'src', entry), { recursive: true, force: true }),
  ),
);
