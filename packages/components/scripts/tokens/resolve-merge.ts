import { cloneTraceMetadata, type TraceMetadata, type TraceState } from './trace.ts';
import type { DesignToken, TokenDocument, TokenExtensions, TokenGroup } from './types.ts';

export type JsonObject = Record<string, unknown>;
export type ExtensionOrigin = { source: string; path: string };
export type ExtensionOrigins = WeakMap<object, ExtensionOrigin>;

export function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function isToken(value: unknown): value is DesignToken {
  return isObject(value) && ('$value' in value || '$ref' in value);
}
export function isTokenGroup(value: unknown): value is TokenGroup {
  return isObject(value) && !isToken(value);
}
export function normalizeObjectPrototypes(value: unknown): void {
  if (Array.isArray(value)) {
    for (const entry of value) normalizeObjectPrototypes(entry);
    return;
  }
  if (!isObject(value)) return;
  Object.setPrototypeOf(value, null);
  for (const entry of Object.values(value)) normalizeObjectPrototypes(entry);
}
export function copyTraceMetadata(value: unknown, copy: unknown, state: TraceState): void {
  if (!isObject(value) || !isObject(copy)) return;
  const metadata = state.nodes.get(value);
  if (metadata)
    state.nodes.set(copy, {
      location: metadata.location,
      contributions: [...metadata.contributions],
      typeOrigin: metadata.typeOrigin,
      dependencies: metadata.dependencies.map((dependency) => ({
        ...dependency,
        source: { ...dependency.source },
        ...(dependency.target ? { target: { ...dependency.target } } : {}),
      })),
    });
  const groupLocation = state.groups.get(value);
  if (groupLocation) state.groups.set(copy, groupLocation);
  const groupType = state.groupTypes.get(value);
  if (groupType) state.groupTypes.set(copy, groupType);
  for (const [key, child] of Object.entries(value)) copyTraceMetadata(child, copy[key], state);
}
export function copyExtensionOrigins(
  value: unknown,
  copy: unknown,
  origins: ExtensionOrigins,
): void {
  if (!isObject(value) || !isObject(copy)) return;
  const origin = origins.get(value);
  if (origin) origins.set(copy, origin);
  for (const [key, child] of Object.entries(value)) copyExtensionOrigins(child, copy[key], origins);
}
export function clone<T>(
  value: T,
  extensionOrigins?: ExtensionOrigins,
  traceState?: TraceState,
): T {
  const copy = structuredClone(value);
  normalizeObjectPrototypes(copy);
  if (extensionOrigins) copyExtensionOrigins(value, copy, extensionOrigins);
  if (traceState) copyTraceMetadata(value, copy, traceState);
  return copy;
}
export function mergeTraceMetadata(base: TraceMetadata, override: TraceMetadata): TraceMetadata {
  const merged = cloneTraceMetadata(override);
  merged.contributions = [
    ...base.contributions.map((location) => ({ ...location })),
    ...override.contributions.map((location) => ({ ...location })),
  ];
  merged.typeOrigin = override.typeOrigin
    ? { ...override.typeOrigin }
    : base.typeOrigin
      ? { ...base.typeOrigin }
      : null;
  merged.dependencies = [
    ...base.dependencies.map((dependency) => ({ ...dependency })),
    ...override.dependencies.map((dependency) => ({ ...dependency })),
  ];
  return merged;
}
export function mergeDocuments(
  documents: TokenDocument[],
  extensionOrigins?: ExtensionOrigins,
  traceState?: TraceState,
): TokenDocument {
  const result: TokenDocument = Object.create(null);
  for (const document of documents) mergeGroup(result, document, extensionOrigins, traceState);
  return result;
}
function mergeGroup(
  target: TokenGroup,
  source: TokenGroup,
  extensionOrigins?: ExtensionOrigins,
  traceState?: TraceState,
): void {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];
    if (isTokenGroup(existing) && isTokenGroup(value))
      mergeGroup(existing, value, extensionOrigins, traceState);
    else if (isToken(existing) && isToken(value))
      target[key] = mergeToken(existing, value, extensionOrigins, traceState);
    else target[key] = clone(value, extensionOrigins, traceState);
    if (key === '$type' && traceState) {
      const origin = traceState.groupTypes.get(source);
      if (origin) traceState.groupTypes.set(target, origin);
    }
    if (key === '$extends') {
      const extensionOrigin = extensionOrigins?.get(source);
      if (extensionOrigin) extensionOrigins?.set(target, extensionOrigin);
      const traceOrigin = traceState?.groups.get(source);
      if (traceOrigin) traceState?.groups.set(target, traceOrigin);
    }
  }
}
function mergeToken(
  existing: DesignToken | undefined,
  incoming: DesignToken,
  extensionOrigins?: ExtensionOrigins,
  traceState?: TraceState,
): DesignToken {
  if (!existing) return clone(incoming, extensionOrigins, traceState);
  const merged = clone(incoming, extensionOrigins, traceState);
  const baseTrace = traceState?.nodes.get(existing);
  const incomingTrace = traceState?.nodes.get(incoming);
  if (traceState && baseTrace && incomingTrace)
    traceState.nodes.set(merged, mergeTraceMetadata(baseTrace, incomingTrace));
  if (merged.$type === undefined && existing.$type !== undefined) merged.$type = existing.$type;
  if (merged.$description === undefined && existing.$description !== undefined)
    merged.$description = existing.$description;
  if (merged.$deprecated === undefined && existing.$deprecated !== undefined)
    merged.$deprecated = existing.$deprecated;
  const baseExtensions = existing.$extensions;
  if (!baseExtensions) return merged;
  const namespace = 'com.lostgradient.cinder';
  const extensions: TokenExtensions = { ...clone(baseExtensions), ...clone(merged.$extensions) };
  const baseCinder = baseExtensions[namespace];
  if (isObject(baseCinder)) {
    const overrideCinder = merged.$extensions?.[namespace];
    const cinder: Record<string, unknown> = isObject(overrideCinder) ? clone(overrideCinder) : {};
    for (const key of [
      'cssProperty',
      'public',
      'category',
      'component',
      'contrastPairs',
      'usageContracts',
    ])
      if (cinder[key] === undefined && baseCinder[key] !== undefined)
        cinder[key] = clone(baseCinder[key]);
    extensions[namespace] = cinder;
  }
  merged.$extensions = extensions;
  return merged;
}
