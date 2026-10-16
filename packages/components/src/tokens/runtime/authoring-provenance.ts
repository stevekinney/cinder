/**
 * Per-token provenance for one ordered document stack.
 *
 * Given the documents one modifier context resolves, in resolution order, this
 * reports for every token which layers supply it, which declaration wins, where
 * its effective DTCG type is declared, and what its winning declaration reads.
 * It reuses the evaluation machinery (`mergeAndExpandExtends`, `collectEntries`)
 * instead of re-deriving it, so the answer is the evaluator's own: the tests
 * assert it matches `resolveDocuments` for every token.
 *
 * No Node imports. The COR-491 runtime reuses this for an edited layer stack,
 * so resetting an override is just tracing the stack without that edit.
 */

import {
  UNKNOWN,
  type AuthoringLayer,
  type ContributingLayer,
  type EffectiveType,
  type TokenContextProvenance,
  type TokenInputs,
  type TokenLocation,
} from './authoring-types.ts';
import { collectEntries, type CorpusEntry } from './corpus.ts';
import { tokenPathFromReference } from './resolve-shared.ts';
import { mergeAndExpandExtends } from './resolve.ts';
import type { DesignToken, TokenDocument, TokenGroup } from './types.ts';

/** One layer of a stack: its identity and its raw document. */
export type ProvenanceLayerInput = AuthoringLayer & { content: TokenDocument };

export type TraceOptions = {
  /** Public custom property -> token path, used to name `cssRecipe` inputs. */
  cssPropertyToPath?: Readonly<Record<string, string>>;
};

type Node = Record<string, unknown>;

function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTokenNode(value: unknown): value is DesignToken {
  return isNode(value) && ('$value' in value || '$ref' in value);
}

/** A non-token object node is a group. */
function asGroup(node: Node): TokenGroup {
  const group: TokenGroup = {};
  for (const [key, value] of Object.entries(node))
    Object.defineProperty(group, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  return group;
}

type Located = {
  token: DesignToken | undefined;
  groups: Array<{ path: string; group: TokenGroup }>;
};

/** Walks a document to a token path, collecting the groups on the way (a `$root` shares its group's path). */
function locate(root: TokenDocument, path: string): Located {
  const groups: Located['groups'] = [{ path: '', group: root }];
  let current: unknown = root;
  let prefix = '';
  for (const segment of path === '' ? [] : path.split('.')) {
    if (!isNode(current)) return { token: undefined, groups };
    current = current[segment];
    prefix = prefix ? `${prefix}.${segment}` : segment;
    if (isNode(current) && !isTokenNode(current))
      groups.push({ path: prefix, group: asGroup(current) });
  }
  if (isTokenNode(current)) return { token: current, groups };
  if (isNode(current) && isTokenNode(current['$root'])) return { token: current['$root'], groups };
  return { token: undefined, groups };
}

function cinderOf(token: DesignToken | undefined): Node | undefined {
  const own = token?.$extensions?.['com.lostgradient.cinder'];
  return isNode(own) ? own : undefined;
}

function referencedPaths(value: unknown, into: Set<string>): void {
  if (typeof value === 'string') {
    for (const match of value.matchAll(/\{([^{}]+)\}/g)) into.add(match[1]!);
    if (value.startsWith('#/')) {
      try {
        into.add(tokenPathFromReference(value));
      } catch {
        // A malformed pointer is a validation error, reported by the validators.
      }
    }
  } else if (Array.isArray(value)) for (const item of value) referencedPaths(item, into);
  else if (isNode(value)) for (const item of Object.values(value)) referencedPaths(item, into);
}

function pointerOrReferencePath(reference: string): string | undefined {
  try {
    return tokenPathFromReference(reference);
  } catch {
    return undefined;
  }
}

/**
 * The merged `com.lostgradient.cinder` extension block of every token, keyed by
 * path. `CorpusEntry` carries only the fields CSS generation reads; the
 * catalogue also needs `nonRepresentableValue` and `scale`.
 */
export function collectCinderExtensions(root: TokenDocument): Map<string, Record<string, unknown>> {
  const result = new Map<string, Record<string, unknown>>();
  const walk = (group: TokenGroup, prefix: string): void => {
    if (isTokenNode(group.$root)) result.set(prefix, cinderOf(group.$root) ?? {});
    for (const [name, value] of Object.entries(group)) {
      if (name.startsWith('$') || !isNode(value)) continue;
      const path = prefix ? `${prefix}.${name}` : name;
      if (isTokenNode(value)) result.set(path, cinderOf(value) ?? {});
      else walk(asGroup(value), path);
    }
  };
  walk(root, '');
  return result;
}

/** Traces every token of one ordered stack. */
export function traceProvenance(
  stack: readonly ProvenanceLayerInput[],
  options: TraceOptions = {},
): Map<string, TokenContextProvenance> {
  const documents = stack.map((layer) => layer.content);
  const merged = mergeAndExpandExtends(documents);
  const finalEntries = new Map<string, CorpusEntry>();
  collectEntries(merged, '', undefined, finalEntries);

  const rawEntries = documents.map((document) => {
    const entries = new Map<string, CorpusEntry>();
    collectEntries(document, '', undefined, entries);
    return entries;
  });
  const expanded = documents.map((document) => mergeAndExpandExtends([document], documents));
  const expandedEntries = expanded.map((document) => {
    const entries = new Map<string, CorpusEntry>();
    collectEntries(document, '', undefined, entries);
    return entries;
  });

  /**
   * Whether layer `index` declares a group above `path` that carries an `$extends`. A layer's
   * own groups shadow the lookup documents, so a layer that restates the extended group cannot
   * expand to a member only an earlier layer declares; the merge still delivers it.
   */
  function declaresExtendingAncestor(index: number, path: string): boolean {
    const segments = path.split('.');
    return segments.some((_, length) => {
      const groupPath = segments.slice(0, length).join('.');
      const group = locate(documents[index]!, groupPath).groups.find((g) => g.path === groupPath);
      return typeof group?.group.$extends === 'string';
    });
  }

  /** The last layer whose expansion holds `path`, else the last that extends a group above it. */
  function supplyingLayer(path: string): number {
    const expandedHolder = stack.findLastIndex((_, index) => expandedEntries[index]!.has(path));
    if (expandedHolder >= 0) return expandedHolder;
    return stack.findLastIndex((_, index) => declaresExtendingAncestor(index, path));
  }

  /** Where a member is copied from when layer `index` supplies it through the `$extends` of its ancestor `length` segments deep. */
  function extendsHop(
    segments: readonly string[],
    index: number,
    length: number,
  ): { index: number; path: string } | undefined {
    const groupPath = segments.slice(0, length).join('.');
    const group = locate(documents[index]!, groupPath).groups.find((g) => g.path === groupPath);
    const extended = group?.group.$extends;
    const target = typeof extended === 'string' ? pointerOrReferencePath(extended) : undefined;
    if (target === undefined) return undefined;
    const origin = [target, ...segments.slice(length)].filter(Boolean).join('.');
    const holder = supplyingLayer(origin);
    return holder < 0 ? undefined : { index: holder, path: origin };
  }

  /** The declaration that really supplies `path` in layer `index`, following `$extends` members back to their origin. */
  function originOf(path: string, index: number, depth = 0): { index: number; path: string } {
    if (rawEntries[index]!.has(path) || depth > 32) return { index, path };
    const segments = path.split('.');
    // The nearest extending ancestor that can account for the member wins.
    const hop = segments
      .map((_, length) => extendsHop(segments, index, length))
      .findLast((candidate) => candidate !== undefined);
    return hop === undefined ? { index, path } : originOf(hop.path, hop.index, depth + 1);
  }

  function typeOf(path: string, entry: CorpusEntry): EffectiveType {
    const located = locate(merged, path);
    let declaring: { path: string; local: boolean } | undefined;
    if (located.token?.$type !== undefined) declaring = { path, local: true };
    else {
      const ancestor = located.groups.toReversed().find((g) => g.group.$type !== undefined);
      if (ancestor) declaring = { path: ancestor.path, local: false };
    }
    if (!declaring || entry.type === undefined)
      return { type: entry.type ?? UNKNOWN, origin: UNKNOWN, declaredAt: UNKNOWN };
    for (let index = stack.length - 1; index >= 0; index--) {
      const inLayer = locate(expanded[index]!, declaring.path);
      const node = declaring.local
        ? inLayer.token
        : inLayer.groups.find((g) => g.path === declaring.path)?.group;
      if (node?.$type !== undefined)
        return {
          type: entry.type,
          origin: declaring.local ? 'local' : 'inherited',
          declaredAt: { document: stack[index]!.document, path: declaring.path },
        };
    }
    return {
      type: entry.type,
      origin: declaring.local ? 'local' : 'inherited',
      declaredAt: UNKNOWN,
    };
  }

  function inputsOf(path: string): TokenInputs {
    const located = locate(merged, path);
    const aliases = new Set<string>();
    if (located.token?.$value !== undefined) referencedPaths(located.token.$value, aliases);
    const refs = typeof located.token?.$ref === 'string' ? [located.token.$ref] : [];
    const extendsInputs: TokenInputs['extends'] = [];
    for (const { path: groupPath } of located.groups) {
      for (let index = stack.length - 1; index >= 0; index--) {
        const rawGroup = locate(documents[index]!, groupPath).groups.find(
          (g) => g.path === groupPath,
        )?.group;
        if (typeof rawGroup?.$extends !== 'string') continue;
        const target = pointerOrReferencePath(rawGroup.$extends);
        if (target !== undefined) extendsInputs.push({ group: groupPath, target });
        break;
      }
    }
    const recipe = cinderOf(located.token)?.['cssRecipe'];
    const recipes: TokenInputs['recipes'] = [];
    if (typeof recipe === 'string') {
      for (const match of recipe.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)) {
        const cssProperty = match[1]!;
        if (recipes.some((r) => r.cssProperty === cssProperty)) continue;
        recipes.push({ cssProperty, path: options.cssPropertyToPath?.[cssProperty] ?? UNKNOWN });
      }
    }
    return {
      aliases: [...aliases].map((alias) => pointerOrReferencePath(`{${alias}}`) ?? alias),
      refs: refs.map((ref) => pointerOrReferencePath(ref) ?? ref),
      extends: extendsInputs,
      recipes,
    };
  }

  const traced = new Map<string, TokenContextProvenance>();
  for (const [path, entry] of finalEntries) {
    const layers: ContributingLayer[] = [];
    const expandedAnywhere = expandedEntries.some((entries) => entries.has(path));
    const supplies = stack.map((_, index) =>
      expandedAnywhere ? expandedEntries[index]!.has(path) : declaresExtendingAncestor(index, path),
    );
    stack.forEach((layer, index) => {
      if (!supplies[index]) return;
      layers.push({
        document: layer.document,
        kind: layer.kind,
        layer: layer.layer,
        path,
        via: rawEntries[index]!.has(path) ? 'declared' : 'extends',
      });
    });
    const lastIndex = supplyingLayer(path);
    const origin = originOf(path, lastIndex);
    const winner: TokenLocation = { document: stack[origin.index]!.document, path: origin.path };
    traced.set(path, {
      winner,
      layers,
      effectiveType: typeOf(path, entry),
      inputs: inputsOf(path),
    });
  }
  return traced;
}
