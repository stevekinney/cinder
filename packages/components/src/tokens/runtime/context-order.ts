import { collectEntries, type CorpusEntry } from './corpus.ts';
import { mergeAndExpandExtends } from './resolve.ts';
import { normalizeSourcePath, parseResolutionOrder, sourcesForEntry } from './resolver-order.ts';
import type { ResolverDocument, ResolverReference, TokenDocument } from './types.ts';

export type ResolvedContextCombo = {
  name: string;
  theme: string;
  motion: string;
};

export const RESOLVED_CONTEXT_COMBOS: readonly ResolvedContextCombo[] = [
  { name: 'light', theme: 'light', motion: 'default' },
  { name: 'dark', theme: 'dark', motion: 'default' },
  { name: 'light-reduced-motion', theme: 'light', motion: 'reduced' },
  { name: 'dark-reduced-motion', theme: 'dark', motion: 'reduced' },
];

/**
 * The token documents one modifier-value combination contributes, in
 * `resolver.resolutionOrder` order rather than a hardcoded [sets, theme,
 * motion] order. Mirrors `validate-corpus.ts`'s own per-combination assembly
 * (`parseResolutionOrder` / `sourcesForEntry`) so the resolved snapshots and
 * the validator agree on ordering even if the resolver ever reorders or adds
 * a set/modifier -- `mergeDocuments` keeps only the LAST occurrence of a
 * colliding token path, so document order determines the resolved value.
 */
export function documentsForResolutionOrder(
  resolver: ResolverDocument,
  documentsByPath: Map<string, TokenDocument>,
  modifierValues: Record<string, string>,
): TokenDocument[] {
  return parseResolutionOrder(resolver).flatMap((entry) =>
    refsFor(documentsByPath, sourcesForEntry(resolver, entry, modifierValues)),
  );
}

/**
 * The full modifier-value map when only SOME modifiers are named explicitly: every OTHER
 * modifier the resolver declares is filled from its own declared `default` context. Shared by
 * `modifierValuesForCombo` (a resolved-context snapshot, which names `theme` and `motion`
 * together) and `modifierValuesForContext` (a single override block, which names only the one
 * modifier it varies) so both describe "the rest of the corpus" identically. A modifier with no
 * declared default AND not named by the caller is a genuine authoring gap -- the caller can't say
 * what to resolve -- so this fails with a clear, named error rather than letting `sourcesForEntry`
 * look up `contexts[undefined]` and throw an unhelpful one.
 */
function modifierValuesWithDefaults(
  resolver: ResolverDocument,
  named: Record<string, string>,
  describeCaller: string,
): Record<string, string> {
  const modifierValues: Record<string, string> = {};
  for (const modifierName of Object.keys(resolver.modifiers)) {
    const value = named[modifierName] ?? resolver.modifiers[modifierName]!.default;
    if (value === undefined) {
      throw new Error(
        `${describeCaller} does not name a value for modifier "${modifierName}", and modifier ` +
          `"${modifierName}" has no declared default context.`,
      );
    }
    modifierValues[modifierName] = value;
  }
  return modifierValues;
}

/**
 * The full modifier-value map for one `RESOLVED_CONTEXT_COMBO`: the combo's own named
 * modifiers (`theme`/`motion`), plus a value for every OTHER modifier the resolver declares.
 * `RESOLVED_CONTEXT_COMBOS` is deliberately not generalized to every modifier combination --
 * the set of published resolved contexts is a packaging decision (CIN-31), and the four named
 * snapshots stay an explicit list.
 */
export function modifierValuesForCombo(
  resolver: ResolverDocument,
  combo: ResolvedContextCombo,
): Record<string, string> {
  return modifierValuesWithDefaults(
    resolver,
    { theme: combo.theme, motion: combo.motion },
    `Resolved-context combo "${combo.name}"`,
  );
}

/**
 * The full modifier-value map for building ONE override context in isolation -- e.g. the "dark"
 * theme block or the "reduced" motion block in `tokens-base.css`, each of which varies a single
 * modifier while every other modifier stays at its own declared default. This is the same
 * default-fill `modifierValuesForCombo` applies for the resolved-context snapshots, so an
 * override block's composed document scope and a snapshot's agree on what "the rest of the
 * corpus" means whenever a block only varies one axis.
 */
export function modifierValuesForContext(
  resolver: ResolverDocument,
  modifierName: string,
  contextName: string,
): Record<string, string> {
  return modifierValuesWithDefaults(
    resolver,
    { [modifierName]: contextName },
    `Override context "${modifierName}.${contextName}"`,
  );
}

export function scopeIndexFromDocuments(
  documents: readonly TokenDocument[],
): Map<string, CorpusEntry> {
  const index = new Map<string, CorpusEntry>();
  collectEntries(mergeAndExpandExtends([...documents]), '', undefined, index);
  return index;
}

/**
 * The tokens an override context (a theme or motion modifier) defines, each as
 * that context evaluates it.
 *
 * Membership -- which tokens the context overrides, and in what order -- comes
 * from the context's own documents. Each token's content comes from the same
 * evaluation the runtime projects (`scopeIndexFromDocuments` over the whole
 * ordered scope), so a type, `$extends` member, or other metadata the override
 * document inherits from an earlier layer is resolved once, here, and the
 * stylesheet generator and the browser cannot disagree about it. An override
 * document therefore need not restate a group `$type` its base already declares.
 */
export function overrideEntries(
  ownDocuments: readonly TokenDocument[],
  scopeDocuments: readonly TokenDocument[],
): Map<string, CorpusEntry> {
  const entries = new Map<string, CorpusEntry>();
  collectEntries(
    mergeAndExpandExtends([...ownDocuments], [...scopeDocuments]),
    '',
    undefined,
    entries,
  );
  const evaluated = scopeIndexFromDocuments(scopeDocuments);
  for (const path of entries.keys()) {
    const entry = evaluated.get(path);
    if (entry) entries.set(path, entry);
  }
  return entries;
}

export function documentsForSystemMotionScope(
  resolver: ResolverDocument,
  documentsByPath: Map<string, TokenDocument>,
  motion: string,
): TokenDocument[] {
  const modifierValues = { motion };
  return parseResolutionOrder(resolver)
    .filter(
      (entry) => entry.kind === 'sets' || (entry.kind === 'modifiers' && entry.name === 'motion'),
    )
    .flatMap((entry) => refsFor(documentsByPath, sourcesForEntry(resolver, entry, modifierValues)));
}

/**
 * `documentsByPath` is keyed by the normalized relative path `loadTokenDocuments`
 * reports (see `load.ts`'s `Glob` scan), but a resolver `$ref` is a URI reference
 * that may spell the same file differently (`./sets/x.tokens.json`, a percent-escaped
 * path). `normalizeSourcePath` -- reused from `validate-corpus.ts`, which faces the
 * identical lookup and already normalizes before comparing -- collapses both to the
 * same key, so a schema-valid ref that validation accepts also resolves here.
 */
export function requireDocument(
  documentsByPath: Map<string, TokenDocument>,
  ref: string,
): TokenDocument {
  const normalizedRef = normalizeSourcePath(ref);
  const document = documentsByPath.get(normalizedRef);
  if (!document) {
    throw new Error(`Resolver references "${ref}" but no loaded token document has that path.`);
  }
  return document;
}

export function refsFor(
  documentsByPath: Map<string, TokenDocument>,
  refs: readonly ResolverReference[],
): TokenDocument[] {
  return refs.map((ref) => requireDocument(documentsByPath, ref.$ref));
}
