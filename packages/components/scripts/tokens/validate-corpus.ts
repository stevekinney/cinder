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

/**
 * Whether a source `$ref` names a resolver-internal pointer (`#/sets/<name>`)
 * rather than an on-disk document, decoding percent-escapes FIRST -- the same
 * order `resolutionOrderTarget` in `validate.ts` already applies (RFC 6901 §6:
 * percent-decode the whole fragment before structural parsing). A raw,
 * undecoded `startsWith('#/')` check disagrees with that: a valid
 * percent-encoded pointer such as `#%2Fsets%2Fbase` decodes to `#/sets/base`
 * and is correctly recognized as internal by `resolutionOrderTarget`, but the
 * SAME string does not literally start with `#/`, so an undecoded check here
 * misclassified it as a filesystem reference and reported a nonexistent file
 * named `#%2Fsets%2Fbase` instead of expanding the set.
 */
function isInternalReference(reference: string): boolean {
  let decoded = reference;
  try {
    decoded = decodeURIComponent(reference);
  } catch {
    // Leave undecoded; a malformed escape simply fails the check below, the
    // same way `resolutionOrderTarget` returns `undefined` for one.
  }
  return decoded.startsWith('#/');
}

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
export function expandSetSources(
  resolver: ResolverDocument,
  setName: string,
  visiting: Set<string> = new Set(),
  // The reference SITE reporting a missing/cyclic `setName` -- defaults to
  // `$.sets.<setName>` for a top-level call (where `setName` genuinely is the
  // site: `resolver.sets` is being looked up directly, not reached via
  // another set's `sources`), but a recursive call passes the path of the
  // `sources` array that named `setName`, so a missing/cyclic TARGET set is
  // reported at the place that referenced it rather than at
  // `$.sets.<missing>`, which does not exist in the document.
  referencePath: string = `$.sets.${setName}`,
): ResolverReference[] {
  if (visiting.has(setName))
    throw new TokenValidationError([
      {
        path: referencePath,
        reason: `cyclic set reference: ${[...visiting, setName].join(' -> ')}`,
      },
    ]);
  const set = resolver.sets[setName];
  if (!set)
    throw new TokenValidationError([
      {
        path: referencePath,
        reason: `resolver-internal reference names an unknown set: ${setName}`,
      },
    ]);
  visiting.add(setName);
  const expanded = set.sources.flatMap((source) => {
    if (!isInternalReference(source.$ref)) return [source];
    const target = resolutionOrderTarget(source.$ref);
    if (!target)
      throw new TokenValidationError([
        {
          path: `$.sets.${setName}.sources`,
          reason: `malformed resolver-internal reference: ${source.$ref}`,
        },
      ]);
    if (target.kind === 'modifiers')
      throw new TokenValidationError([
        {
          path: `$.sets.${setName}.sources`,
          reason: `a set may not reference a modifier: ${source.$ref}`,
        },
      ]);
    return expandSetSources(resolver, target.name, visiting, `$.sets.${setName}.sources`);
  });
  visiting.delete(setName);
  return expanded;
}

/**
 * Expands one modifier context's `sources` the same way {@link expandSetSources}
 * expands a set's -- a context entry may reference a set (`#/sets/<name>`),
 * expanded recursively via `expandSetSources`, but per the resolver schema's
 * `referenceObjectForModifiers` prohibition, a modifier context may not
 * reference another modifier.
 */
export function expandContextSources(
  resolver: ResolverDocument,
  modifierName: string,
  contextName: string,
): ResolverReference[] {
  const modifier = resolver.modifiers[modifierName];
  const sources = modifier?.contexts[contextName];
  if (!modifier || !sources)
    throw new TokenValidationError([
      {
        path: `$.modifiers.${modifierName}`,
        reason: `resolver-internal reference names an unknown modifier context: ${contextName}`,
      },
    ]);
  return sources.flatMap((source) => {
    if (!isInternalReference(source.$ref)) return [source];
    const target = resolutionOrderTarget(source.$ref);
    const contextPath = `$.modifiers.${modifierName}.contexts.${contextName}`;
    if (!target)
      throw new TokenValidationError([
        { path: contextPath, reason: `malformed resolver-internal reference: ${source.$ref}` },
      ]);
    if (target.kind === 'modifiers')
      throw new TokenValidationError([
        {
          path: contextPath,
          reason: `a modifier context may not reference another modifier: ${source.$ref}`,
        },
      ]);
    return expandSetSources(resolver, target.name, new Set(), contextPath);
  });
}

async function main(): Promise<void> {
  const [resolver, documents] = await Promise.all([loadResolverDocument(), loadTokenDocuments()]);
  validateResolverDocument(resolver);
  for (const { path, document } of documents) validateTokenDocument(document, path);

  const documentsByPath = new Map(documents.map(({ path, document }) => [path, document]));
  const knownPaths = new Set(documents.map(({ path }) => path));

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

  const missingSources = [
    ...expandedSets.flatMap(({ setName, sources }) =>
      sources
        .filter((source) => !knownPaths.has(normalizeSourcePath(source.$ref)))
        .map((source) => ({
          path: `$.sets.${setName}.sources`,
          reason: `source does not exist: ${source.$ref}`,
        })),
    ),
    ...expandedContexts.flatMap(({ modifierName, contextName, sources }) =>
      sources
        .filter((source) => !knownPaths.has(normalizeSourcePath(source.$ref)))
        .map((source) => ({
          path: `$.modifiers.${modifierName}.contexts.${contextName}`,
          reason: `source does not exist: ${source.$ref}`,
        })),
    ),
  ];
  if (missingSources.length > 0) throw new TokenValidationError(missingSources);

  const referencedPaths = new Set<string>([
    ...expandedSets.flatMap(({ sources }) =>
      sources.map((source) => normalizeSourcePath(source.$ref)),
    ),
    ...expandedContexts.flatMap(({ sources }) =>
      sources.map((source) => normalizeSourcePath(source.$ref)),
    ),
  ]);
  const unreferencedDocuments = documents
    .filter(({ path }) => !referencedPaths.has(path))
    .map(({ path }) => ({ path, reason: 'token document is not referenced by the resolver' }));
  if (unreferencedDocuments.length > 0) throw new TokenValidationError(unreferencedDocuments);

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
  const contextSourcesByKey = new Map(
    expandedContexts.map(({ modifierName, contextName, sources }) => [
      `${modifierName} ${contextName}`,
      sources,
    ]),
  );
  for (const modifierValues of combinations(resolver)) {
    const orderedDocuments = resolutionOrder.flatMap((entry) => {
      const sources =
        entry.kind === 'sets'
          ? setSourcesByName.get(entry.name)!
          : contextSourcesByKey.get(`${entry.name} ${modifierValues[entry.name]}`)!;
      return sources.map((source) => documentsByPath.get(normalizeSourcePath(source.$ref))!);
    });
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

/**
 * The token sources a resolutionOrder entry contributes for one
 * modifier-value combination, with any resolver-internal `#/sets/<name>`
 * reference already expanded to the plain document `$ref`s it stands for --
 * every caller (this validator, `generate.ts`, `registry.ts`) resolves the
 * result straight into `documentsByPath` lookups with no expansion of its
 * own.
 */
export function sourcesForEntry(
  resolver: ResolverDocument,
  entry: ResolutionOrderEntry,
  modifierValues: Record<string, string>,
): ResolverReference[] {
  if (entry.kind === 'sets') return expandSetSources(resolver, entry.name);
  return expandContextSources(resolver, entry.name, modifierValues[entry.name]!);
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
