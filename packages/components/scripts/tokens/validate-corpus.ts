import { loadResolverDocument, loadTokenDocuments } from './load.ts';
import { resolveDocuments } from './resolve.ts';
import { TokenValidationError, type ResolverDocument, type ResolverReference } from './types.ts';
import {
  validateResolvedToken,
  validateResolverDocument,
  validateTokenDocument,
} from './validate.ts';

async function main(): Promise<void> {
  const [resolver, documents] = await Promise.all([loadResolverDocument(), loadTokenDocuments()]);
  validateResolverDocument(resolver);
  for (const { path, document } of documents) validateTokenDocument(document, path);

  const documentsByPath = new Map(documents.map(({ path, document }) => [path, document]));
  const knownPaths = new Set(documents.map(({ path }) => path));

  const missingSources = [
    ...Object.entries(resolver.sets).flatMap(([setName, set]) =>
      set.sources
        .filter((source) => !knownPaths.has(source.$ref))
        .map((source) => ({
          path: `$.sets.${setName}.sources`,
          reason: `source does not exist: ${source.$ref}`,
        })),
    ),
    ...Object.entries(resolver.modifiers).flatMap(([modifierName, modifier]) =>
      Object.entries(modifier.contexts).flatMap(([contextName, sources]) =>
        sources
          .filter((source) => !knownPaths.has(source.$ref))
          .map((source) => ({
            path: `$.modifiers.${modifierName}.contexts.${contextName}`,
            reason: `source does not exist: ${source.$ref}`,
          })),
      ),
    ),
  ];
  if (missingSources.length > 0) throw new TokenValidationError(missingSources);

  const referencedPaths = new Set<string>([
    ...Object.values(resolver.sets).flatMap((set) => set.sources.map((source) => source.$ref)),
    ...Object.values(resolver.modifiers).flatMap((modifier) =>
      Object.values(modifier.contexts).flatMap((sources) => sources.map((source) => source.$ref)),
    ),
  ]);
  const unreferencedDocuments = documents
    .filter(({ path }) => !referencedPaths.has(path))
    .map(({ path }) => ({ path, reason: 'token document is not referenced by the resolver' }));
  if (unreferencedDocuments.length > 0) throw new TokenValidationError(unreferencedDocuments);

  const resolutionOrder = parseResolutionOrder(resolver);
  for (const modifierValues of combinations(resolver)) {
    const orderedDocuments = resolutionOrder.flatMap((entry) =>
      sourcesForEntry(resolver, entry, modifierValues).map(
        (source) => documentsByPath.get(source.$ref)!,
      ),
    );
    const resolved = resolveDocuments(orderedDocuments);
    for (const [path, token] of Object.entries(resolved)) validateResolvedToken(token, path);
  }
}

export type ResolutionOrderEntry = { kind: 'sets' | 'modifiers'; name: string };

function isResolverTargetKind(value: string): value is 'sets' | 'modifiers' {
  return value === 'sets' || value === 'modifiers';
}

/**
 * Parses every resolutionOrder `$ref` into its target kind and name.
 * `validateResolverDocument` (called by `main` before this runs) already
 * guarantees each entry is a well-formed, existing `#/sets/<name>` or
 * `#/modifiers/<name>` pointer, so the non-null assertions below document
 * that guarantee rather than re-deriving it.
 */
export function parseResolutionOrder(resolver: ResolverDocument): ResolutionOrderEntry[] {
  return resolver.resolutionOrder.map((entry) => {
    const match = /^#\/(sets|modifiers)\/(.+)$/.exec(entry.$ref)!;
    const kind = match[1]!;
    if (!isResolverTargetKind(kind))
      throw new Error(`resolutionOrder entry did not match a known kind: ${entry.$ref}`);
    return { kind, name: match[2]! };
  });
}

/** The token sources a resolutionOrder entry contributes for one modifier-value combination. */
export function sourcesForEntry(
  resolver: ResolverDocument,
  entry: ResolutionOrderEntry,
  modifierValues: Record<string, string>,
): ResolverReference[] {
  if (entry.kind === 'sets') return resolver.sets[entry.name]!.sources;
  const modifier = resolver.modifiers[entry.name]!;
  return modifier.contexts[modifierValues[entry.name]!]!;
}

/** Every combination of one context value per modifier, cartesian product across all modifiers. */
export function combinations(resolver: ResolverDocument): Array<Record<string, string>> {
  return Object.entries(resolver.modifiers).reduce<Array<Record<string, string>>>(
    (current, [name, modifier]) =>
      current.flatMap((selection) =>
        Object.keys(modifier.contexts).map((contextName) => ({
          ...selection,
          [name]: contextName,
        })),
      ),
    [{}],
  );
}

if (import.meta.main) await main();
