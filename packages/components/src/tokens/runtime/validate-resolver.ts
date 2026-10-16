import type { ValidationIssue } from './types.ts';
import { TokenValidationError } from './types.ts';
import { type ResolverDocumentShape, addIssue, isObject, isString } from './validate-values.ts';

export function isResolverReference(value: unknown): value is { $ref: string } {
  return isObject(value) && typeof value['$ref'] === 'string';
}

export function unknownReservedPropertyReason(key: string): string {
  return `unknown reserved property ${key}`;
}

/**
 * Parses a resolutionOrder entry's `$ref` (e.g. "#/sets/foundation" or
 * "#/modifiers/theme") into its target kind and name. JSON Pointer
 * tilde-escapes are decoded per RFC 6901; returns undefined for anything
 * that isn't a well-formed pointer into `sets` or `modifiers`.
 */
export function isResolverTargetKind(value: string): value is 'sets' | 'modifiers' {
  return value === 'sets' || value === 'modifiers';
}

export function resolutionOrderTarget(
  ref: string,
): { kind: 'sets' | 'modifiers'; name: string } | undefined {
  // RFC 6901 §6 order: percent-decode the whole fragment, then split
  // structurally on `/`, then tilde-decode the segment. Decoding before
  // splitting is what makes `#/sets/foo%2Fbar` decode to the three-segment
  // pointer `/sets/foo/bar` and be rejected -- a set named `foo/bar` is only
  // addressable as `#/sets/foo~1bar` -- while `#/sets/high%20contrast`
  // correctly names `high contrast`.
  let decoded: string;
  try {
    decoded = decodeURIComponent(ref);
  } catch {
    return undefined;
  }
  // `[^/]+` rather than `.+`: an unescaped `/` makes this a deeper pointer
  // than `#/<kind>/<name>`, not a name containing a slash.
  const match = /^#\/(sets|modifiers)\/([^/]+)$/.exec(decoded);
  if (!match) return undefined;
  const [, kind, rawName] = match;
  if (
    kind === undefined ||
    rawName === undefined ||
    !isResolverTargetKind(kind) ||
    /~(?:[^01]|$)/.test(rawName)
  )
    return undefined;
  const name = rawName.replaceAll('~1', '/').replaceAll('~0', '~');
  return { kind, name };
}

/**
 * Semantic checks the official DTCG 2025.10 resolver JSON Schema cannot
 * express: `default` matching a live context key, resolutionOrder entries
 * resolving to a set or modifier that actually exists (schema can only
 * constrain the `$ref` string's shape, not cross-reference sibling `sets`/
 * `modifiers` object keys), non-empty source/context arrays, and
 * resolutionOrder covering every set and modifier exactly once -- EXCEPT a
 * set that is reached only through a resolver-internal `#/sets/<name>`
 * reference from another set's `sources` or a modifier context (CIN-464):
 * that set contributes its documents at the position of whatever references
 * it, so requiring it in resolutionOrder too would be redundant. Such a set
 * MAY still appear in resolutionOrder as well -- nothing here forbids it --
 * it is simply no longer REQUIRED to.
 */
export function validateResolverDocument(document: ResolverDocumentShape): void {
  const issues: ValidationIssue[] = [];
  if (document.version !== '2025.10')
    addIssue(issues, '$.version', 'resolver version must be 2025.10');

  // CIN-464: a set or modifier context source may itself be a
  // resolver-internal `#/sets/<name>` reference rather than a token-document
  // path (see `validate-corpus.ts`'s `expandSetSources`/`expandContextSources`,
  // which resolve these into the referenced set's own documents). A set
  // pulled in only through another SET, or only through a MODIFIER CONTEXT
  // -- never named directly in `resolutionOrder` -- still contributes its
  // documents, at the position of whatever references it, so it must NOT
  // also be required in `resolutionOrder` itself below. This function only
  // has the resolver's STRUCTURE to work with, never the actual token
  // documents, so it cannot check whether a modifier-context-only set's
  // individual token paths already have a base declaration from some other
  // set -- see the "context-only override set" note further below for why
  // that check does not belong here.
  // Keyed by CHILD set name -> the set of PARENT set names that reference it
  // internally. More than one parent referencing the same child means that
  // child gets expanded more than once into the resolved document tree --
  // reject that below (see the "Reject a child set expanded by multiple
  // ordered parents" check) rather than let it surface as the same
  // CSS-vs-resolved-JSON disagreement the single-parent-plus-explicit-listing
  // case already guards against.
  const parentsReferencingSet = new Map<string, Set<string>>();
  // Direct set-to-set reference edges (parent -> the child set names its own
  // sources reference), used below to compute each ORDERED set's full
  // transitive descendant closure -- the direct-parents-only version of that
  // check missed a child reachable through a CHAIN of internal references
  // (e.g. resolutionOrder "A, theme, Wrapper" where A -> Base and
  // Wrapper -> B -> Base: Base's only DIRECT parents are A and B, and only A
  // is itself ordered, so a direct-parent check sees no conflict even though
  // Base is genuinely expanded at both ordered positions).
  const setDirectChildren = new Map<string, Set<string>>();
  const setReferencedByAnotherSet = new Set<string>();
  const setReferencedByModifierContext = new Set<string>();
  function noteSetReferencedByAnotherSet(parentName: string, sources: unknown): void {
    if (!Array.isArray(sources)) return;
    for (const source of sources) {
      if (!isResolverReference(source)) continue;
      const target = resolutionOrderTarget(source['$ref']);
      if (target?.kind !== 'sets') continue;
      setReferencedByAnotherSet.add(target.name);
      const parents = parentsReferencingSet.get(target.name) ?? new Set();
      parents.add(parentName);
      parentsReferencingSet.set(target.name, parents);
      const children = setDirectChildren.get(parentName) ?? new Set();
      children.add(target.name);
      setDirectChildren.set(parentName, children);
    }
  }
  function noteSetReferencedByModifierContext(sources: unknown): void {
    if (!Array.isArray(sources)) return;
    for (const source of sources) {
      if (!isResolverReference(source)) continue;
      const target = resolutionOrderTarget(source['$ref']);
      if (target?.kind === 'sets') setReferencedByModifierContext.add(target.name);
    }
  }

  const modifierNames = new Set(Object.keys(document.modifiers));
  for (const [name, modifier] of Object.entries(document.modifiers)) {
    if (!isObject(modifier) || !isObject(modifier['contexts'])) {
      addIssue(issues, `$.modifiers.${name}`, 'modifier must have a contexts object');
      continue;
    }
    const contexts = modifier['contexts'];
    for (const [contextName, sources] of Object.entries(contexts)) {
      if (!Array.isArray(sources) || sources.length === 0 || !sources.every(isResolverReference))
        addIssue(
          issues,
          `$.modifiers.${name}.contexts.${contextName}`,
          'context must be a non-empty array of $ref sources',
        );
      else noteSetReferencedByModifierContext(sources);
    }
    if (
      modifier['default'] !== undefined &&
      (!isString(modifier['default']) || !Object.keys(contexts).includes(modifier['default']))
    )
      addIssue(issues, `$.modifiers.${name}`, 'modifier default must be one of its context names');
  }

  const setNames = new Set(Object.keys(document.sets));
  if (setNames.size === 0) addIssue(issues, '$.sets', 'resolver must include at least one set');
  for (const [name, set] of Object.entries(document.sets)) {
    if (
      !isObject(set) ||
      !Array.isArray(set['sources']) ||
      set['sources'].length === 0 ||
      !set['sources'].every(isResolverReference)
    )
      addIssue(issues, `$.sets.${name}`, 'set must have a non-empty array of $ref sources');
    else noteSetReferencedByAnotherSet(name, set['sources']);
  }
  const internallyReferencedSetNames = new Set([
    ...setReferencedByAnotherSet,
    ...setReferencedByModifierContext,
  ]);

  const resolutionOrderTargets = new Set<string>();
  const explicitSetOrderPath = new Map<string, string>();
  for (const [index, entry] of document.resolutionOrder.entries()) {
    if (!isResolverReference(entry)) {
      addIssue(issues, `$.resolutionOrder.${index}`, 'resolutionOrder entry must be a $ref object');
      continue;
    }
    const target = resolutionOrderTarget(entry['$ref']);
    if (!target || !(target.kind === 'sets' ? setNames : modifierNames).has(target.name)) {
      addIssue(
        issues,
        `$.resolutionOrder.${index}`,
        `resolutionOrder must reference an existing set or modifier: ${entry['$ref']}`,
      );
      continue;
    }
    const key = `${target.kind}/${target.name}`;
    if (resolutionOrderTargets.has(key))
      addIssue(issues, `$.resolutionOrder.${index}`, 'resolutionOrder entries must be unique');
    resolutionOrderTargets.add(key);
    if (target.kind === 'sets') explicitSetOrderPath.set(target.name, `$.resolutionOrder.${index}`);
  }
  const expectedTargets = new Set([
    ...[...setNames]
      .filter((name) => !internallyReferencedSetNames.has(name))
      .map((name) => `sets/${name}`),
    ...[...modifierNames].map((name) => `modifiers/${name}`),
  ]);
  const unlistedTargets = [...expectedTargets].filter(
    (target) => !resolutionOrderTargets.has(target),
  );
  if (unlistedTargets.length > 0)
    addIssue(issues, '$.resolutionOrder', 'must list every set and modifier exactly once');

  // A set referenced by another SET is exempt from resolutionOrder because it
  // still contributes through that set's own expansion -- but nothing stops
  // it from ALSO being listed explicitly. That double inclusion is never
  // correct: `buildResolvedContexts` walks the full resolutionOrder, so if a
  // modifier sits between the referencing set and the explicit entry (e.g.
  // "A, theme, B" where A internally references B), expanding A re-applies
  // B's values AFTER the modifier, silently resetting whatever the modifier
  // just overrode -- while `buildTokensBaseCss` collects every set into
  // `:root` once and emits theme documents separately, so the generated CSS
  // and the resolved JSON snapshots disagree about which value wins. Reject
  // the combination outright rather than let it surface as that disagreement
  // later.
  for (const setName of setReferencedByAnotherSet) {
    const explicitPath = explicitSetOrderPath.get(setName);
    if (explicitPath !== undefined) {
      addIssue(
        issues,
        explicitPath,
        `set "${setName}" is already referenced internally by another ordered set and must not ` +
          'also appear in resolutionOrder -- it would be included twice',
      );
    }
  }

  // The single-parent-plus-explicit-listing case above doesn't cover a child
  // set reachable from TWO DIFFERENT ordered positions through a chain of
  // internal references -- e.g. resolutionOrder "A, theme, Wrapper" where
  // A -> Base directly, and Wrapper -> B -> Base (Base's only DIRECT parents
  // are A and B; only A is itself ordered, so a direct-parents-only check
  // sees no conflict even though Base is genuinely expanded again through
  // Wrapper's own recursive expansion). Compute each ordered set's full
  // TRANSITIVE descendant closure and reject any set reachable from more
  // than one ordered position -- this subsumes the direct-parent case above,
  // since a direct parent is a one-hop descendant.
  function transitiveDescendants(setName: string): Set<string> {
    const seen = new Set<string>();
    const stack = [setName];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const child of setDirectChildren.get(current) ?? []) {
        if (seen.has(child)) continue; // also guards against a reference cycle
        seen.add(child);
        stack.push(child);
      }
    }
    return seen;
  }
  const reachingOrderedSets = new Map<string, Set<string>>();
  for (const target of resolutionOrderTargets) {
    if (!target.startsWith('sets/')) continue;
    const orderedSetName = target.slice('sets/'.length);
    for (const descendant of transitiveDescendants(orderedSetName)) {
      const reachers = reachingOrderedSets.get(descendant) ?? new Set();
      reachers.add(orderedSetName);
      reachingOrderedSets.set(descendant, reachers);
    }
  }
  for (const [setName, orderedAncestors] of reachingOrderedSets) {
    if (orderedAncestors.size > 1) {
      addIssue(
        issues,
        '$.resolutionOrder',
        `set "${setName}" is reachable from more than one ordered set ` +
          `(${[...orderedAncestors].toSorted().join(', ')}) and would be expanded more than once`,
      );
    }
  }

  // Reachability for the closed-cycle check below is broader than
  // `reachingOrderedSets` above: a set reachable ONLY through a chain
  // rooted at a modifier context (e.g. theme.light -> lightOverrides ->
  // sharedOverrides, where neither lightOverrides nor sharedOverrides is
  // itself ordered) is legitimately consumed by generation, per the
  // context-only-override exemption -- `reachingOrderedSets` is seeded only
  // from directly ordered sets and would wrongly flag `sharedOverrides` as
  // an unreachable closed cycle. Every modifier-context-referenced set is
  // therefore also a valid entry point here, not just ordered sets. This
  // does NOT feed the multi-ordered-position check above, which is
  // specifically about two DISTINCT ordered resolutionOrder positions
  // double-expanding the same set within one resolved combination --
  // mutually exclusive modifier contexts don't have that problem.
  const reachableFromAnyEntryPoint = new Set(reachingOrderedSets.keys());
  for (const target of resolutionOrderTargets) {
    if (target.startsWith('sets/')) reachableFromAnyEntryPoint.add(target.slice('sets/'.length));
  }
  for (const rootSetName of setReferencedByModifierContext) {
    reachableFromAnyEntryPoint.add(rootSetName);
    for (const descendant of transitiveDescendants(rootSetName))
      reachableFromAnyEntryPoint.add(descendant);
  }

  // The `expectedTargets`/`unlistedTargets` check above exempts any set
  // referenced by another set from needing its own resolutionOrder entry --
  // but that exemption is unsound for a CLOSED CYCLE of sets that reference
  // only each other (e.g. "a" -> "b" -> "a"): each member is "referenced by
  // another set", so both are exempted, and neither is ever required to be
  // ordered. The cycle is then unreachable from every actual entry point,
  // and `buildTokensBaseCss`/`buildBaseDocuments` silently omit its
  // documents entirely. `reachableFromAnyEntryPoint` (computed above)
  // already captures every set genuinely reachable from an ordered
  // position OR a modifier context -- anything internally referenced but
  // absent from it is unreachable, cycle or not.
  for (const setName of setReferencedByAnotherSet) {
    const directlyOrdered = resolutionOrderTargets.has(`sets/${setName}`);
    if (!directlyOrdered && !reachableFromAnyEntryPoint.has(setName)) {
      addIssue(
        issues,
        '$.resolutionOrder',
        `set "${setName}" is referenced internally but not reachable from any ordered set ` +
          '(possibly part of a closed cycle of sets that only reference each other) -- ' +
          'its documents would never be included',
      );
    }
  }

  // NOTE: an earlier version of this file rejected a modifier context's
  // internal set reference whenever the referenced SET (not its individual
  // token paths) had no independent path into resolutionOrder's base. That
  // check operated at the wrong granularity: this function only has the
  // resolver's STRUCTURE to work with, never the actual token documents, so
  // it can only reason about set names, not the token paths a set actually
  // contributes. A context-only override set (e.g. "lightOverrides",
  // referenced solely by theme's "light" context) is a legitimate,
  // already-generator-supported pattern -- see generate.test.ts's "a theme
  // context referencing a set via #/sets/<name> does not throw" -- whenever
  // its OVERRIDE tokens share paths with a base declaration contributed by
  // some OTHER set. The set-level check could not see that and rejected
  // exactly this shape, a false positive against an already-shipped,
  // already-tested pattern. Removed rather than narrowed: token-path-level
  // reachability can only be checked where token documents are actually
  // loaded (validate-corpus.ts or generation), and generation already
  // rejects a genuinely-unreachable override with a clear "no matching base
  // token" error at the correct granularity.

  if (issues.length > 0) throw new TokenValidationError(issues);
}
