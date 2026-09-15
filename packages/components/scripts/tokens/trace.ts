import type { DesignToken, TokenDocument } from './types.ts';

export type ResolverSourceLocation = {
  documentId: string;
  tokenPath: string;
  sourcePointer: string;
  sourceIndex: number;
};

export type ResolverTraceDependency = {
  kind: 'alias' | 'extends' | 'reference' | 'recipe';
  source: ResolverSourceLocation;
  targetPath: string;
  target?: ResolverSourceLocation;
};

export type ResolverTokenTrace = {
  winningLocation: ResolverSourceLocation;
  contributingLocations: readonly ResolverSourceLocation[];
  typeOrigin: ResolverSourceLocation | null;
  directDependencies: readonly ResolverTraceDependency[];
};

export type ResolverTraceResult = {
  resolved: Record<string, DesignToken>;
  traces: ReadonlyMap<string, ResolverTokenTrace>;
};

export type TraceMetadata = {
  location: ResolverSourceLocation;
  contributions: ResolverSourceLocation[];
  typeOrigin: ResolverSourceLocation | null;
  dependencies: ResolverTraceDependency[];
};

export type TraceState = {
  nodes: WeakMap<object, TraceMetadata>;
  groups: WeakMap<object, ResolverSourceLocation>;
  groupTypes: WeakMap<object, ResolverSourceLocation>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNormalizedIdentity(id: string): boolean {
  return (
    id.length > 0 &&
    !id.includes('\\') &&
    !id.includes('\u0000') &&
    !/^[a-z][a-z0-9+.-]*:/i.test(id) &&
    id.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')
  );
}

export function cloneTraceMetadata(metadata: TraceMetadata): TraceMetadata {
  return {
    location: { ...metadata.location },
    contributions: metadata.contributions.map((location) => ({ ...location })),
    typeOrigin: metadata.typeOrigin ? { ...metadata.typeOrigin } : null,
    dependencies: metadata.dependencies.map((dependency) => ({
      ...dependency,
      source: { ...dependency.source },
      ...(dependency.target ? { target: { ...dependency.target } } : {}),
    })),
  };
}

export function addTraceDependency(
  metadata: TraceMetadata,
  dependency: ResolverTraceDependency,
): void {
  const duplicate = metadata.dependencies.some(
    (candidate) =>
      candidate.kind === dependency.kind &&
      candidate.targetPath === dependency.targetPath &&
      candidate.source.sourcePointer === dependency.source.sourcePointer &&
      candidate.source.sourceIndex === dependency.source.sourceIndex &&
      candidate.target?.sourcePointer === dependency.target?.sourcePointer &&
      candidate.target?.sourceIndex === dependency.target?.sourceIndex,
  );
  if (!duplicate) metadata.dependencies.push(dependency);
}

export function pointerSegment(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

export function sourceLocation(
  documentId: string,
  tokenPath: string,
  sourcePointer: string,
  sourceIndex: number,
): ResolverSourceLocation {
  return { documentId, tokenPath, sourcePointer, sourceIndex };
}

export function prepareTraceDocuments(
  documents: TokenDocument[],
  sourceByDocument: ReadonlyMap<object, string>,
  sourceIds?: readonly string[],
): { documents: TokenDocument[]; state: TraceState } {
  if (sourceIds && sourceIds.length !== documents.length)
    throw new Error('sourceIds must match document count');
  const identities = sourceIds ?? documents.map((document) => sourceByDocument.get(document));
  if (identities.some((id) => id !== undefined && !isNormalizedIdentity(id)))
    throw new Error('sourceIds must be normalized relative document identities');
  const state: TraceState = {
    nodes: new WeakMap(),
    groups: new WeakMap(),
    groupTypes: new WeakMap(),
  };
  const prepared = documents.map((document, sourceIndex) => {
    const copy = structuredClone(document);
    const documentId = sourceIds?.[sourceIndex] ?? sourceByDocument.get(document);
    if (documentId) collectAuthoredFields(copy, documentId, sourceIndex, '', '', state, null);
    return copy;
  });
  return { documents: prepared, state };
}

function collectAuthoredFields(
  value: unknown,
  documentId: string,
  sourceIndex: number,
  path: string,
  pointer: string,
  state: TraceState,
  inheritedTypeOrigin: ResolverSourceLocation | null,
): void {
  if (!isRecord(value)) return;
  const object = value;
  const location = (field: string) => sourceLocation(documentId, path, field, sourceIndex);
  if ('$value' in object || '$ref' in object) {
    const authored = location(pointer);
    state.nodes.set(object, {
      location: authored,
      contributions: [authored],
      typeOrigin:
        typeof object['$type'] === 'string' ? location(`${pointer}/$type`) : inheritedTypeOrigin,
      dependencies: [],
    });
    return;
  }
  const root = object['$root'];
  if (isRecord(root)) {
    const rootObject = root;
    if ('$value' in rootObject || '$ref' in rootObject)
      state.nodes.set(rootObject, {
        location: location(`${pointer}/$root`),
        contributions: [location(`${pointer}/$root`)],
        typeOrigin:
          typeof rootObject['$type'] === 'string'
            ? location(`${pointer}/$root/$type`)
            : typeof object['$type'] === 'string'
              ? location(`${pointer}/$type`)
              : inheritedTypeOrigin,
        dependencies: [],
      });
  }
  if (typeof object['$extends'] === 'string')
    state.groups.set(object, location(`${pointer}/$extends`));
  if (typeof object['$type'] === 'string')
    state.groupTypes.set(object, location(`${pointer}/$type`));
  for (const [name, child] of Object.entries(object)) {
    if (name.startsWith('$')) continue;
    collectAuthoredFields(
      child,
      documentId,
      sourceIndex,
      path ? `${path}.${name}` : name,
      `${pointer}/${pointerSegment(name)}`,
      state,
      typeof object['$type'] === 'string' ? location(`${pointer}/$type`) : inheritedTypeOrigin,
    );
  }
}
