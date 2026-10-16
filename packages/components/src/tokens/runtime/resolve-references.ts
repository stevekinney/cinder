import { groupMetadataBase } from './resolve-extends.ts';
import {
  type JsonObject,
  type RawRefs,
  type ResolvedTokens,
  clone,
  getByPath,
  isObject,
  issue,
  pointerSegments,
  tokenPathFromReference,
} from './resolve-shared.ts';
import type { DesignToken, TokenGroup } from './types.ts';
import { TokenValidationError } from './types.ts';

export function resolveReference(
  reference: string,
  tokens: ResolvedTokens,
  rawRefs: RawRefs,
  rootTokenPaths: Set<string>,
  resolving: Set<string>,
  groups: Map<string, TokenGroup>,
  completed: Set<string>,
): unknown {
  if (reference === '#/') return issue(reference, 'reference target does not exist');
  const segments = reference.startsWith('#/')
    ? pointerSegments(reference)
    : reference.slice(1, -1).split('.');
  // The document itself is also the root group. When it carries both group
  // metadata and a `$root` token, document-level metadata pointers must read
  // the group object unless `$root` is explicitly present.
  const documentGroup = groups.get('');
  if (
    reference.startsWith('#/') &&
    documentGroup &&
    typeof segments[0] === 'string' &&
    segments[0].startsWith('$') &&
    segments[0] !== '$root' &&
    segments[0] !== '$value'
  ) {
    const propertyValue = getByPath(documentGroup, segments);
    if (propertyValue === undefined)
      issue(reference, 'reference target document group has no requested property');
    return clone(propertyValue);
  }
  if (reference.startsWith('#/') && segments[0] === '$root') {
    const rootToken = tokens.get('');
    if (!rootToken) return issue(reference, 'reference target does not exist');
    // A bare `#/$root` pointer (nothing after `$root`) names the document
    // root token's WHOLE identity, exactly like an ordinary whole-token
    // pointer with no trailing segments -- it must extract `$value`, not
    // return the raw `DesignToken` object. An explicit reserved-property
    // segment (`#/$root/$value`, `#/$root/$description`, ...) should walk the
    // `DesignToken` object itself instead -- see the identical discrimination
    // in the loop below for why any `$`-prefixed segment, not just `$value`,
    // selects that base.
    const remainder = segments.slice(1);
    const usesTokenObjectBase = typeof remainder[0] === 'string' && remainder[0].startsWith('$');
    const readsRawMetadata = usesTokenObjectBase && remainder[0] !== '$value';
    const requiresResolvedType =
      readsRawMetadata && remainder[0] === '$type' && rootToken.$type === undefined;
    const resolvedToken = usesTokenObjectBase
      ? readsRawMetadata && !requiresResolvedType
        ? tokens.get('')!
        : resolveToken('', tokens, rawRefs, rootTokenPaths, resolving, groups, completed)
      : resolveToken('', tokens, rawRefs, rootTokenPaths, resolving, groups, completed);
    const propertyValue =
      remainder[0] === '$ref'
        ? getByPath(rawRefs.get(''), remainder.slice(1))
        : getByPath(usesTokenObjectBase ? resolvedToken : resolvedToken.$value, remainder);
    if (propertyValue === undefined)
      issue(reference, 'reference target $root has no requested property');
    return clone(propertyValue);
  }
  for (let end = segments.length; end > 0; end -= 1) {
    const candidatePath = segments.slice(0, end).join('.');
    const token = tokens.get(candidatePath);
    const group = groups.get(candidatePath);
    if (!token && !group) continue;
    const propertySegments = segments.slice(end);
    if (
      reference.startsWith('#/') &&
      propertySegments.length === 0 &&
      group &&
      rootTokenPaths.has(candidatePath)
    )
      return issue(reference, `reference target ${candidatePath} must name $root explicitly`);
    // `$root`, when present AND `candidatePath` actually names a GROUP that
    // carries one (`rootTokenPaths.has(candidatePath)`) -- not merely an
    // ordinary token that happens to share that path -- is a REDIRECT to the
    // group's own root token, already what `resolvedToken` is in that case,
    // not an extra path level, so it is stripped before walking the
    // remainder. Without the `rootTokenPaths` check, `#/base/$root` where
    // `base` is an ordinary token with no `$root` member would silently
    // redirect to `base` itself instead of correctly failing -- the token
    // index has no other way to distinguish a group's redirected root token
    // from an ordinary token indexed at the same path. A remainder that is
    // empty after stripping it (a bare `#/group/$root` alias) names the root
    // token's whole identity and must extract `$value`, exactly like the
    // ordinary whole-token case just below it; only an explicit `$value`
    // segment walks the raw `DesignToken` object.
    const targetsRootToken =
      reference.startsWith('#/') &&
      propertySegments[0] === '$root' &&
      rootTokenPaths.has(candidatePath);
    const remainder = targetsRootToken ? propertySegments.slice(1) : propertySegments;
    if (targetsRootToken && remainder.length > 0 && !remainder[0]?.startsWith('$'))
      return issue(reference, `reference target ${candidatePath} has no requested property`);
    // A remainder starting with ANY of the token's own reserved `$`-prefixed
    // properties -- not just `$value` -- names something on the `DesignToken`
    // object itself: `#/base/$description`, `#/base/$deprecated`,
    // `#/base/$extensions/...` are all valid pointer targets alongside
    // `#/base/$value/...`. A resolved `$value` payload never itself carries a
    // `$`-prefixed key (DTCG values are plain objects, strings, numbers, or
    // arrays), so this discriminates cleanly without a fixed allowlist.
    const usesTokenObjectBase =
      reference.startsWith('#/') &&
      typeof remainder[0] === 'string' &&
      remainder[0].startsWith('$');
    const readsRawMetadata = usesTokenObjectBase && remainder[0] !== '$value';
    // `$ref` is unique among token metadata: `resolveToken` deletes it from
    // the token object once resolved (see `resolveRefToken`'s doc comment --
    // deliberate, so downstream consumers never see a leftover alias pointer
    // next to the value it named). A pointer that targets another alias
    // token's OWN `$ref` string (`#/alias/$ref`) must read the pre-resolution
    // snapshot (`rawRefs`) rather than the mutated `resolvedToken` -- and
    // rather than `token.$ref` itself, which may already have been deleted by
    // an EARLIER, unrelated resolution of the same path (see `RawRefs`'s doc
    // comment). Every other reserved property is untouched by resolution.
    const requiresResolvedType =
      readsRawMetadata &&
      remainder[0] === '$type' &&
      token?.$type === undefined &&
      (!group || targetsRootToken);
    const resolvedToken = token
      ? readsRawMetadata && !requiresResolvedType
        ? token
        : resolveToken(candidatePath, tokens, rawRefs, rootTokenPaths, resolving, groups, completed)
      : undefined;
    const metadataBase =
      readsRawMetadata && group && !targetsRootToken
        ? groupMetadataBase(group, candidatePath, groups)
        : (resolvedToken ?? group);
    const propertyValue =
      remainder[0] === '$ref'
        ? getByPath(rawRefs.get(candidatePath), remainder.slice(1))
        : getByPath(usesTokenObjectBase ? metadataBase : resolvedToken?.$value, remainder);
    if (propertyValue === undefined)
      issue(reference, `reference target ${candidatePath} has no requested property`);
    return clone(propertyValue);
  }
  return issue(reference, 'reference target does not exist');
}

export function resolveValue(
  value: unknown,
  tokens: ResolvedTokens,
  rawRefs: RawRefs,
  rootTokenPaths: Set<string>,
  resolving: Set<string>,
  groups: Map<string, TokenGroup>,
  completed: Set<string>,
): unknown {
  if (typeof value === 'string')
    return /^\{[^{}]+\}$/.test(value) || value.startsWith('#/')
      ? resolveReference(value, tokens, rawRefs, rootTokenPaths, resolving, groups, completed)
      : value;
  if (Array.isArray(value))
    return value.map((entry) =>
      resolveValue(entry, tokens, rawRefs, rootTokenPaths, resolving, groups, completed),
    );
  if (!isObject(value)) return value;
  const resolved: JsonObject = Object.create(null);
  for (const [key, entry] of Object.entries(value))
    resolved[key] = resolveValue(
      entry,
      tokens,
      rawRefs,
      rootTokenPaths,
      resolving,
      groups,
      completed,
    );
  return resolved;
}

/**
 * Resolves a `$ref` token -- a whole-token DTCG 2025.10 alias, distinct from
 * a `{a.b.c}`/`#/a/b/c` reference embedded IN a `$value`. Reuses
 * `resolveReference` (the same machinery an ordinary alias `$value` goes
 * through) rather than a separate path walk, so chained aliases and
 * property-level pointers (`#/base/$value/blur`) work identically for both
 * forms, and so `resolving` cycle detection is shared: a `$ref` chain that
 * loops back on itself trips the same "circular token alias" guard
 * `resolveToken` already applies before this runs.
 *
 * `$type` precedence for a `$ref` token: its own declared `$type` (validated
 * only for known-type membership in `validate.ts`, never required) wins;
 * failing that, the type already inherited from its enclosing group -- set
 * by `withResolvedType` before `resolveToken` is ever called -- wins;
 * failing THAT, the whole-token alias target's resolved `$type` is copied in
 * here. A property-level `$ref` has no whole-token target to borrow a type
 * from, so `$type` is left however it was (possibly still undefined), and
 * `validateResolvedToken` is what reports a genuinely untyped resolved
 * token, the same way it already does for an untyped ordinary token.
 *
 * The `$ref` key is deleted once resolved: a fully resolved `DesignToken` is
 * expected to carry `$value` alone (mirroring the `$value`/`$ref` mutual
 * exclusivity `validate.ts` enforces on the raw document), and downstream
 * consumers of `resolveDocuments`'s output should never have to check for a
 * leftover alias pointer next to the value it named.
 */
/**
 * The `tokens` index key a whole-token reference ultimately names, for type
 * inference below -- distinct from `tokenPathFromReference`'s plain dotted
 * join, which treats trailing `$value`/`$root` segments as ordinary path
 * levels. A group's root token is indexed under the GROUP's own path
 * (`collectTokens` sets it at `prefix`, not `prefix.$root`), so
 * `#/group/$root` and `#/$root` need their `$root` segment stripped before
 * the `tokens.get` lookup, or it misses -- the same redirect
 * `resolveReference`'s loop applies to `targetsRootToken` above, factored out
 * here since type inference needs only the final indexed path, not a
 * resolved value. A trailing `$value` segment (`#/base/$value`,
 * `#/group/$root/$value`, `#/$root/$value`) names the token's WHOLE value,
 * not a nested property, and must be stripped FIRST -- otherwise
 * `#/group/$root/$value` dot-joins to `group.$root.$value`, which ends in
 * neither `$root` nor a bare `$root`, and the redirect below never fires.
 */
export function refTargetIndexPath(reference: string): string {
  let path = tokenPathFromReference(reference);
  if (!reference.startsWith('#/')) return path;
  if (path.endsWith('.$value')) path = path.slice(0, -'.$value'.length);
  if (path === '$root') return '';
  return path.endsWith('.$root') ? path.slice(0, -'.$root'.length) : path;
}

export function resolveRefToken(
  path: string,
  token: DesignToken,
  tokens: ResolvedTokens,
  rawRefs: RawRefs,
  rootTokenPaths: Set<string>,
  resolving: Set<string>,
  groups: Map<string, TokenGroup>,
  completed: Set<string>,
): void {
  const ref = token.$ref;
  if (typeof ref !== 'string') return issue(path, '$ref must be a string');
  try {
    token.$value = resolveReference(
      ref,
      tokens,
      rawRefs,
      rootTokenPaths,
      resolving,
      groups,
      completed,
    );
  } catch (error) {
    if (error instanceof TokenValidationError)
      return issue(
        path,
        `unresolvable $ref "${ref}": ${error.issues.map((tokenIssue) => tokenIssue.reason).join('; ')}`,
      );
    throw error;
  }
  if (token.$type === undefined) {
    const targetToken = tokens.get(refTargetIndexPath(ref));
    if (targetToken?.$type !== undefined) token.$type = targetToken.$type;
  }
  delete token.$ref;
}

export function resolveToken(
  path: string,
  tokens: ResolvedTokens,
  rawRefs: RawRefs,
  rootTokenPaths: Set<string>,
  resolving: Set<string>,
  groups: Map<string, TokenGroup>,
  completed: Set<string>,
): DesignToken {
  const token = tokens.get(path);
  if (!token) return issue(path, 'token does not exist');
  if (completed.has(path)) return token;
  if (resolving.has(path)) return issue(path, 'circular token alias');
  // Validation (`assertValidTokenDocument`) is what enforces `$value`/`$ref`
  // mutual exclusivity on the raw document; this is a resolve-time backstop
  // for a caller that reaches `resolveDocuments`/`createValueResolver`
  // without validating first (there is no such caller in this repo today --
  // every entry point runs validation first -- but nothing in the type
  // system enforces that, and a token carrying both keys would otherwise
  // silently prefer `$ref` and drop `$value` with no diagnostic). Named
  // explicitly rather than left as an implicit precondition.
  if (token.$ref !== undefined && token.$value !== undefined)
    return issue(path, '$value and $ref are mutually exclusive on a resolved token');
  resolving.add(path);
  if (token.$ref !== undefined)
    resolveRefToken(path, token, tokens, rawRefs, rootTokenPaths, resolving, groups, completed);
  else
    token.$value = resolveValue(
      token.$value,
      tokens,
      rawRefs,
      rootTokenPaths,
      resolving,
      groups,
      completed,
    );
  resolving.delete(path);
  completed.add(path);
  return token;
}
