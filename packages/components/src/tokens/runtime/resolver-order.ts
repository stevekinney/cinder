import { TokenValidationError, type ResolverDocument, type ResolverReference } from './types.ts';
import { resolutionOrderTarget } from './validate-resolver.ts';

/**
 * `path.posix.normalize` without the Node dependency: collapses `.`, empty, and
 * `..` segments, and keeps a leading `/` or unresolvable leading `..` segments.
 */
function normalizePosixPath(path: string): string {
  if (path === '') return '.';
  const absolute = path.startsWith('/');
  const trailing = path.endsWith('/');
  const segments: string[] = [];
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (segments.length > 0 && segments.at(-1) !== '..') segments.pop();
      else if (!absolute) segments.push('..');
    } else segments.push(segment);
  }
  let normalized = segments.join('/');
  if (normalized === '' && !absolute) normalized = '.';
  if (normalized !== '' && trailing) normalized += '/';
  return absolute ? `/${normalized}` : normalized;
}

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
  return normalizePosixPath(decoded).replace(/^\.\//, '');
}

export function normalizedDocumentsByPath<T>(documentsByPath: Map<string, T>): Map<string, T> {
  const normalized = new Map<string, T>();
  for (const [path, document] of documentsByPath) {
    const normalizedPath = normalizeSourcePath(path);
    if (normalized.has(normalizedPath))
      throw new TokenValidationError([
        {
          path: '$',
          reason: `duplicate loaded token document path after normalization: ${normalizedPath}`,
        },
      ]);
    normalized.set(normalizedPath, document);
  }
  return normalized;
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
export function isInternalReference(reference: string): boolean {
  if (!reference.startsWith('#')) return false;
  let decoded = reference;
  try {
    decoded = decodeURIComponent(reference);
  } catch {
    // Leave undecoded; a malformed escape simply fails the check below, the
    // same way `resolutionOrderTarget` returns `undefined` for one.
  }
  return decoded.startsWith('#/');
}

export function internalSetNames(sources: ResolverReference[]): string[] {
  return sources.flatMap((source) => {
    if (!isInternalReference(source.$ref)) return [];
    const target = resolutionOrderTarget(source.$ref);
    return target?.kind === 'sets' ? [target.name] : [];
  });
}

export function reachableSetNames(resolver: ResolverDocument, rootName: string): Set<string> {
  const reachable = new Set<string>();
  const visit = (setName: string): void => {
    if (reachable.has(setName)) return;
    reachable.add(setName);
    const set = Object.hasOwn(resolver.sets, setName) ? resolver.sets[setName] : undefined;
    if (!set) return;
    for (const childName of internalSetNames(set.sources)) visit(childName);
  };
  visit(rootName);
  return reachable;
}

/** Rejects a later modifier re-expanding a base set after another modifier already overrode it. */

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
  // `Object.hasOwn` first: resolver set names are unrestricted, and `sets` is
  // a normal-prototype object, so an unknown name that happens to collide
  // with an inherited `Object.prototype` property (`constructor`,
  // `toString`, ...) would otherwise return that inherited value instead of
  // `undefined`, skipping the intended "unknown set" error and throwing a
  // raw, confusing `TypeError` from `set.sources.flatMap` below instead.
  const set = Object.hasOwn(resolver.sets, setName) ? resolver.sets[setName] : undefined;
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
  // Same `Object.hasOwn` guard as `expandSetSources` above, for the same
  // reason: an unknown modifier/context name colliding with an inherited
  // `Object.prototype` property must not silently resolve to that inherited
  // value.
  const modifier = Object.hasOwn(resolver.modifiers, modifierName)
    ? resolver.modifiers[modifierName]
    : undefined;
  const sources =
    modifier && Object.hasOwn(modifier.contexts, contextName)
      ? modifier.contexts[contextName]
      : undefined;
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

/**
 * Indexes expanded context sources by modifier name, then context name.
 *
 * Nesting two maps -- rather than concatenating both names into one string
 * key -- keeps this collision-free: resolver modifier and context names are
 * otherwise unrestricted, so e.g. modifier "a" context "b:c" and modifier
 * "a:b" context "c" could concatenate to the same key under ANY fixed
 * delimiter and silently overwrite each other, resolving the wrong document
 * list for one of them. Two-level indexing has no such joint-key space to
 * collide in.
 */
export function buildContextSourcesIndex(
  expandedContexts: ReadonlyArray<{
    modifierName: string;
    contextName: string;
    sources: ResolverReference[];
  }>,
): Map<string, Map<string, ResolverReference[]>> {
  const index = new Map<string, Map<string, ResolverReference[]>>();
  for (const { modifierName, contextName, sources } of expandedContexts) {
    const byContext = index.get(modifierName) ?? new Map();
    byContext.set(contextName, sources);
    index.set(modifierName, byContext);
  }
  return index;
}

export function validateExpandedSources(
  expandedSets: ReadonlyArray<{ setName: string; sources: ResolverReference[] }>,
  expandedContexts: ReadonlyArray<{
    modifierName: string;
    contextName: string;
    sources: ResolverReference[];
  }>,
  documentsByPath: Map<string, unknown>,
): void {
  const knownPaths = new Set([...documentsByPath.keys()].map(normalizeSourcePath));
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
}

/**
 * Returns the concrete ordered document scopes in which each source participates.
 * `$extends` targets are resolved against these scopes only; unrelated sets and
 * modifier contexts must not contribute projection metadata to one another.
 */

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
