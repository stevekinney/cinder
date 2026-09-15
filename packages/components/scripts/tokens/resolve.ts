import {
  collectGroups,
  collectTokens,
  mergeAndExpandExtends,
  tokenPathFromReference,
} from './resolve-extends.ts';
import { clone, mergeDocuments } from './resolve-merge.ts';
import { resolveToken, resolveValue } from './resolve-values.ts';
import {
  prepareTraceDocuments,
  type ResolverTokenTrace,
  type ResolverTraceResult,
  type TraceState,
} from './trace.ts';
import type { DesignToken, TokenDocument, TokenGroup } from './types.ts';

type ResolvedTokens = Map<string, DesignToken>;
type RawRefs = Map<string, string>;

function buildTokenIndex(
  documents: TokenDocument[],
  sourceByDocument?: ReadonlyMap<object, string>,
  sourceIds?: readonly string[],
): {
  tokens: ResolvedTokens;
  rawRefs: RawRefs;
  rootTokenPaths: Set<string>;
  groups: Map<string, TokenGroup>;
  merged: TokenDocument;
  traceState: TraceState | undefined;
} {
  const tokens: ResolvedTokens = new Map();
  const rootTokenPaths = new Set<string>();
  const prepared = sourceByDocument
    ? prepareTraceDocuments(documents, sourceByDocument, sourceIds)
    : { documents, state: undefined };
  const traceDocuments = prepared.documents;
  const traceState = prepared.state;
  const preparedSourceIdentities = sourceByDocument ? new Map<object, string>() : undefined;
  for (const [index, document] of traceDocuments.entries()) {
    const identifier = sourceIds?.[index] ?? sourceByDocument?.get(documents[index]!);
    if (identifier) preparedSourceIdentities?.set(document, identifier);
  }
  const merged = mergeAndExpandExtends(
    traceDocuments,
    traceDocuments,
    preparedSourceIdentities,
    traceState,
  );
  const groups = new Map<string, TokenGroup>();
  collectGroups(merged, '', groups);
  collectTokens(merged, '', tokens, rootTokenPaths, undefined, traceState);
  const rawRefs: RawRefs = new Map();
  for (const [path, token] of tokens)
    if (typeof token.$ref === 'string') rawRefs.set(path, token.$ref);
  return { tokens, rawRefs, rootTokenPaths, groups, merged, traceState };
}

export function resolveDocuments(documents: TokenDocument[]): Record<string, DesignToken> {
  const { tokens, rawRefs, rootTokenPaths, groups } = buildTokenIndex(documents);
  const completed = new Set<string>();
  const resolved: Record<string, DesignToken> = Object.create(null);
  for (const path of tokens.keys())
    resolved[path] = clone(
      resolveToken(path, tokens, rawRefs, rootTokenPaths, new Set(), groups, completed),
    );
  return resolved;
}

export function resolveDocumentsWithTrace(
  documents: TokenDocument[],
  sourceByDocument: ReadonlyMap<object, string>,
  sourceIds?: readonly string[],
): ResolverTraceResult {
  const index = buildTokenIndex(documents, sourceByDocument, sourceIds);
  const completed = new Set<string>();
  const resolved: Record<string, DesignToken> = Object.create(null);
  for (const path of index.tokens.keys())
    resolved[path] = clone(
      resolveToken(
        path,
        index.tokens,
        index.rawRefs,
        index.rootTokenPaths,
        new Set(),
        index.groups,
        completed,
        index.traceState,
      ),
    );
  const traces = new Map<string, ResolverTokenTrace>();
  if (!index.traceState) return { resolved, traces };
  for (const [path, token] of index.tokens) {
    const metadata = index.traceState.nodes.get(token);
    if (!metadata) continue;
    traces.set(path, {
      winningLocation: metadata.location,
      contributingLocations: metadata.contributions.map((location) => ({ ...location })),
      typeOrigin: metadata.typeOrigin,
      directDependencies: metadata.dependencies.map((dependency) => ({
        ...dependency,
        source: { ...dependency.source },
        ...(dependency.target ? { target: { ...dependency.target } } : {}),
      })),
    });
  }
  return { resolved, traces };
}

export type ValueResolver = (value: unknown) => unknown;
export function createValueResolver(documents: TokenDocument[]): ValueResolver {
  const { tokens, rawRefs, rootTokenPaths, groups } = buildTokenIndex(documents);
  const completed = new Set<string>();
  return (value: unknown) =>
    resolveValue(value, tokens, rawRefs, rootTokenPaths, new Set(), groups, completed);
}

export { mergeAndExpandExtends, mergeDocuments, tokenPathFromReference };
export function resolveDocument(document: TokenDocument): Record<string, DesignToken> {
  return resolveDocuments([document]);
}
