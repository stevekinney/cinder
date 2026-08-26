import { posix } from 'node:path';

import { loadResolverDocument, loadTokenDocuments } from './load.ts';
import { resolveDocuments } from './resolve.ts';
import { TokenValidationError, type ResolverDocument, type ResolverReference } from './types.ts';
import {
  resolutionOrderTarget,
  validateResolvedToken,
  validateResolverDocument,
  validateTokenDocument,
} from './validate.ts';

/**
 * Normalizes a source `$ref` into the repository-relative form `loadTokenDocuments`
 * reports. The resolver schema types these as URI references, so `./sets/x.tokens.json`
 * and `sets/x.tokens.json` name the same file; comparing the raw strings against
 * globbed paths would report a file that exists as missing. Percent-escapes are
 * decoded for the same reason, and a malformed escape is left as-is so the failure
 * surfaces as a clear "source does not exist" rather than a decoding crash --
 * ajv's `uri-reference` format catches genuinely malformed references upstream.
 */
export function normalizeSourcePath(reference: string): string {
  let decoded = reference;
  try {
    decoded = decodeURIComponent(reference);
  } catch {
    // Leave the reference undecoded; the existence check reports it.
  }
  return posix.normalize(decoded).replace(/^\.\//, '');
}

async function main(): Promise<void> {
  const [resolver, documents] = await Promise.all([loadResolverDocument(), loadTokenDocuments()]);
  validateResolverDocument(resolver);
  for (const { path, document } of documents) validateTokenDocument(document, path);

  const documentsByPath = new Map(documents.map(({ path, document }) => [path, document]));
  const knownPaths = new Set(documents.map(({ path }) => path));

  const missingSources = [
    ...Object.entries(resolver.sets).flatMap(([setName, set]) =>
      set.sources
        .filter((source) => !knownPaths.has(normalizeSourcePath(source.$ref)))
        .map((source) => ({
          path: `$.sets.${setName}.sources`,
          reason: `source does not exist: ${source.$ref}`,
        })),
    ),
    ...Object.entries(resolver.modifiers).flatMap(([modifierName, modifier]) =>
      Object.entries(modifier.contexts).flatMap(([contextName, sources]) =>
        sources
          .filter((source) => !knownPaths.has(normalizeSourcePath(source.$ref)))
          .map((source) => ({
            path: `$.modifiers.${modifierName}.contexts.${contextName}`,
            reason: `source does not exist: ${source.$ref}`,
          })),
      ),
    ),
  ];
  if (missingSources.length > 0) throw new TokenValidationError(missingSources);

  const referencedPaths = new Set<string>([
    ...Object.values(resolver.sets).flatMap((set) =>
      set.sources.map((source) => normalizeSourcePath(source.$ref)),
    ),
    ...Object.values(resolver.modifiers).flatMap((modifier) =>
      Object.values(modifier.contexts).flatMap((sources) =>
        sources.map((source) => normalizeSourcePath(source.$ref)),
      ),
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
        (source) => documentsByPath.get(normalizeSourcePath(source.$ref))!,
      ),
    );
    const resolved = resolveDocuments(orderedDocuments);
    for (const [path, token] of Object.entries(resolved)) validateResolvedToken(token, path);
  }
}

export type ResolutionOrderEntry = { kind: 'sets' | 'modifiers'; name: string };

/**
 * Parses every resolutionOrder `$ref` into its target kind and name, reusing
 * validation's own parser so the two paths cannot drift. That matters for
 * RFC 6901 tilde-escapes: a set named `a/b` is referenced as `#/sets/a~1b`,
 * and decoding it here is what keeps the later `resolver.sets[name]` lookup
 * in `sourcesForEntry` finding the entry that validation already accepted.
 */
export function parseResolutionOrder(resolver: ResolverDocument): ResolutionOrderEntry[] {
  return resolver.resolutionOrder.map((entry) => {
    const target = resolutionOrderTarget(entry.$ref);
    if (!target)
      throw new Error(`resolutionOrder entry is not a well-formed pointer: ${entry.$ref}`);
    return target;
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
