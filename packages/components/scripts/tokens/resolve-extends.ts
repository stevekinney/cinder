import {
  clone,
  isObject,
  isToken,
  isTokenGroup,
  mergeDocuments,
  type ExtensionOrigins,
} from './resolve-merge.ts';
import { addTraceDependency, type ResolverSourceLocation, type TraceState } from './trace.ts';
import {
  TOKEN_TYPES,
  TokenValidationError,
  type DesignToken,
  type TokenDocument,
  type TokenGroup,
} from './types.ts';

type ResolvedTokens = Map<string, DesignToken>;

export function issue(path: string, reason: string): never {
  throw new TokenValidationError([{ path, reason }]);
}
export function pointerSegments(reference: string): string[] {
  if (!reference.startsWith('#/')) return [];
  let fragment: string;
  try {
    fragment = decodeURIComponent(reference.slice(2));
  } catch {
    return issue(reference, 'JSON Pointer contains invalid percent encoding');
  }
  return fragment.split('/').map((segment) => {
    if (/~(?:[^01]|$)/.test(segment))
      issue(reference, 'JSON Pointer contains invalid tilde escape');
    return segment.replaceAll('~1', '/').replaceAll('~0', '~');
  });
}
export function tokenPathFromReference(reference: string): string {
  if (/^\{[^{}]+\}$/.test(reference)) return reference.slice(1, -1);
  if (reference === '#/') return issue(reference, 'reference target does not exist');
  if (reference.startsWith('#/')) return pointerSegments(reference).join('.');
  return issue(reference, 'reference must use curly-brace or JSON Pointer syntax');
}
export function getByPath(value: unknown, segments: string[]): unknown {
  let current = value;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      if (!/^(0|[1-9][0-9]*)$/.test(segment)) return undefined;
      current = current[Number(segment)];
    } else if (isObject(current)) current = current[segment];
    else return undefined;
  }
  return current;
}
export function collectGroups(
  group: TokenGroup,
  prefix: string,
  groups: Map<string, TokenGroup>,
): void {
  groups.set(prefix, group);
  for (const [name, value] of Object.entries(group)) {
    if (name.startsWith('$') || !isObject(value)) continue;
    const path = prefix ? `${prefix}.${name}` : name;
    if (isTokenGroup(value)) collectGroups(value, path, groups);
  }
}
export function collectExtensionOrigins(
  group: TokenGroup,
  prefix: string,
  source: string | undefined,
  origins: ExtensionOrigins,
): void {
  if (source !== undefined && typeof group.$extends === 'string')
    origins.set(group, { source, path: prefix });
  for (const [name, value] of Object.entries(group)) {
    if (name.startsWith('$') || !isObject(value) || !isTokenGroup(value)) continue;
    collectExtensionOrigins(value, prefix ? `${prefix}.${name}` : name, source, origins);
  }
}
function extensionIssue(
  groupPath: string,
  reason: string,
  group: TokenGroup,
  origins?: ExtensionOrigins,
): never {
  const origin = origins?.get(group);
  throw new TokenValidationError(
    [
      {
        path: origin
          ? `${origin.source}${origin.path ? `.${origin.path}` : ''}.$extends`
          : groupPath,
        reason,
      },
    ],
    origin !== undefined,
  );
}
function effective(
  groupPath: string,
  groups: Map<string, TokenGroup>,
  key: '$type' | '$deprecated',
): unknown {
  const segments = groupPath ? groupPath.split('.') : [];
  for (let end = segments.length; end >= 0; end -= 1) {
    const value = groups.get(segments.slice(0, end).join('.'))?.[key];
    if (value !== undefined) return value;
  }
  return undefined;
}
function tokenType(value: unknown): TokenGroup['$type'] | undefined {
  if (typeof value !== 'string') return undefined;
  return TOKEN_TYPES.find((candidate) => candidate === value);
}
function deprecatedValue(value: unknown): TokenGroup['$deprecated'] | undefined {
  return typeof value === 'boolean' || typeof value === 'string' ? value : undefined;
}
function groupMetadataBase(
  group: TokenGroup,
  path: string,
  groups: Map<string, TokenGroup>,
): TokenGroup {
  const type = group.$type ?? tokenType(effective(path, groups, '$type'));
  const deprecated =
    group.$deprecated === undefined
      ? deprecatedValue(effective(path, groups, '$deprecated'))
      : group.$deprecated;
  if (type === undefined && deprecated === undefined) return group;
  return {
    ...group,
    ...(type === undefined ? {} : { $type: type }),
    ...(deprecated === undefined ? {} : { $deprecated: deprecated }),
  };
}
export function withResolvedType(
  token: DesignToken,
  inheritedType?: DesignToken['$type'],
  traceState?: TraceState,
  inheritedTypeOrigin?: ResolverSourceLocation | null,
): DesignToken {
  const resolved = clone(token, undefined, traceState);
  if (traceState) {
    const metadata = traceState.nodes.get(resolved);
    if (metadata && token.$type === undefined)
      traceState.nodes.set(resolved, { ...metadata, typeOrigin: inheritedTypeOrigin ?? null });
  }
  const type = resolved.$type ?? inheritedType;
  if (type) resolved.$type = type;
  return resolved;
}
export function collectTokens(
  group: TokenGroup,
  prefix: string,
  tokens: ResolvedTokens,
  roots: Set<string>,
  inheritedType?: DesignToken['$type'],
  traceState?: TraceState,
  inheritedTypeOrigin: ResolverSourceLocation | null = null,
): void {
  const groupTypeOrigin = traceState?.groupTypes.get(group) ?? inheritedTypeOrigin;
  if (group.$root) {
    tokens.set(
      prefix,
      withResolvedType(group.$root, group.$type ?? inheritedType, traceState, groupTypeOrigin),
    );
    roots.add(prefix);
  }
  for (const [name, value] of Object.entries(group)) {
    if (name.startsWith('$') || !isObject(value)) continue;
    const path = prefix ? `${prefix}.${name}` : name;
    if (isToken(value))
      tokens.set(
        path,
        withResolvedType(value, group.$type ?? inheritedType, traceState, groupTypeOrigin),
      );
    else if (isTokenGroup(value))
      collectTokens(
        value,
        path,
        tokens,
        roots,
        group.$type ?? inheritedType,
        traceState,
        groupTypeOrigin,
      );
  }
}
function inheritMissingGroupMembers(
  target: TokenGroup,
  source: TokenGroup,
  origins?: ExtensionOrigins,
  traceState?: TraceState,
  dependency?: { source: ResolverSourceLocation; targetPath: string },
): void {
  for (const [name, value] of Object.entries(source)) {
    const existing = target[name];
    if (isTokenGroup(existing) && isTokenGroup(value))
      inheritMissingGroupMembers(
        existing,
        value,
        origins,
        traceState,
        dependency
          ? {
              source: dependency.source,
              targetPath:
                name === '$root' ? dependency.targetPath : `${dependency.targetPath}.${name}`,
            }
          : undefined,
      );
    else if (!Object.hasOwn(target, name)) {
      Object.defineProperty(target, name, {
        configurable: true,
        enumerable: true,
        value: clone(value, origins, traceState),
        writable: true,
      });
      if (traceState && dependency && isToken(value)) {
        const metadata = isObject(target[name]) ? traceState.nodes.get(target[name]) : undefined;
        if (metadata) {
          metadata.dependencies = [];
          addTraceDependency(metadata, {
            kind: 'extends',
            source: dependency.source,
            targetPath:
              name === '$root' ? dependency.targetPath : `${dependency.targetPath}.${name}`,
            target: metadata.location,
          });
        }
      }
      if (traceState && dependency && isTokenGroup(value) && isTokenGroup(target[name])) {
        addCopiedGroupDependencies(
          target[name],
          value,
          {
            source: dependency.source,
            targetPath: `${dependency.targetPath}.${name}`,
          },
          traceState,
        );
      }
      if (name === '$extends' && origins) {
        const origin = origins.get(source);
        if (origin) origins.set(target, origin);
      }
    }
  }
}

function addCopiedGroupDependencies(
  target: TokenGroup,
  source: TokenGroup,
  dependency: { source: ResolverSourceLocation; targetPath: string },
  traceState: TraceState,
): void {
  for (const [name, value] of Object.entries(source)) {
    if (name.startsWith('$') && name !== '$root') continue;
    const copied = target[name];
    if (isTokenGroup(value) && isTokenGroup(copied)) {
      addCopiedGroupDependencies(
        copied,
        value,
        {
          source: dependency.source,
          targetPath: name === '$root' ? dependency.targetPath : `${dependency.targetPath}.${name}`,
        },
        traceState,
      );
      continue;
    }
    if (!isToken(value) || !isObject(copied)) continue;
    const metadata = traceState.nodes.get(copied);
    if (!metadata) continue;
    metadata.dependencies = [];
    addTraceDependency(metadata, {
      kind: 'extends',
      source: dependency.source,
      targetPath: name === '$root' ? dependency.targetPath : `${dependency.targetPath}.${name}`,
      target: metadata.location,
    });
  }
}
function resolveExtends(
  groupPath: string,
  groups: Map<string, TokenGroup>,
  visiting: Set<string>,
  complete: Set<string>,
  lookup: Map<string, TokenGroup>,
  origins?: ExtensionOrigins,
  traceState?: TraceState,
): TokenGroup {
  const group = groups.get(groupPath);
  if (!group) return issue(groupPath, '$extends must reference an existing group');
  if (complete.has(groupPath)) return group;
  if (visiting.has(groupPath))
    return extensionIssue(groupPath, 'circular $extends reference', group, origins);
  visiting.add(groupPath);
  if (group.$extends) {
    let extendedPath: string;
    try {
      extendedPath = tokenPathFromReference(group.$extends);
    } catch (error) {
      if (error instanceof TokenValidationError && origins?.has(group))
        return extensionIssue(
          groupPath,
          error.issues.map((entry) => entry.reason).join('; '),
          group,
          origins,
        );
      throw error;
    }
    if (!groups.has(extendedPath))
      return extensionIssue(
        extendedPath,
        '$extends must reference an existing group',
        group,
        origins,
      );
    if (visiting.has(extendedPath))
      return extensionIssue(extendedPath, 'circular $extends reference', group, origins);
    const extended = resolveExtends(
      extendedPath,
      groups,
      visiting,
      complete,
      lookup,
      origins,
      traceState,
    );
    if (group.$type === undefined && extended.$type !== undefined) {
      group.$type = extended.$type;
      const origin = traceState?.groupTypes.get(extended);
      if (origin) traceState?.groupTypes.set(group, origin);
    }
    const ancestors = extendedPath ? extendedPath.split('.') : [];
    for (let end = ancestors.length; end >= 0; end -= 1) {
      const ancestorPath = ancestors.slice(0, end).join('.');
      if (groups.get(ancestorPath)?.$extends)
        resolveExtends(ancestorPath, groups, visiting, complete, lookup, origins, traceState);
      if (lookup !== groups && lookup.get(ancestorPath)?.$extends)
        resolveExtends(ancestorPath, lookup, new Set(), new Set(), lookup, origins, traceState);
    }
    if (group.$deprecated === undefined) {
      const deprecated = deprecatedValue(
        effective(extendedPath, groups, '$deprecated') ??
          effective(extendedPath, lookup, '$deprecated'),
      );
      if (deprecated !== undefined) group.$deprecated = deprecated;
    }
    for (const [name, value] of Object.entries(extended))
      if (!name.startsWith('$') || name === '$root') {
        const existing = group[name];
        if (isTokenGroup(existing) && isTokenGroup(value))
          inheritMissingGroupMembers(
            existing,
            value,
            origins,
            traceState,
            traceState?.groups.get(group)
              ? {
                  source: traceState.groups.get(group)!,
                  targetPath:
                    name === '$root'
                      ? extendedPath
                      : extendedPath
                        ? `${extendedPath}.${name}`
                        : name,
                }
              : undefined,
          );
        else if (!Object.hasOwn(group, name)) {
          const copied = clone(value, origins, traceState);
          group[name] = copied;
          const extensionLocation = traceState?.groups.get(group);
          const metadata = isObject(copied) ? traceState?.nodes.get(copied) : undefined;
          if (extensionLocation && traceState && isTokenGroup(value) && isTokenGroup(copied))
            addCopiedGroupDependencies(
              copied,
              value,
              {
                source: extensionLocation,
                targetPath:
                  name === '$root' ? extendedPath : extendedPath ? `${extendedPath}.${name}` : name,
              },
              traceState,
            );
          if (extensionLocation && metadata && isToken(value)) {
            metadata.dependencies = [];
            addTraceDependency(metadata, {
              kind: 'extends',
              source: extensionLocation,
              targetPath:
                name === '$root' ? extendedPath : extendedPath ? `${extendedPath}.${name}` : name,
              target: metadata.location,
            });
          }
        }
      }
    collectGroups(group, groupPath, groups);
  }
  for (const [name, value] of Object.entries(group))
    if (!name.startsWith('$') && isTokenGroup(value)) {
      const nested = groupPath ? `${groupPath}.${name}` : name;
      if (groups.get(nested)?.$extends)
        resolveExtends(nested, groups, visiting, complete, lookup, origins, traceState);
    }
  visiting.delete(groupPath);
  complete.add(groupPath);
  return group;
}
export function mergeAndExpandExtends(
  documents: TokenDocument[],
  lookupDocuments: TokenDocument[] = documents,
  sourceByDocument?: ReadonlyMap<object, string>,
  traceState?: TraceState,
): TokenDocument {
  const origins = sourceByDocument
    ? new WeakMap<object, { source: string; path: string }>()
    : undefined;
  if (origins)
    for (const document of new Set([...lookupDocuments, ...documents]))
      collectExtensionOrigins(document, '', sourceByDocument?.get(document), origins);
  const merged = mergeDocuments(documents, origins, traceState);
  const groups = new Map<string, TokenGroup>();
  const own = new Map<string, TokenGroup>();
  const lookup = new Map<string, TokenGroup>();
  if (lookupDocuments !== documents) {
    const lookupMerged = mergeDocuments(lookupDocuments, origins, traceState);
    collectGroups(lookupMerged, '', lookup);
    for (const entry of lookup) groups.set(...entry);
  }
  collectGroups(merged, '', own);
  for (const entry of own) groups.set(...entry);
  for (const path of own.keys())
    resolveExtends(
      path,
      groups,
      new Set(),
      new Set(),
      lookupDocuments === documents ? groups : lookup,
      origins,
      traceState,
    );
  return merged;
}
export { groupMetadataBase };
