import { Glob } from 'bun';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ResolverDocument, TokenDocument } from './types.ts';
import { assertValidResolverDocument, assertValidTokenDocument } from './validate.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const tokenRoot = join(scriptDirectory, '..', '..', 'src', 'tokens');

export async function loadRawTokenDocuments(): Promise<Array<{ path: string; document: unknown }>> {
  const files: Array<{ path: string; document: unknown }> = [];
  const glob = new Glob('**/*.tokens.json');
  for await (const path of glob.scan({ cwd: tokenRoot })) {
    const absolutePath = join(tokenRoot, path);
    files.push({ path, document: await Bun.file(absolutePath).json() });
  }
  return files.toSorted((left, right) => left.path.localeCompare(right.path));
}

export async function loadTokenDocuments(): Promise<
  Array<{ path: string; document: TokenDocument }>
> {
  const files = await loadRawTokenDocuments();
  return files.map(({ path, document }) => {
    assertValidTokenDocument(document, path);
    return { path, document };
  });
}

export async function loadResolverDocument(): Promise<ResolverDocument> {
  const document: unknown = await Bun.file(join(tokenRoot, 'cinder.resolver.json')).json();
  assertValidResolverDocument(document);
  return document;
}
