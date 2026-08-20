import { Glob } from 'bun';
import { readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = resolve(fileURLToPath(new URL('.', import.meta.url)));
const packageRoot = resolve(scriptDirectory, '..');
const repositoryRoot = resolve(packageRoot, '..', '..');
const componentsDirectory = join(packageRoot, 'src', 'components');

export type ProseReferenceFailure = { reference: string; filePath: string };

/**
 * Finds component names used as prose guidance. Only names that are explicitly
 * formatted as identifiers (backticks or kebab-case) participate: ordinary
 * English words are not component references, and example ids are resolved in
 * their own namespace before a failure is reported.
 */
export function findProseReferenceFailures(input: {
  source: string;
  filePath: string;
  componentNames: ReadonlySet<string>;
  exampleIds: ReadonlySet<string>;
  publicSubpaths: ReadonlySet<string>;
}): ProseReferenceFailure[] {
  const failures = new Map<string, ProseReferenceFailure>();
  const add = (reference: string) => {
    if (
      input.componentNames.has(reference) ||
      input.exampleIds.has(reference) ||
      input.publicSubpaths.has(reference)
    ) {
      return;
    }
    failures.set(reference, { reference, filePath: input.filePath });
  };

  for (const match of input.source.matchAll(/`([a-z][a-z0-9-]+)`/g)) {
    const reference = match[1];
    if (reference?.includes('-')) add(reference);
  }
  for (const match of input.source.matchAll(/\b(?:use|compose)\s+([a-z][a-z0-9-]+)/gi)) {
    const reference = match[1]?.toLowerCase();
    if (reference && (reference.includes('-') || input.componentNames.has(reference)))
      add(reference);
  }
  for (const match of input.source.matchAll(/@lostgradient\/cinder\/([a-z][a-z0-9-]+)/g)) {
    const reference = match[1];
    if (reference) add(reference);
  }

  return [...failures.values()];
}

function componentNames(): Set<string> {
  return new Set(
    readdirSync(componentsDirectory, { withFileTypes: true })
      .filter(
        (entry) => entry.isDirectory() && !entry.name.startsWith('_') && entry.name !== 'icons',
      )
      .map((entry) => entry.name),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function exampleIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  const examples = new Glob('src/components/**/*.examples.json');
  for await (const filePath of examples.scan({ cwd: packageRoot })) {
    const parsed: unknown = await Bun.file(join(packageRoot, filePath)).json();
    if (!isRecord(parsed) || !Array.isArray(parsed.examples)) continue;
    for (const example of parsed.examples) {
      if (isRecord(example) && typeof example.id === 'string') ids.add(example.id);
    }
  }
  return ids;
}

async function publicSubpaths(): Promise<Set<string>> {
  const manifest: unknown = await Bun.file(join(packageRoot, 'package.json')).json();
  if (!isRecord(manifest) || !isRecord(manifest.exports)) return new Set();
  return new Set(
    Object.keys(manifest.exports)
      .filter((subpath) => /^\.\/[a-z][a-z0-9-]+$/.test(subpath))
      .map((subpath) => subpath.slice(2)),
  );
}

async function main(): Promise<void> {
  const names = componentNames();
  const examples = await exampleIds();
  const subpaths = await publicSubpaths();
  const files = new Glob('{src/components/**/*.svelte,src/components/**/*.md,components.json}');
  const failures: ProseReferenceFailure[] = [];

  for await (const filePath of files.scan({ cwd: packageRoot })) {
    failures.push(
      ...findProseReferenceFailures({
        source: await Bun.file(join(packageRoot, filePath)).text(),
        filePath: relative(repositoryRoot, join(packageRoot, filePath)),
        componentNames: names,
        exampleIds: examples,
        publicSubpaths: subpaths,
      }),
    );
  }

  if (failures.length > 0) {
    console.error(
      [
        'check-prose-component-references — dangling component references:',
        ...failures.map((failure) => `${failure.filePath}: ${failure.reference}`),
      ].join('\n'),
    );
    process.exit(1);
  }
  console.log('check-prose-component-references — OK.');
}

if (import.meta.main) await main();
