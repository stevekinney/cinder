import { readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { PLAYGROUND_TEMP_ROOT } from '../src/playground-paths.ts';

const sourceDirectory = join(import.meta.dir, '..', 'src');
const tempRootRelativeToSource = relative(sourceDirectory, PLAYGROUND_TEMP_ROOT);
if (
  tempRootRelativeToSource !== '..' &&
  !tempRootRelativeToSource.startsWith(`..${sep}`)
) {
  console.error(
    `Playground build temporary root must stay outside packages/playground/src: ${PLAYGROUND_TEMP_ROOT}`,
  );
  process.exit(1);
}

const entries = await readdir(sourceDirectory, { withFileTypes: true });
const stragglers = entries.filter((entry) => entry.isDirectory() && entry.name.startsWith('.tmp-'));

if (stragglers.length > 0) {
  console.error(`Found ${stragglers.length} temporary directories under packages/playground/src:`);
  for (const entry of stragglers) console.error(`- ${entry.name}`);
  process.exit(1);
}

console.log('No temporary directories found under packages/playground/src.');
