import {
  validateModifierSetExpansionOrder,
  validateModifierTokenPaths,
} from './corpus-validation.ts';
import { resolveDocuments } from './resolve.ts';
import {
  buildContextSourcesIndex,
  combinations,
  expandContextSources,
  expandSetSources,
  normalizeSourcePath,
  normalizedDocumentsByPath,
  parseResolutionOrder,
  validateExpandedSources,
} from './resolver-order.ts';
import { TokenValidationError, type ResolverDocument, type TokenDocument } from './types.ts';
import { validateResolverDocument } from './validate-resolver.ts';
import { assertSafeExtensionMetadata } from './validate-schema.ts';
import { validateResolvedToken } from './validate-tokens.ts';
import { assertValidTokenDocument } from './validate.ts';

/**
 * Expands a set's `sources` into plain token-document `$ref`s only, recursing
 * through any resolver-internal `#/sets/<name>` entries (a set's own sources
 * may themselves reference further sets) before any of those entries reach
 * the file-existence check, `referencedPaths`, or a document-loading
 * consumer (`sourcesForEntry`'s other callers -- `generate.ts`, `registry.ts`
 * -- resolve source `$ref`s straight into `documentsByPath` lookups with no
 * expansion of their own, so an unexpanded internal ref there is a
 * non-null-assertion crash, not a validation error). `visiting` guards
 * against a cycle between sets; per the vendored resolver schema's own
 * stated prohibition (`set.json`'s `referenceObjectForSets` pattern), a set
 * may not reference a modifier, which is rejected here with a named path and
 * reason rather than falling through to a misleading "source does not
 * exist".
 */

export function orderedTokenValidationContexts(
  resolver: ResolverDocument,
  documentsByPath: Map<string, unknown>,
): Map<string, unknown[][]> {
  documentsByPath = normalizedDocumentsByPath(documentsByPath);
  const expandedSets = Object.keys(resolver.sets).map((setName) => ({
    setName,
    sources: expandSetSources(resolver, setName),
  }));
  const expandedContexts = Object.entries(resolver.modifiers).flatMap(([modifierName, modifier]) =>
    Object.keys(modifier.contexts).map((contextName) => ({
      modifierName,
      contextName,
      sources: expandContextSources(resolver, modifierName, contextName),
    })),
  );
  const resolutionOrder = parseResolutionOrder(resolver);
  validateExpandedSources(expandedSets, expandedContexts, documentsByPath);
  const setSourcesByName = new Map(expandedSets.map((entry) => [entry.setName, entry.sources]));
  const contextSourcesByModifier = buildContextSourcesIndex(expandedContexts);
  const pathByDocument = new Map(
    [...documentsByPath.entries()].map(([path, document]) => [document, path]),
  );
  const contextsByPath = new Map<string, unknown[][]>();
  for (const modifierValues of combinations(resolver)) {
    const orderedDocuments = resolutionOrder.flatMap((entry) => {
      const sources =
        entry.kind === 'sets'
          ? setSourcesByName.get(entry.name)!
          : contextSourcesByModifier.get(entry.name)!.get(modifierValues[entry.name]!)!;
      return sources.map((source) => documentsByPath.get(normalizeSourcePath(source.$ref))!);
    });
    const uniqueDocuments = [...new Set(orderedDocuments)];
    for (const document of uniqueDocuments) {
      const path = pathByDocument.get(document);
      if (path === undefined) continue;
      const contexts = contextsByPath.get(path) ?? [];
      if (
        !contexts.some(
          (context) =>
            context.length === orderedDocuments.length &&
            context.every((entry, index) => entry === orderedDocuments[index]),
        )
      )
        contexts.push(orderedDocuments);
      contextsByPath.set(path, contexts);
    }
  }
  return contextsByPath;
}

export function validateLoadedTokenDocuments(
  resolver: ResolverDocument,
  loaded: Array<{ path: string; document: unknown }>,
): Array<{ path: string; document: TokenDocument }> {
  const rawDocumentsByPath = new Map<string, unknown>();
  for (const { path, document } of loaded) {
    if (rawDocumentsByPath.has(path))
      throw new TokenValidationError([
        {
          path: '$',
          reason: `duplicate loaded token document path after normalization: ${normalizeSourcePath(path)}`,
        },
      ]);
    rawDocumentsByPath.set(path, document);
  }
  const documentsByPath = normalizedDocumentsByPath(rawDocumentsByPath);
  const sourceByDocument = new Map<object, string>();
  for (const { path, document } of loaded) {
    if (typeof document === 'object' && document !== null) sourceByDocument.set(document, path);
  }
  // Validate extension metadata against each document's owning path before
  // composing contexts. The context array intentionally contains raw
  // documents, so attributing a malformed lookup document to the candidate
  // source would lose the provenance needed to repair it.
  for (const { path, document } of loaded) assertSafeExtensionMetadata(document, '', path);
  const contextsByPath = orderedTokenValidationContexts(resolver, documentsByPath);
  return loaded.map(({ path, document }) => {
    const candidate = document;
    const contexts = contextsByPath.get(normalizeSourcePath(path)) ?? [];
    assertValidLoadedDocument(candidate, path, contexts, sourceByDocument);
    return { path, document: candidate };
  });
}

export function assertValidLoadedDocument(
  document: unknown,
  path: string,
  contexts: readonly unknown[][],
  sourceByDocument: ReadonlyMap<object, string>,
): asserts document is TokenDocument {
  if (contexts.length === 0) assertValidTokenDocument(document, path, [], sourceByDocument);
  else
    for (const context of contexts) assertValidInContext(document, path, context, sourceByDocument);
}

const documentIds = new WeakMap<object, number>();
const validatedStacks = new Set<string>();
const REMEMBERED_STACKS = 96;
let nextDocumentId = 1;

function stackKey(documents: readonly object[]): string {
  return documents
    .map((document) => {
      let id = documentIds.get(document);
      if (id === undefined) {
        id = nextDocumentId++;
        documentIds.set(document, id);
      }
      return id;
    })
    .join(',');
}

/**
 * Resolves one context's ordered documents and validates every resolved token. A pass is
 * remembered by the identity of the ordered documents, so a context whose documents did not
 * change since the last validation (the dark stacks after a light-only edit) is not resolved
 * again. Only a pass is remembered. Sources must not be mutated after validation.
 */
function assertResolvedTokensValid(documents: TokenDocument[]): void {
  const key = stackKey(documents);
  if (validatedStacks.has(key)) return;
  const resolved = resolveDocuments(documents);
  for (const [path, token] of Object.entries(resolved)) validateResolvedToken(token, path);
  validatedStacks.add(key);
  if (validatedStacks.size > REMEMBERED_STACKS) {
    const oldest = validatedStacks.values().next().value;
    if (oldest !== undefined) validatedStacks.delete(oldest);
  }
}

/** Cap on remembered ordered prefixes per document; edits mint new override identities. */
const REMEMBERED_PREFIXES = 24;
const validatedPrefixes = new WeakMap<object, unknown[][]>();
const extendsFlags = new WeakMap<object, boolean>();

function mentionsExtends(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const cached = extendsFlags.get(value);
  if (cached !== undefined) return cached;
  const found = Object.entries(value).some(
    ([key, child]) =>
      key === '$extends' || ((key === '$root' || !key.startsWith('$')) && mentionsExtends(child)),
  );
  extendsFlags.set(value, found);
  return found;
}

const sameIdentities = (left: readonly unknown[], right: readonly unknown[]): boolean =>
  left.length === right.length && left.every((entry, index) => entry === right[index]);

/**
 * Validates one document in one context's ordered stack. A document's validity depends on the
 * ordered prefix through itself (the lookup scope matters only through `$extends`), so a pass
 * is remembered by document and prefix identity and not repeated while neither changes: the
 * same document appears in several contexts with the same prefix, and an edit to an override
 * document leaves every earlier document's prefix intact. Only a pass is remembered, and only
 * when no document in the stack uses `$extends`. Sources must not be mutated after validation.
 */
function assertValidInContext(
  document: unknown,
  path: string,
  context: readonly unknown[],
  sourceByDocument: ReadonlyMap<object, string>,
): void {
  const position = context.indexOf(document);
  const memoizable =
    position >= 0 &&
    typeof document === 'object' &&
    document !== null &&
    !context.some(mentionsExtends);
  if (!memoizable) {
    assertValidTokenDocument(document, path, context, sourceByDocument);
    return;
  }
  const prefix = context.slice(0, position + 1);
  const remembered = validatedPrefixes.get(document) ?? [];
  if (remembered.some((entry) => sameIdentities(entry, prefix))) return;
  assertValidTokenDocument(document, path, context, sourceByDocument);
  validatedPrefixes.set(document, [prefix, ...remembered].slice(0, REMEMBERED_PREFIXES));
}

/**
 * Validates a whole corpus in memory: the resolver, every token document
 * (schema first, then semantic checks), the set and modifier expansion order,
 * modifier token paths, and every concrete modifier-value combination's
 * resolved tokens. Throws a `TokenValidationError` addressed by path. The
 * caller supplies documents; this reads nothing.
 */
export function validateCorpus(
  resolver: ResolverDocument,
  loaded: Array<{ path: string; document: unknown }>,
): Map<string, TokenDocument> {
  validateResolverDocument(resolver);

  const expandedSets = Object.keys(resolver.sets).map((setName) => ({
    setName,
    sources: expandSetSources(resolver, setName),
  }));
  const expandedContexts = Object.entries(resolver.modifiers).flatMap(([modifierName, modifier]) =>
    Object.keys(modifier.contexts).map((contextName) => ({
      modifierName,
      contextName,
      sources: expandContextSources(resolver, modifierName, contextName),
    })),
  );

  const referencedPaths = new Set<string>([
    ...expandedSets.flatMap(({ sources }) =>
      sources.map((source) => normalizeSourcePath(source.$ref)),
    ),
    ...expandedContexts.flatMap(({ sources }) =>
      sources.map((source) => normalizeSourcePath(source.$ref)),
    ),
  ]);
  const unreferencedDocuments = loaded
    .filter(({ path }) => !referencedPaths.has(normalizeSourcePath(path)))
    .map(({ path }) => ({ path, reason: 'token document is not referenced by the resolver' }));
  if (unreferencedDocuments.length > 0) throw new TokenValidationError(unreferencedDocuments);

  const documents = validateLoadedTokenDocuments(resolver, loaded);
  const documentsByPath = normalizedDocumentsByPath(
    new Map(documents.map(({ path, document }) => [path, document])),
  );
  validateModifierSetExpansionOrder(resolver, documentsByPath);
  validateModifierTokenPaths(resolver, documentsByPath);

  const resolutionOrder = parseResolutionOrder(resolver);
  // `expandedSets`/`expandedContexts` above already expanded every set's and
  // every context's sources exactly once (internal `#/sets/<name>` refs
  // recursively resolved). Indexing them here, rather than calling
  // `sourcesForEntry` again per resolutionOrder entry, avoids re-running that
  // recursive expansion once per modifier-value COMBINATION below -- this
  // loop runs the cartesian product of every modifier's contexts, so an
  // unmemoized re-expansion is a real multiplier as the corpus grows more
  // modifiers or contexts, even though the expansion itself is invariant per
  // set/context and only needs computing once.
  const setSourcesByName = new Map(expandedSets.map(({ setName, sources }) => [setName, sources]));
  const contextSourcesByModifier = buildContextSourcesIndex(expandedContexts);
  for (const modifierValues of combinations(resolver)) {
    const orderedDocuments = resolutionOrder.flatMap((entry) => {
      const sources =
        entry.kind === 'sets'
          ? setSourcesByName.get(entry.name)!
          : contextSourcesByModifier.get(entry.name)!.get(modifierValues[entry.name]!)!;
      return sources.map((source) => documentsByPath.get(normalizeSourcePath(source.$ref))!);
    });
    assertResolvedTokensValid(orderedDocuments);
  }
  return documentsByPath;
}
