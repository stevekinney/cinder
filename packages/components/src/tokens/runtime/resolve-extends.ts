import {
  clone,
  collectGroups,
  extensionIssue,
  type ExtensionOrigins,
  issue,
  isTokenGroup,
  tokenPathFromReference,
} from './resolve-shared.ts';
import type { TokenGroup } from './types.ts';
import { TokenValidationError } from './types.ts';

export function inheritMissingGroupMembers(
  target: TokenGroup,
  source: TokenGroup,
  extensionOrigins?: ExtensionOrigins,
): void {
  for (const [name, value] of Object.entries(source)) {
    const existing = target[name];
    if (isTokenGroup(existing) && isTokenGroup(value))
      inheritMissingGroupMembers(existing, value, extensionOrigins);
    else if (!Object.hasOwn(target, name)) {
      Object.defineProperty(target, name, {
        configurable: true,
        enumerable: true,
        value: clone(value, extensionOrigins),
        writable: true,
      });
      if (name === '$extends') {
        const origin = extensionOrigins?.get(source);
        if (origin) extensionOrigins?.set(target, origin);
      }
    }
  }
}

/**
 * The `$deprecated` a group at `groupPath` carries EFFECTIVELY, once ordinary
 * (non-`$extends`) ancestor nesting is taken into account -- the nearest of
 * the group itself, its parent, its grandparent, and so on that declares
 * `$deprecated` directly. `groups` is keyed by the RAW merged tree
 * (`collectGroups`, run before any `$extends` expansion), so this reads each
 * candidate's own declared value only; it does not itself resolve a further
 * `$extends` chain on an ancestor (a deeper edge case -- an ancestor that is
 * itself only deprecated via its OWN `$extends` -- outside what this helper
 * addresses).
 *
 * `resolveExtends` needs this rather than a plain `extended.$deprecated`
 * property read: `generate.ts`'s `collectEntries` propagates `$deprecated`
 * down through ordinary group nesting at CSS/registry generation time, well
 * after `$extends` has already run here, so a group that inherits
 * `$deprecated` only from an ANCESTOR (never declaring it directly itself)
 * still reads `undefined` at this point unless this helper walks up for it.
 * Without it, `derived: { $extends: '{outer.base}' }` under a deprecated
 * `outer` (with `outer.base` itself never declaring `$deprecated`) copied no
 * deprecation onto `derived` at all, even though every token under
 * `outer.base` is itself effectively deprecated by the time generation walks
 * it.
 */
export function effectiveGroupDeprecated(
  groupPath: string,
  groups: Map<string, TokenGroup>,
): TokenGroup['$deprecated'] {
  const segments = groupPath === '' ? [] : groupPath.split('.');
  for (let end = segments.length; end >= 0; end -= 1) {
    const candidate = groups.get(segments.slice(0, end).join('.'));
    if (candidate?.$deprecated !== undefined) return candidate.$deprecated;
  }
  return undefined;
}

export function effectiveGroupType(
  groupPath: string,
  groups: Map<string, TokenGroup>,
): TokenGroup['$type'] {
  const segments = groupPath === '' ? [] : groupPath.split('.');
  for (let end = segments.length; end >= 0; end -= 1) {
    const candidate = groups.get(segments.slice(0, end).join('.'));
    if (candidate?.$type !== undefined) return candidate.$type;
  }
  return undefined;
}

export function groupMetadataBase(
  group: TokenGroup,
  groupPath: string,
  groups: Map<string, TokenGroup>,
): TokenGroup {
  const type = group.$type ?? effectiveGroupType(groupPath, groups);
  const deprecated =
    group.$deprecated === undefined
      ? effectiveGroupDeprecated(groupPath, groups)
      : group.$deprecated;
  if (type === undefined && deprecated === undefined) return group;
  return {
    ...group,
    ...(type === undefined ? {} : { $type: type }),
    ...(deprecated === undefined ? {} : { $deprecated: deprecated }),
  };
}

export function resolveExtends(
  groupPath: string,
  groups: Map<string, TokenGroup>,
  visiting: Set<string>,
  complete: Set<string>,
  lookupGroups: Map<string, TokenGroup> = groups,
  extensionOrigins?: ExtensionOrigins,
): TokenGroup {
  const group = groups.get(groupPath);
  if (!group) return issue(groupPath, '$extends must reference an existing group');
  if (complete.has(groupPath)) return group;
  if (visiting.has(groupPath))
    return extensionIssue(groupPath, 'circular $extends reference', group, extensionOrigins);
  visiting.add(groupPath);
  if (group.$extends) {
    let extendedPath: string;
    try {
      extendedPath = tokenPathFromReference(group.$extends);
    } catch (error) {
      if (error instanceof TokenValidationError && extensionOrigins?.has(group))
        return extensionIssue(
          groupPath,
          error.issues.map((entry) => entry.reason).join('; '),
          group,
          extensionOrigins,
        );
      throw error;
    }
    if (!groups.has(extendedPath)) {
      return extensionIssue(
        extendedPath,
        '$extends must reference an existing group',
        group,
        extensionOrigins,
      );
    }
    if (visiting.has(extendedPath)) {
      return extensionIssue(extendedPath, 'circular $extends reference', group, extensionOrigins);
    }
    const extended = resolveExtends(
      extendedPath,
      groups,
      visiting,
      complete,
      lookupGroups,
      extensionOrigins,
    );
    if (group.$type === undefined && extended.$type !== undefined) group.$type = extended.$type;
    // `$deprecated: false` is a real, meaningful value (it un-deprecates a
    // subtree under a deprecated ancestor) rather than an absence, so this
    // must check `=== undefined` and assign directly -- the same `??`-not-`||`
    // rule `generate.ts`'s `collectEntries` already applies for ordinary
    // group nesting (see CIN-471). Nested extended groups already inherit
    // `$deprecated` through `inheritMissingGroupMembers`'s unfiltered member
    // copy below; this closes the top-level gap, where the extending group's
    // OWN `$deprecated` was previously left untouched even when the group it
    // extends was itself deprecated -- including when the extended group's
    // `$deprecated` is itself only inherited from ITS OWN ancestor rather
    // than declared directly (`effectiveGroupDeprecated`, not a bare property
    // read).
    // Resolve any ancestor `$extends` chains before reading their effective
    // deprecation. This makes inheritance independent of declaration order.
    const ancestors = extendedPath ? extendedPath.split('.') : [];
    for (let end = ancestors.length; end >= 0; end -= 1) {
      const ancestorPath = ancestors.slice(0, end).join('.');
      if (groups.get(ancestorPath)?.$extends)
        resolveExtends(ancestorPath, groups, visiting, complete, lookupGroups, extensionOrigins);
      if (lookupGroups.get(ancestorPath)?.$extends)
        resolveExtends(
          ancestorPath,
          lookupGroups,
          new Set(),
          new Set(),
          lookupGroups,
          extensionOrigins,
        );
    }
    const effectiveExtendedDeprecated =
      effectiveGroupDeprecated(extendedPath, groups) ??
      effectiveGroupDeprecated(extendedPath, lookupGroups);
    if (group.$deprecated === undefined && effectiveExtendedDeprecated !== undefined)
      group.$deprecated = effectiveExtendedDeprecated;
    for (const [name, value] of Object.entries(extended))
      if (!name.startsWith('$') || name === '$root') {
        const existing = group[name];
        if (isTokenGroup(existing) && isTokenGroup(value))
          inheritMissingGroupMembers(existing, value, extensionOrigins);
        else if (!Object.hasOwn(group, name))
          Object.defineProperty(group, name, {
            configurable: true,
            enumerable: true,
            value: clone(value, extensionOrigins),
            writable: true,
          });
      }
    // `$extends` may add a group that an ordinary nested wrapper references.
    // Register the expanded tree before traversing those wrappers so their
    // targets are visible to the same path index used by resolveExtends.
    collectGroups(group, groupPath, groups);
  }
  for (const [name, value] of Object.entries(group)) {
    if (name.startsWith('$') || !isTokenGroup(value)) continue;
    const nestedPath = groupPath ? `${groupPath}.${name}` : name;
    if (groups.get(nestedPath)?.$extends)
      resolveExtends(nestedPath, groups, visiting, complete, lookupGroups, extensionOrigins);
  }
  visiting.delete(groupPath);
  complete.add(groupPath);
  return group;
}
