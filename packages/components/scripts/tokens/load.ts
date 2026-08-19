import { Glob } from 'bun';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ResolverDocument, TokenDocument } from './types.ts';
import { assertValidResolverDocument, assertValidTokenDocument } from './validate.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const tokenRoot = join(scriptDirectory, '..', '..', 'src', 'tokens');

export async function loadTokenDocuments(): Promise<
  Array<{ path: string; document: TokenDocument }>
> {
  const files: Array<{ path: string; document: TokenDocument }> = [];
  const glob = new Glob('**/*.tokens.json');
  for await (const path of glob.scan({ cwd: tokenRoot })) {
    const absolutePath = join(tokenRoot, path);
    const document: unknown = await Bun.file(absolutePath).json();
    assertValidTokenDocument(document, path);
    files.push({ path, document });
  }
  return files.toSorted((left, right) => left.path.localeCompare(right.path));
}

export async function loadResolverDocument(): Promise<ResolverDocument> {
  const document: unknown = await Bun.file(join(tokenRoot, 'cinder.resolver.json')).json();
  assertValidResolverDocument(document);
  return document;
}
