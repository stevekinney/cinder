import { Glob } from 'bun';
import { readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirectory = join(rootDirectory, 'src');
const glob = new Glob('components/**/*.svelte');

const booleanLiteralToken = String.raw`(?:"(?:true|false)"|'(?:true|false)'|\b(?:true|false)\b)`;
export const booleanAttributePattern = new RegExp(
  String.raw`data-cinder-(open|selected)=\{[^}\n?]+\?(?:[^:}\n]*${booleanLiteralToken}[^:}\n]*:[^}\n]*|[^:}\n]*:[^}\n]*${booleanLiteralToken}[^}\n]*)\}`,
  'g',
);

export function findBooleanAttributeViolations(source: string, filePath: string): string[] {
  return Array.from(source.matchAll(booleanAttributePattern), (match) => {
    const line = source.slice(0, match.index).split('\n').length;
    return `${filePath}:${line}: ${match[0]}`;
  });
}

async function main() {
  const violations: string[] = [];

  for await (const path of glob.scan({ cwd: sourceDirectory, absolute: true })) {
    const source = await readFile(path, 'utf8');
    violations.push(...findBooleanAttributeViolations(source, relative(rootDirectory, path)));
  }

  if (violations.length > 0) {
    console.error(
      "check-data-cinder-boolean-attributes — boolean data-cinder-open/selected attributes must not serialize boolean values or strings such as true, false, 'true', or 'false'; use presence semantics (`value ? '' : undefined`).\n" +
        violations.join('\n'),
    );
    process.exit(1);
  }

  console.log('check-data-cinder-boolean-attributes — OK.');
}

if (import.meta.main) {
  await main();
}
