/**
 * Loaders for the theme-builder fixture corpus, shared by the authoring tests.
 *
 * The profile fixture is loaded through `validateLoadedTokenDocuments`, the same
 * gate `loadCorpus` uses, so it is validated as a corpus (an override document
 * may rely on a type its base declares) rather than as isolated files.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateLoadedTokenDocuments } from '../../src/tokens/runtime/corpus-documents.ts';
import { normalizedDocumentsByPath } from '../../src/tokens/runtime/resolver-order.ts';
import type { ResolverDocument, TokenDocument } from '../../src/tokens/runtime/types.ts';
import { assertValidResolverDocument } from '../../src/tokens/runtime/validate.ts';

export const fixtureDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'theme-builder',
);

const PROFILE_DOCUMENTS = [
  'profile-base.tokens.json',
  'profile-light.tokens.json',
  'profile-dark.tokens.json',
  'profile-motion-default.tokens.json',
  'profile-motion-reduced.tokens.json',
  'profile-motion-forced.tokens.json',
];

export function readFixture(relativePath: string): unknown {
  return JSON.parse(readFileSync(join(fixtureDirectory, relativePath), 'utf8'));
}

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Loads `profile.resolver.json` and the bundled documents it references. */
export function loadProfileCorpus(): {
  resolver: ResolverDocument;
  documentsByPath: Map<string, TokenDocument>;
} {
  const resolver = readFixture('profile.resolver.json') as ResolverDocument;
  assertValidResolverDocument(resolver);
  const loaded = PROFILE_DOCUMENTS.map((path) => ({
    path,
    document: readFixture(path),
  }));
  const validated = validateLoadedTokenDocuments(resolver, loaded);
  return {
    resolver,
    documentsByPath: normalizedDocumentsByPath(
      new Map(validated.map(({ path, document }) => [path, document])),
    ),
  };
}

/** A deep copy whose documents can be edited without touching the shared fixture. */
export function cloneCorpus(corpus: ReturnType<typeof loadProfileCorpus>) {
  return {
    resolver: deepClone(corpus.resolver),
    documentsByPath: new Map(
      [...corpus.documentsByPath].map(([path, document]) => [path, deepClone(document)]),
    ),
  };
}
