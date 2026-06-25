import { Glob } from 'bun';
import { readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirectory = join(rootDirectory, 'src');
const glob = new Glob('components/**/*.svelte');
const booleanAttributePattern =
  /data-cinder-(open|selected)=\{[^}\n?]+(?:\?[^}\n]*(['"])true\2\s*:\s*(['"])false\3|\?\s*(['"])true\4\s*:\s*undefined|:\s*(['"])false\5)[^}\n]*\}/g;

const violations: string[] = [];

for await (const path of glob.scan({ cwd: sourceDirectory, absolute: true })) {
  const source = await readFile(path, 'utf8');
  for (const match of source.matchAll(booleanAttributePattern)) {
    const line = source.slice(0, match.index).split('\n').length;
    violations.push(`${relative(rootDirectory, path)}:${line}: ${match[0]}`);
  }
}

if (violations.length > 0) {
  console.error(
    "check-data-cinder-boolean-attributes — boolean data-cinder-open/selected attributes must not serialize boolean strings such as 'true' or 'false'; use presence semantics (`value ? '' : undefined`).\n" +
      violations.join('\n'),
  );
  process.exit(1);
}

console.log('check-data-cinder-boolean-attributes — OK.');
