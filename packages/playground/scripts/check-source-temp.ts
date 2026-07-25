import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const sourceDirectory = join(import.meta.dir, '..', 'src');
const entries = await readdir(sourceDirectory, { withFileTypes: true });
const stragglers = entries.filter((entry) => entry.isDirectory() && entry.name.startsWith('.tmp-'));

if (stragglers.length > 0) {
  console.error(`Found ${stragglers.length} temporary directories under packages/playground/src:`);
  for (const entry of stragglers) console.error(`- ${entry.name}`);
  process.exit(1);
}

console.log('No temporary directories found under packages/playground/src.');
