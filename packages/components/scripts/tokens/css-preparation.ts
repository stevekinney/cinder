import { collectEntries, type CorpusEntry } from './corpus.ts';
import {
  assertResolutionOrderMatchesCssBlockStructure,
  assertUniqueCssProperties,
  assertUniqueOverrideCssProperties,
  refsFor,
} from './css-support.ts';
import { validateCssScopes } from './css-validation.ts';
import { createValueResolver, mergeAndExpandExtends } from './resolve.ts';
import {
  documentsForResolutionOrder,
  documentsForSystemMotionScope,
  modifierValuesForCombo,
  modifierValuesForContext,
} from './resolved-contexts.ts';
import type { ResolverDocument, TokenDocument } from './types.ts';
import { expandContextSources, parseResolutionOrder, sourcesForEntry } from './validate-corpus.ts';

export type CssPreparation = {
  baseIndex: any;
  baseResolveReferences: any;
  darkOverrides: any;
  lightOverrides: any;
  darkScopeIndex: any;
  lightScopeIndex: any;
  reducedMotionOverrides: any;
  forcedReducedMotionOverrides: any;
  systemReducedMotionScopeDocuments: any;
  systemForcedReducedMotionScopeDocuments: any;
  lightReducedMotionScopeIndex: any;
  darkReducedMotionScopeIndex: any;
  lightForcedReducedMotionScopeIndex: any;
  darkForcedReducedMotionScopeIndex: any;
  systemReducedMotionResolveReferences: any;
  systemForcedReducedMotionResolveReferences: any;
  lightResolveReferences: any;
  darkResolveReferences: any;
  lightReducedMotionResolveReferences: any;
  darkReducedMotionResolveReferences: any;
  lightForcedReducedMotionResolveReferences: any;
  darkForcedReducedMotionResolveReferences: any;
};

export function prepareCss(
  resolver: ResolverDocument,
  documentsByPath: Map<string, TokenDocument>,
): CssPreparation {
  assertResolutionOrderMatchesCssBlockStructure(resolver);
  // Every set the resolver orders, not just `foundation`. Naming one set here would
  // silently drop a second set's tokens from `:root` while the resolved snapshots --
  // which walk `resolutionOrder` -- still exposed them, and an override targeting one
  // would fail for want of a `baseIndex` entry.
  const baseDocuments = parseResolutionOrder(resolver)
    .filter((entry) => entry.kind === 'sets')
    .flatMap((entry) => refsFor(documentsByPath, sourcesForEntry(resolver, entry, {})));
  // `mergeAndExpandExtends` (rather than a bare merge) applies `$extends` group inheritance --
  // a locally overridden member that relies on the extended group's `$type`, and a member the
  // extending group never redefines at all -- before the raw tree is walked below. Reused from
  // resolve.ts's `buildTokenIndex` so this structural walk and `createValueResolver`'s alias
  // resolution (built from these same `baseDocuments` just below) agree on what `$extends`
  // expands to, matching what `tokens:validate` already accepts.
  const mergedBase = mergeAndExpandExtends(baseDocuments);
  const baseIndex = new Map<string, CorpusEntry>();
  collectEntries(mergedBase, '', undefined, baseIndex);

  // Resolves a reference nested inside a composite member (a shadow layer's `inset`, one
  // component of a color, ...) to its literal value, for base entries -- base has no
  // overriding context, so a resolver built from the base documents alone is correct here.
  const baseResolveReferences = createValueResolver(baseDocuments);
  assertUniqueCssProperties(baseIndex, baseIndex, baseResolveReferences);

  const defaultMotionContext = resolver.modifiers['motion']?.default;
  if (!defaultMotionContext) {
    throw new Error('resolver modifier "motion" must declare a default context');
  }
  const defaultMotionDocuments = refsFor(
    documentsByPath,
    expandContextSources(resolver, 'motion', defaultMotionContext),
  );
  const nonEmptyDefaultMotionDocuments = defaultMotionDocuments.filter((document) =>
    Object.keys(document).some((key) => key !== '$schema' && key !== '$description'),
  );
  if (nonEmptyDefaultMotionDocuments.length > 0) {
    throw new Error(
      'motion.default must not declare token overrides or group metadata; it must be empty apart ' +
        'from $schema and $description because tokens-base.css emits the canonical set values in :root',
    );
  }
  const defaultMotionEntries = new Map<string, CorpusEntry>();
  collectEntries(
    mergeAndExpandExtends(defaultMotionDocuments, [...baseDocuments, ...defaultMotionDocuments]),
    '',
    undefined,
    defaultMotionEntries,
  );
  if (defaultMotionEntries.size > 0) {
    throw new Error(
      `motion.default must not declare token overrides because tokens-base.css emits the ` +
        `canonical set values in :root: ${[...defaultMotionEntries.keys()].join(', ')}`,
    );
  }

  // `expandContextSources` (not a raw `resolver.modifiers['theme'].contexts[...]` read via
  // `refsFor`) -- a theme or motion context may itself list a
  // resolver-internal `#/sets/<name>` source rather than only plain document
  // `$ref`s, and that internal reference needs expanding to the document
  // `$ref`s it stands for before `refsFor`'s `requireDocument` lookup runs.
  // `requireDocument` looks for a literal ON-DISK document named
  // `#/sets/<name>` and throws otherwise, so a resolver `tokens:validate`
  // already accepts (`sourcesForEntry` in `validate-corpus.ts` expands the
  // identical reference for its own resolution-order walk) could not be
  // generated without this expansion happening here too.
  const lightDocuments = refsFor(documentsByPath, expandContextSources(resolver, 'theme', 'light'));
  const darkDocuments = refsFor(documentsByPath, expandContextSources(resolver, 'theme', 'dark'));
  // The `reduced` motion context backs the `prefers-reduced-motion` media
  // block and the `forced-reduced-motion` context backs the
  // `data-reduced-motion='on'` override -- two distinct resolver contexts,
  // matching the two distinct selectors below. They read identically today
  // only because `modes/motion-reduced.tokens.json` and
  // `modes/motion-forced-reduced.tokens.json` happen to hold the same
  // values; each block must still be built from its own context so the two
  // can diverge without silently mis-wiring the forced block to the
  // system-preference values.
  const reducedMotionDocuments = refsFor(
    documentsByPath,
    expandContextSources(resolver, 'motion', 'reduced'),
  );
  const forcedReducedMotionDocuments = refsFor(
    documentsByPath,
    expandContextSources(resolver, 'motion', 'forced-reduced-motion'),
  );

  // For EACH override context, "the documents in scope" are exactly what `resolutionOrder`
  // composes for it -- the base sets, then the theme document, then the motion document, in
  // resolver order -- with the ONE other modifier this block doesn't name filled from its own
  // declared default (`modifierValuesForContext`, the same default-fill `modifierValuesForCombo`
  // already applies for the resolved-context snapshots). This single composed scope feeds BOTH
  // `$extends` expansion just below (so an override's `$extends` can reach a foundation group
  // that the override document alone would never contain) and nested-reference resolution
  // further down (so a composite value's nested reference can see whichever other modifier's
  // document is in scope, not just the base) -- the same scope `tokens:validate` resolves for the
  // equivalent full combo, so the generator agrees with it in both places instead of composing
  // documents differently for structure than for lookup.
  const lightScopeDocuments = documentsForResolutionOrder(
    resolver,
    documentsByPath,
    modifierValuesForContext(resolver, 'theme', 'light'),
  );
  const darkScopeDocuments = documentsForResolutionOrder(
    resolver,
    documentsByPath,
    modifierValuesForContext(resolver, 'theme', 'dark'),
  );
  const reducedMotionScopeDocuments = documentsForResolutionOrder(
    resolver,
    documentsByPath,
    modifierValuesForContext(resolver, 'motion', 'reduced'),
  );
  const forcedReducedMotionScopeDocuments = documentsForResolutionOrder(
    resolver,
    documentsByPath,
    modifierValuesForContext(resolver, 'motion', 'forced-reduced-motion'),
  );

  // `mergeAndExpandExtends(ownDocuments, scopeDocuments)` still merges and returns only the
  // override's OWN documents (so this context's membership -- which tokens it actually overrides
  // -- and declaration order are unchanged from before), but now looks up `$extends` TARGETS
  // against the wider composed scope, so a theme or motion document's `$extends` can reach a
  // foundation group.
  const lightOverrides = new Map<string, CorpusEntry>();
  collectEntries(
    mergeAndExpandExtends(lightDocuments, lightScopeDocuments),
    '',
    undefined,
    lightOverrides,
  );
  const darkOverrides = new Map<string, CorpusEntry>();
  collectEntries(
    mergeAndExpandExtends(darkDocuments, darkScopeDocuments),
    '',
    undefined,
    darkOverrides,
  );
  const reducedMotionOverrides = new Map<string, CorpusEntry>();
  collectEntries(
    mergeAndExpandExtends(reducedMotionDocuments, reducedMotionScopeDocuments),
    '',
    undefined,
    reducedMotionOverrides,
  );
  const forcedReducedMotionOverrides = new Map<string, CorpusEntry>();
  collectEntries(
    mergeAndExpandExtends(forcedReducedMotionDocuments, forcedReducedMotionScopeDocuments),
    '',
    undefined,
    forcedReducedMotionOverrides,
  );

  // Per-block, not just once for `baseIndex`: `$extends` can legitimately give
  // two base paths the same `cssProperty` with identical base values, and a
  // theme or motion override can then explicitly diverge them to different
  // values -- see `assertUniqueOverrideCssProperties`'s docstring. Each
  // block's `scopeIndex` is the SAME fully composed scope already used for
  // `$extends` lookup and nested-reference resolution above (base plus
  // whichever other modifier's document this block's context implicitly
  // includes), so an unoverridden sibling's comparison value reflects any
  // OTHER modifier's override already baked into that scope, not just base.
  const lightScopeIndex = new Map<string, CorpusEntry>();
  collectEntries(mergeAndExpandExtends(lightScopeDocuments), '', undefined, lightScopeIndex);
  const darkScopeIndex = new Map<string, CorpusEntry>();
  collectEntries(mergeAndExpandExtends(darkScopeDocuments), '', undefined, darkScopeIndex);

  // Use the exact composed scope for uniqueness serialization as well as CSS
  // emission. This matters for nested/property references: resolving against
  // base-only (or the wrong modifier combination) can produce a different
  // emitted value while the renderer uses the composed scope.
  const lightResolveReferences = createValueResolver(lightScopeDocuments);
  const darkResolveReferences = createValueResolver(darkScopeDocuments);

  assertUniqueOverrideCssProperties(
    lightOverrides,
    baseIndex,
    lightScopeIndex,
    'theme.light',
    lightResolveReferences,
  );
  assertUniqueOverrideCssProperties(
    darkOverrides,
    baseIndex,
    darkScopeIndex,
    'theme.dark',
    darkResolveReferences,
  );
  // The motion blocks are emitted as a fixed `@media`/attribute selector that
  // applies regardless of which `[data-theme]` is active -- unlike theme
  // (which always cascades BEFORE motion, so a theme block's own internal
  // consistency never depends on which motion state is active), a motion
  // block's internal consistency must hold under EVERY theme it can combine
  // with at runtime. `reducedMotionScopeDocuments`/`forcedReducedMotionScopeDocuments`
  // above (used for `$extends` lookup and nested-reference resolution) compose
  // motion with the THEME axis defaulted to `resolver.modifiers.theme.default`
  // (`modifierValuesForContext`'s fill), which is 'light' in the corpus today
  // but is not schema-guaranteed to be -- an earlier version of this fix
  // wrongly assumed that default-filled scope WAS "light" and built only an
  // explicit "dark" counterpart to check alongside it, which would silently
  // validate the SAME theme twice (and leave light entirely unchecked) if
  // `theme.default` were ever changed to 'dark'. Build BOTH theme scopes
  // explicitly by name for the guard, instead of treating either as "whatever
  // the default happens to be".
  const lightReducedMotionScopeDocuments = documentsForResolutionOrder(
    resolver,
    documentsByPath,
    modifierValuesForCombo(resolver, {
      name: 'light-reduced-motion',
      theme: 'light',
      motion: 'reduced',
    }),
  );
  const lightReducedMotionScopeIndex = new Map<string, CorpusEntry>();
  collectEntries(
    mergeAndExpandExtends(lightReducedMotionScopeDocuments),
    '',
    undefined,
    lightReducedMotionScopeIndex,
  );
  const darkReducedMotionScopeDocuments = documentsForResolutionOrder(
    resolver,
    documentsByPath,
    modifierValuesForCombo(resolver, {
      name: 'dark-reduced-motion',
      theme: 'dark',
      motion: 'reduced',
    }),
  );
  const darkReducedMotionScopeIndex = new Map<string, CorpusEntry>();
  collectEntries(
    mergeAndExpandExtends(darkReducedMotionScopeDocuments),
    '',
    undefined,
    darkReducedMotionScopeIndex,
  );
  const lightForcedReducedMotionScopeDocuments = documentsForResolutionOrder(
    resolver,
    documentsByPath,
    modifierValuesForCombo(resolver, {
      name: 'light-forced-reduced-motion',
      theme: 'light',
      motion: 'forced-reduced-motion',
    }),
  );
  const lightForcedReducedMotionScopeIndex = new Map<string, CorpusEntry>();
  collectEntries(
    mergeAndExpandExtends(lightForcedReducedMotionScopeDocuments),
    '',
    undefined,
    lightForcedReducedMotionScopeIndex,
  );
  const darkForcedReducedMotionScopeDocuments = documentsForResolutionOrder(
    resolver,
    documentsByPath,
    modifierValuesForCombo(resolver, {
      name: 'dark-forced-reduced-motion',
      theme: 'dark',
      motion: 'forced-reduced-motion',
    }),
  );
  const darkForcedReducedMotionScopeIndex = new Map<string, CorpusEntry>();
  collectEntries(
    mergeAndExpandExtends(darkForcedReducedMotionScopeDocuments),
    '',
    undefined,
    darkForcedReducedMotionScopeIndex,
  );
  const lightReducedMotionResolveReferences = createValueResolver(lightReducedMotionScopeDocuments);
  const darkReducedMotionResolveReferences = createValueResolver(darkReducedMotionScopeDocuments);
  const lightForcedReducedMotionResolveReferences = createValueResolver(
    lightForcedReducedMotionScopeDocuments,
  );
  const darkForcedReducedMotionResolveReferences = createValueResolver(
    darkForcedReducedMotionScopeDocuments,
  );
  const systemReducedMotionScopeDocuments = documentsForSystemMotionScope(
    resolver,
    documentsByPath,
    'reduced',
  );
  const systemForcedReducedMotionScopeDocuments = documentsForSystemMotionScope(
    resolver,
    documentsByPath,
    'forced-reduced-motion',
  );
  const systemReducedMotionResolveReferences = createValueResolver(
    systemReducedMotionScopeDocuments,
  );
  const systemForcedReducedMotionResolveReferences = createValueResolver(
    systemForcedReducedMotionScopeDocuments,
  );
  validateCssScopes({
    baseIndex,
    baseResolveReferences,
    darkOverrides,
    lightOverrides,
    darkScopeIndex,
    lightScopeIndex,
    reducedMotionOverrides,
    forcedReducedMotionOverrides,
    systemReducedMotionScopeDocuments,
    systemForcedReducedMotionScopeDocuments,
    lightReducedMotionScopeIndex,
    darkReducedMotionScopeIndex,
    lightForcedReducedMotionScopeIndex,
    darkForcedReducedMotionScopeIndex,
    systemReducedMotionResolveReferences,
    systemForcedReducedMotionResolveReferences,
    lightResolveReferences,
    darkResolveReferences,
    lightReducedMotionResolveReferences,
    darkReducedMotionResolveReferences,
    lightForcedReducedMotionResolveReferences,
    darkForcedReducedMotionResolveReferences,
  });

  return {
    baseIndex,
    baseResolveReferences,
    darkOverrides,
    lightOverrides,
    darkScopeIndex,
    lightScopeIndex,
    reducedMotionOverrides,
    forcedReducedMotionOverrides,
    systemReducedMotionScopeDocuments,
    systemForcedReducedMotionScopeDocuments,
    lightReducedMotionScopeIndex,
    darkReducedMotionScopeIndex,
    lightForcedReducedMotionScopeIndex,
    darkForcedReducedMotionScopeIndex,
    systemReducedMotionResolveReferences,
    systemForcedReducedMotionResolveReferences,
    lightResolveReferences,
    darkResolveReferences,
    lightReducedMotionResolveReferences,
    darkReducedMotionResolveReferences,
    lightForcedReducedMotionResolveReferences,
    darkForcedReducedMotionResolveReferences,
  };
}
