import { Glob } from 'bun';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ResolverDocument, TokenDocument } from './types.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const tokenRoot = join(scriptDirectory, '..', '..', 'src', 'tokens');

export async function loadTokenDocuments(): Promise<
  Array<{ path: string; document: TokenDocument }>
> {
  const files: Array<{ path: string; document: TokenDocument }> = [];
  const glob = new Glob('**/*.tokens.json');
  for await (const path of glob.scan({ cwd: tokenRoot })) {
    const absolutePath = join(tokenRoot, path);
    files.push({ path, document: (await Bun.file(absolutePath).json()) as TokenDocument });
  }
  return files.toSorted((left, right) => left.path.localeCompare(right.path));
}

export async function loadResolverDocument(): Promise<ResolverDocument> {
  return Bun.file(join(tokenRoot, 'cinder.resolver.json')).json() as Promise<ResolverDocument>;
}

export function resolveSourcePath(source: string): string {
  return relative(tokenRoot, join(tokenRoot, source));
}
