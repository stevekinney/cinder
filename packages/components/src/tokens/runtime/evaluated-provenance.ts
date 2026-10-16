/**
 * Evaluated provenance: for every token in every context, where its value and
 * type come from (the shared {@link TokenContextProvenance} record), what it
 * reads directly, and what reads it, directly or through other tokens.
 *
 * The traversal is bounded by the token set: each token is visited once per
 * search, so a malformed cycle in the recipe edges (which no reference check
 * covers) cannot loop. Output order is fixed: tokens sort by the position of
 * their winning document in the context's layer stack, then by path; every
 * dependency and dependent list sorts the same way and names each token once.
 */

import {
  UNKNOWN,
  type AuthoringContext,
  type AuthoringLayer,
  type TokenContextProvenance,
  type TokenLocation,
} from './authoring-types.ts';

/** One token's provenance and edges in one context. */
export type TokenEvaluation = {
  path: string;
  provenance: TokenContextProvenance;
  /** Tokens this one reads directly, in document/layer order then path. */
  dependencies: TokenLocation[];
  /** Tokens that read this one directly or transitively, in document/layer order then path. */
  dependents: TokenLocation[];
};

/**
 * The evaluated-provenance result. `revision` is the revision of the sources
 * it was computed from, so a consumer can discard a result that no longer
 * matches the current sources.
 */
export type EvaluatedProvenance = {
  revision: number | string;
  contexts: AuthoringContext[];
  /** Ordered layer stack per context id. */
  layerStacks: Record<string, AuthoringLayer[]>;
  /** Per context id, every token in a deterministic order. */
  tokens: Record<string, TokenEvaluation[]>;
};

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  return left > right ? 1 : 0;
}

/** The token a reference names: the path itself, or its longest ancestor that is a token. */
function targetOf(reference: string, tokens: ReadonlyMap<string, unknown>): string | undefined {
  let candidate = reference;
  for (;;) {
    if (tokens.has(candidate)) return candidate;
    const cut = candidate.lastIndexOf('.');
    if (cut < 0) return undefined;
    candidate = candidate.slice(0, cut);
  }
}

/** Builds the per-token records of one context from its traced provenance. */
export function evaluateContextProvenance(
  stack: readonly AuthoringLayer[],
  traced: ReadonlyMap<string, TokenContextProvenance>,
): TokenEvaluation[] {
  const layerIndex = new Map(stack.map((layer, index) => [layer.document, index]));
  const rank = (path: string): number => layerIndex.get(traced.get(path)!.winner.document) ?? -1;
  const order = (left: string, right: string): number =>
    rank(left) - rank(right) || compareCodeUnits(left, right);
  const locate = (path: string): TokenLocation => ({
    document: traced.get(path)!.winner.document,
    path,
  });

  const dependencies = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();
  for (const path of traced.keys()) {
    dependencies.set(path, new Set());
    dependents.set(path, new Set());
  }
  for (const [path, provenance] of traced) {
    const references = [
      ...provenance.inputs.aliases,
      ...provenance.inputs.refs,
      ...provenance.inputs.recipes.map((recipe) => recipe.path),
      provenance.winner.path,
    ];
    for (const reference of references) {
      if (reference === UNKNOWN) continue;
      const target = targetOf(reference, traced);
      if (target === undefined || target === path) continue;
      dependencies.get(path)!.add(target);
      dependents.get(target)!.add(path);
    }
  }

  function closure(start: string, edges: ReadonlyMap<string, ReadonlySet<string>>): string[] {
    const seen = new Set<string>();
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
      for (const next of edges.get(queue[head]!) ?? []) {
        if (next === start || seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    return [...seen];
  }

  return [...traced.keys()].toSorted(order).map((path) => ({
    path,
    provenance: traced.get(path)!,
    dependencies: [...dependencies.get(path)!].toSorted(order).map(locate),
    dependents: closure(path, dependents).toSorted(order).map(locate),
  }));
}
