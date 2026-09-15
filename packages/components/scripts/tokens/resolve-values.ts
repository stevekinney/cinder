import { getByPath, groupMetadataBase, issue, pointerSegments } from './resolve-extends.ts';
import { clone, isObject, type JsonObject } from './resolve-merge.ts';
import { addTraceDependency, type ResolverSourceLocation, type TraceState } from './trace.ts';
import type { DesignToken, TokenGroup } from './types.ts';
import { TokenValidationError } from './types.ts';

type ResolvedTokens = Map<string, DesignToken>;
type RawRefs = Map<string, string>;
type ReferenceTarget = {
  path: string;
  token?: DesignToken;
  location?: ResolverSourceLocation;
  wholeValue: boolean;
};
type ReferenceCapture = { target?: ReferenceTarget };

export function valueDependency(
  source: import('./trace.ts').ResolverSourceLocation,
  targetPath: string,
  target?: import('./trace.ts').ResolverSourceLocation,
  kind: 'alias' | 'reference' = 'alias',
) {
  return { kind, source, targetPath, ...(target ? { target } : {}) } as const;
}
function captureTarget(
  capture: ReferenceCapture | undefined,
  path: string,
  token: DesignToken | undefined,
  group: TokenGroup | undefined,
  traceState: TraceState | undefined,
  wholeValue: boolean,
): void {
  if (!capture) return;
  const location = token
    ? traceState?.nodes.get(token)?.location
    : group
      ? (traceState?.groups.get(group) ?? traceState?.groupTypes.get(group))
      : undefined;
  capture.target = {
    path,
    ...(token ? { token } : {}),
    wholeValue,
    ...(location ? { location } : {}),
  };
}
export function resolveReference(
  reference: string,
  tokens: ResolvedTokens,
  rawRefs: RawRefs,
  roots: Set<string>,
  resolving: Set<string>,
  groups: Map<string, TokenGroup>,
  completed: Set<string>,
  traceState?: TraceState,
  capture?: ReferenceCapture,
): unknown {
  if (reference === '#/') return issue(reference, 'reference target does not exist');
  const segments = reference.startsWith('#/')
    ? pointerSegments(reference)
    : reference.slice(1, -1).split('.');
  const documentGroup = groups.get('');
  if (
    reference.startsWith('#/') &&
    documentGroup &&
    segments[0]?.startsWith('$') &&
    segments[0] !== '$root' &&
    segments[0] !== '$value'
  ) {
    const property = getByPath(documentGroup, segments);
    if (property === undefined)
      issue(reference, 'reference target document group has no requested property');
    captureTarget(capture, '', undefined, documentGroup, traceState, false);
    return clone(property);
  }
  if (reference.startsWith('#/') && segments[0] === '$root') {
    const root = tokens.get('');
    if (!root) return issue(reference, 'reference target does not exist');
    const remainder = segments.slice(1);
    const objectBase = remainder[0]?.startsWith('$');
    const resolved = resolveToken(
      '',
      tokens,
      rawRefs,
      roots,
      resolving,
      groups,
      completed,
      traceState,
    );
    const property =
      remainder[0] === '$ref'
        ? getByPath(rawRefs.get(''), remainder.slice(1))
        : getByPath(objectBase ? resolved : resolved.$value, remainder);
    if (property === undefined)
      issue(reference, 'reference target $root has no requested property');
    captureTarget(
      capture,
      '',
      root,
      undefined,
      traceState,
      remainder.length === 0 || remainder[0] === '$value',
    );
    return clone(property);
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
      roots.has(candidatePath)
    )
      return issue(reference, `reference target ${candidatePath} must name $root explicitly`);
    const targetRoot =
      reference.startsWith('#/') && propertySegments[0] === '$root' && roots.has(candidatePath);
    const remainder = targetRoot ? propertySegments.slice(1) : propertySegments;
    if (targetRoot && remainder.length > 0 && !remainder[0]?.startsWith('$'))
      return issue(reference, `reference target ${candidatePath} has no requested property`);
    const objectBase = reference.startsWith('#/') && remainder[0]?.startsWith('$');
    const readsRaw = objectBase && remainder[0] !== '$value';
    const needsType =
      readsRaw && remainder[0] === '$type' && token?.$type === undefined && (!group || targetRoot);
    const resolved = token
      ? readsRaw && !needsType
        ? token
        : resolveToken(
            candidatePath,
            tokens,
            rawRefs,
            roots,
            resolving,
            groups,
            completed,
            traceState,
          )
      : undefined;
    const base =
      readsRaw && group && !targetRoot
        ? groupMetadataBase(group, candidatePath, groups)
        : (resolved ?? group);
    const property =
      remainder[0] === '$ref'
        ? getByPath(rawRefs.get(candidatePath), remainder.slice(1))
        : getByPath(objectBase ? base : resolved?.$value, remainder);
    if (property === undefined)
      issue(reference, `reference target ${candidatePath} has no requested property`);
    captureTarget(
      capture,
      candidatePath,
      token,
      group,
      traceState,
      !reference.startsWith('#/') ||
        remainder.length === 0 ||
        (remainder.length === 1 && remainder[0] === '$value'),
    );
    return clone(property);
  }
  return issue(reference, 'reference target does not exist');
}
export function resolveValue(
  value: unknown,
  tokens: ResolvedTokens,
  rawRefs: RawRefs,
  roots: Set<string>,
  resolving: Set<string>,
  groups: Map<string, TokenGroup>,
  completed: Set<string>,
  traceState?: TraceState,
  tracePath?: string,
  tracePointer?: string,
): unknown {
  if (typeof value === 'string') {
    if (!/^\{[^{}]+\}$/.test(value) && !value.startsWith('#/')) return value;
    const capture: ReferenceCapture = {};
    const resolved = resolveReference(
      value,
      tokens,
      rawRefs,
      roots,
      resolving,
      groups,
      completed,
      traceState,
      capture,
    );
    if (traceState && tracePath !== undefined && tracePointer) {
      const metadata = traceState.nodes.get(tokens.get(tracePath) ?? {});
      if (metadata) {
        const targetPath = capture.target?.path ?? '';
        addTraceDependency(
          metadata,
          valueDependency(
            { ...metadata.location, sourcePointer: tracePointer },
            targetPath,
            capture.target?.location,
            value.startsWith('#/') ? 'reference' : 'alias',
          ),
        );
      }
    }
    return resolved;
  }
  if (Array.isArray(value))
    return value.map((entry, index) =>
      resolveValue(
        entry,
        tokens,
        rawRefs,
        roots,
        resolving,
        groups,
        completed,
        traceState,
        tracePath,
        tracePointer ? `${tracePointer}/${index}` : undefined,
      ),
    );
  if (!isObject(value)) return value;
  const resolved: JsonObject = Object.create(null);
  for (const [key, entry] of Object.entries(value))
    resolved[key] = resolveValue(
      entry,
      tokens,
      rawRefs,
      roots,
      resolving,
      groups,
      completed,
      traceState,
      tracePath,
      tracePointer
        ? `${tracePointer}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`
        : undefined,
    );
  return resolved;
}
export function resolveRefToken(
  path: string,
  token: DesignToken,
  tokens: ResolvedTokens,
  rawRefs: RawRefs,
  roots: Set<string>,
  resolving: Set<string>,
  groups: Map<string, TokenGroup>,
  completed: Set<string>,
  traceState?: TraceState,
): void {
  const ref = token.$ref;
  if (typeof ref !== 'string') return issue(path, '$ref must be a string');
  const capture: ReferenceCapture = {};
  try {
    token.$value = resolveReference(
      ref,
      tokens,
      rawRefs,
      roots,
      resolving,
      groups,
      completed,
      traceState,
      capture,
    );
  } catch (error) {
    if (error instanceof TokenValidationError)
      return issue(
        path,
        `unresolvable $ref "${ref}": ${error.issues.map((entry) => entry.reason).join('; ')}`,
      );
    throw error;
  }
  if (token.$type === undefined) {
    const target = capture.target?.token;
    if (capture.target?.wholeValue && target?.$type !== undefined) token.$type = target.$type;
  }
  if (traceState) {
    const metadata = traceState.nodes.get(token);
    if (metadata) {
      const targetPath = capture.target?.path ?? '';
      addTraceDependency(
        metadata,
        valueDependency(
          { ...metadata.location, sourcePointer: `${metadata.location.sourcePointer}/$ref` },
          targetPath,
          capture.target?.location,
          'reference',
        ),
      );
      const targetMetadata = capture.target?.token
        ? traceState.nodes.get(capture.target.token)
        : undefined;
      if (capture.target?.wholeValue && metadata.typeOrigin === null && targetMetadata?.typeOrigin)
        metadata.typeOrigin = { ...targetMetadata.typeOrigin };
    }
  }
  delete token.$ref;
}
export function resolveToken(
  path: string,
  tokens: ResolvedTokens,
  rawRefs: RawRefs,
  roots: Set<string>,
  resolving: Set<string>,
  groups: Map<string, TokenGroup>,
  completed: Set<string>,
  traceState?: TraceState,
): DesignToken {
  const token = tokens.get(path);
  if (!token) return issue(path, 'token does not exist');
  if (completed.has(path)) return token;
  if (resolving.has(path)) return issue(path, 'circular token alias');
  if (token.$ref !== undefined && token.$value !== undefined)
    return issue(path, '$value and $ref are mutually exclusive on a resolved token');
  resolving.add(path);
  if (token.$ref !== undefined)
    resolveRefToken(path, token, tokens, rawRefs, roots, resolving, groups, completed, traceState);
  else
    token.$value = resolveValue(
      token.$value,
      tokens,
      rawRefs,
      roots,
      resolving,
      groups,
      completed,
      traceState,
      path,
      traceState?.nodes.get(token)?.location.sourcePointer + '/$value',
    );
  resolving.delete(path);
  completed.add(path);
  return token;
}
