import { Glob } from 'bun';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = resolve(fileURLToPath(new URL('.', import.meta.url)));
const packageRoot = resolve(scriptDirectory, '..');
const repositoryRoot = resolve(packageRoot, '..', '..');

export type ProseReferenceFailure = { reference: string; filePath: string };

/**
 * Finds component names used as prose guidance. Only names that are explicitly
 * introduced as component guidance participate: ordinary English and platform
 * API identifiers are not component references, and example ids are resolved
 * in their own namespace before a failure is reported.
 */
export function findProseReferenceFailures(input: {
  source: string;
  filePath: string;
  componentNames: ReadonlySet<string>;
  exampleIds: ReadonlySet<string>;
  publicSubpaths: ReadonlySet<string>;
}): ProseReferenceFailure[] {
  const failures = new Map<string, ProseReferenceFailure>();
  const addProseReference = (reference: string) => {
    if (
      input.componentNames.has(reference) ||
      input.exampleIds.has(reference) ||
      input.publicSubpaths.has(reference)
    ) {
      return;
    }
    failures.set(reference, { reference, filePath: input.filePath });
  };
  const addPackageImport = (reference: string) => {
    if (input.componentNames.has(reference) || input.publicSubpaths.has(reference)) return;
    failures.set(reference, { reference, filePath: input.filePath });
  };

  for (const match of input.source.matchAll(
    /\b(?:use|compose|choose|prefer|replace|switch to|reach for|instead of|rather than|its)\s+(?:an?\s+)?`?([a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)*)`?/gi,
  )) {
    const reference = match[1]?.toLowerCase();
    const isPlatformIdentifier = reference?.startsWith('aria-') || reference?.startsWith('data-');
    const isExplicitReference = match[0].includes('`');
    const isExampleReference =
      match[0].toLowerCase().startsWith('its ') && reference?.includes('-');
    const followingText = input.source.slice(
      (match.index ?? 0) + match[0].length,
      (match.index ?? 0) + match[0].length + 100,
    );
    const isExternalPackageReference = /\bfrom\s+\x60?@[^\s\x60]+/.test(followingText);
    if (
      reference &&
      !isPlatformIdentifier &&
      !isExternalPackageReference &&
      (isExplicitReference || isExampleReference || input.componentNames.has(reference))
    )
      addProseReference(reference);
  }
  for (const match of input.source.matchAll(
    /@lostgradient\/cinder\/([a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)*)/g,
  )) {
    const reference = match[1];
    if (reference) addPackageImport(reference);
  }

  return [...failures.values()];
}

async function componentNames(): Promise<Set<string>> {
  const names = new Set<string>();
  const components = new Glob('src/components/**/*.svelte');
  for await (const filePath of components.scan({ cwd: packageRoot })) {
    const segments = filePath.split('/');
    const sourceName = segments.at(-1)?.replace(/\.svelte$/, '');
    const componentSegments = segments.slice(2, -1);
    const leafDirectory = componentSegments.at(-1);
    if (
      sourceName === leafDirectory &&
      componentSegments.length > 0 &&
      componentSegments.every((segment) => !segment.startsWith('_'))
    ) {
      names.add(componentSegments.join('/'));
    }
  }
  return names;
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
      .filter((subpath) => /^\.\/[a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)*$/.test(subpath))
      .map((subpath) => subpath.slice(2)),
  );
}

export async function proseSourcePaths(): Promise<string[]> {
  const files = ['components.json'];
  for (const pattern of ['src/components/**/*.svelte', 'src/components/**/*.md']) {
    const sources = new Glob(pattern);
    for await (const filePath of sources.scan({ cwd: packageRoot })) files.push(filePath);
  }
  return files;
}

function metadataProse(source: string): string {
  const parsed: unknown = JSON.parse(source);
  if (!isRecord(parsed) || !Array.isArray(parsed.components)) return '';

  const prose: string[] = [];
  for (const component of parsed.components) {
    if (!isRecord(component)) continue;
    if (typeof component.purpose === 'string') prose.push(component.purpose);
    if (Array.isArray(component.useWhen)) {
      prose.push(
        ...component.useWhen.filter((value): value is string => typeof value === 'string'),
      );
    }
    if (Array.isArray(component.avoidWhen)) {
      for (const entry of component.avoidWhen) {
        if (isRecord(entry) && typeof entry.reason === 'string') prose.push(entry.reason);
      }
    }
  }
  return prose.join('\n');
}

export function componentDocumentationProse(filePath: string, source: string): string {
  if (filePath === 'components.json') return metadataProse(source);
  if (filePath.endsWith('.svelte')) {
    return source.match(/<script\b[^>]*\bmodule\b[^>]*>\s*(\/\*\*[\s\S]*?\*\/)/)?.[1] ?? '';
  }

  const sections = [
    ...source.matchAll(/(?:^|\n)## (?:Use|Avoid) when[^\n]*\n([\s\S]*?)(?=\n## |\s*$)/gi),
  ].map((match) => match[1] ?? '');
  const related = [...source.matchAll(/^Related components:.*$/gim)].map((match) => match[0]);
  return [...sections, ...related].join('\n');
}

async function main(): Promise<void> {
  const names = await componentNames();
  const examples = await exampleIds();
  const subpaths = await publicSubpaths();
  const failures: ProseReferenceFailure[] = [];

  for (const filePath of await proseSourcePaths()) {
    failures.push(
      ...findProseReferenceFailures({
        source: componentDocumentationProse(
          filePath,
          await Bun.file(join(packageRoot, filePath)).text(),
        ),
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
