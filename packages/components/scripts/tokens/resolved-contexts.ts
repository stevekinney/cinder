import { format } from 'prettier';
import { assertPrettierResolvesToRoot } from '../lib/prettier-resolution.ts';
import { cinderExtensions, collectEntries, type CorpusEntry } from './corpus.ts';
import { refsFor } from './css-support.ts';
import { JSON_PLUGINS, PRETTIER_OPTIONS } from './generator-configuration.ts';
import { mergeAndExpandExtends, resolveDocuments } from './resolve.ts';
import type { ResolverDocument, TokenDocument } from './types.ts';
import { parseResolutionOrder, sourcesForEntry } from './validate-corpus.ts';

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

export async function buildResolvedContexts(
  resolver: ResolverDocument,
  documentsByPath: Map<string, TokenDocument>,
): Promise<Map<string, string>> {
  const themeModifier = resolver.modifiers['theme']!;
  const motionModifier = resolver.modifiers['motion']!;

  const outputs = new Map<string, string>();
  for (const combo of RESOLVED_CONTEXT_COMBOS) {
    const themeContext = themeModifier.contexts[combo.theme];
    const motionContext = motionModifier.contexts[combo.motion];
    if (!themeContext || !motionContext) {
      throw new Error(
        `Resolver has no "${combo.theme}"/"${combo.motion}" context for "${combo.name}".`,
      );
    }
    const modifierValues = modifierValuesForCombo(resolver, combo);
    const documents = documentsForResolutionOrder(resolver, documentsByPath, modifierValues);
    const resolved = resolveDocuments(documents);
    // A token whose `$value` cannot honestly represent its real CSS value in
    // DTCG's type system (e.g. `auto`, a bare `16 / 9` ratio, `currentColor`)
    // carries `nonRepresentableValue` in its extension data -- `cssRecipe`
    // governs its real CSS emission (tokens-base.css) and registry coverage
    // (registry.generated.json, which never publishes a raw `$value`), but a
    // generic DTCG consumer of THESE resolved-context JSON files has no way
    // to know `$value` here is a placeholder rather than the real resolved
    // value, and applying it literally actively breaks (e.g. `0rem` collapses
    // a block that should size to its content). Omit these paths from the
    // published resolved-context artifacts entirely rather than publish a
    // value known to be wrong.
    for (const path of Object.keys(resolved)) {
      if (cinderExtensions(resolved[path]!)?.['nonRepresentableValue'] === true) {
        delete resolved[path];
      }
    }
    assertPrettierResolvesToRoot();
    const json = await format(JSON.stringify(resolved), {
      ...PRETTIER_OPTIONS,
      parser: 'json',
      plugins: JSON_PLUGINS,
    });
    outputs.set(combo.name, json);
  }
  return outputs;
}

// ---------------------------------------------------------------------------
