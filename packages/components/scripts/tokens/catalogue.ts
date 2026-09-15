/** Private, generated authoring catalogue for the theme builder.
 *
 * This module deliberately composes the existing registry and resolver. It is
 * generation-side data: CIN-572 will share its evaluator with the browser.
 * Unknown source metadata remains explicit instead of being inferred
 * from names or DTCG types.
 */

import {
  modifierValuesForCombo,
  requireDocument,
  serializeEntryValue,
  type CorpusEntry,
} from './generate.ts';
import { buildBaseIndex, buildTokenRegistryFromIndexes, themeAwarePaths } from './registry.ts';
import { resolveDocumentsWithTrace } from './resolve.ts';
import type {
  ResolverSourceLocation,
  ResolverTokenTrace,
  ResolverTraceDependency,
} from './trace.ts';
import type { DesignToken, ResolverDocument, TokenDocument, TokenType } from './types.ts';
import {
  PROFILE_DEFINITIONS,
  validateUsageContracts,
  type TokenUsageMetadata,
  type UsageProfile,
  type UsageToken,
} from './usage-contracts.ts';
import { normalizeSourcePath, parseResolutionOrder, sourcesForEntry } from './validate-corpus.ts';

export const THEME_CONTEXTS = [
  { theme: 'light', motion: 'default' },
  { theme: 'light', motion: 'reduced' },
  { theme: 'light', motion: 'forced-reduced-motion' },
  { theme: 'dark', motion: 'default' },
  { theme: 'dark', motion: 'reduced' },
  { theme: 'dark', motion: 'forced-reduced-motion' },
] as const;

export type CatalogueDisposition = {
  status: 'supported' | 'omitted' | 'unknown';
  reason: string | null;
  value: unknown;
};

export type CatalogueContextRecord = {
  context: { theme: string; motion: string };
  winningLocation: ResolverSourceLocation | null;
  contributingLocations: readonly ResolverSourceLocation[];
  effectiveType: TokenType | null;
  typeOrigin: ResolverSourceLocation | null;
  directDependencies: readonly ResolverTraceDependency[];
  recipeInputs: readonly string[];
  resolvedValue: unknown;
};

export type ThemeTokenCatalogueEntry = {
  path: string;
  cssProperty: string;
  category: string | null;
  component: string | null;
  public: true;
  sourceType: TokenType | null;
  usageContracts: readonly { property: string; profile: string }[];
  observedProperties: readonly string[];
  scale: 'spacing' | null;
  source: CatalogueDisposition;
  css: CatalogueDisposition;
  completePortable: CatalogueDisposition;
  subsetPortable: CatalogueDisposition;
  contexts: readonly CatalogueContextRecord[];
};

export type ThemeTokenCatalogue = {
  version: 1;
  profileDefinitions: Readonly<Record<string, UsageProfile>>;
  entries: readonly ThemeTokenCatalogueEntry[];
};

function sourceType(entry: CorpusEntry): TokenType | null {
  return entry.type ?? null;
}

function contextApplications(
  resolver: ResolverDocument,
  documentsByPath: Map<string, TokenDocument>,
  theme: string,
  motion: string,
): { documents: TokenDocument[]; identities: string[] } {
  const modifierValues = modifierValuesForCombo(resolver, {
    name: `${theme}-${motion}`,
    theme,
    motion,
  });
  const sources = parseResolutionOrder(resolver).flatMap((entry) =>
    sourcesForEntry(resolver, entry, modifierValues),
  );
  return {
    documents: sources.map((source) => requireDocument(documentsByPath, source.$ref)),
    identities: sources.map((source) => normalizeSourcePath(source.$ref)),
  };
}

function usageTokens(resolved: Record<string, DesignToken>): UsageToken[] {
  const tokens: UsageToken[] = [];
  for (const [path, token] of Object.entries(resolved)) {
    const metadata = token.$extensions?.['com.lostgradient.cinder'];
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) continue;
    if (!('public' in metadata) || metadata.public !== true) continue;
    if (!('cssProperty' in metadata) || typeof metadata.cssProperty !== 'string')
      throw new Error(`${path}: public token is missing its CSS property`);
    tokens.push({
      path,
      cssProperty: metadata.cssProperty,
      type: token.$type,
      value: token.$value,
      metadata,
    });
  }
  return tokens;
}

export function buildThemeTokenCatalogue(
  resolver: ResolverDocument,
  documentsByPath: Map<string, TokenDocument>,
  observedProperties: ReadonlyMap<string, readonly string[]> = new Map(),
): ThemeTokenCatalogue {
  const baseIndex = buildBaseIndex(resolver, documentsByPath);
  const registry = buildTokenRegistryFromIndexes(
    baseIndex,
    themeAwarePaths(resolver, documentsByPath),
  );
  const ids = new Map<TokenDocument, string>();
  for (const [id, document] of documentsByPath) ids.set(document, id);
  // Resolve each concrete context once. Registry entries are projections of a
  // context result; resolving inside the entry loop made the entire corpus
  // run once per token and also gave provenance consumers no stable context
  // boundary to reuse.
  const contextResults = new Map<
    string,
    {
      traces: ReadonlyMap<string, ResolverTokenTrace>;
      resolved: Record<string, DesignToken>;
      usage: ReadonlyMap<string, TokenUsageMetadata>;
    }
  >();
  for (const { theme, motion } of THEME_CONTEXTS) {
    const { documents, identities } = contextApplications(resolver, documentsByPath, theme, motion);
    const traced = resolveDocumentsWithTrace(documents, ids, identities);
    contextResults.set(`${theme}:${motion}`, {
      traces: traced.traces,
      resolved: traced.resolved,
      usage: validateUsageContracts(usageTokens(traced.resolved), observedProperties),
    });
  }
  const entries = registry.entries
    .filter((entry) => entry.public)
    .map((registryEntry) => {
      const entry = baseIndex.get(registryEntry.path);
      if (!entry) throw new Error(`Registry entry ${registryEntry.path} has no catalogue source`);
      const contexts = THEME_CONTEXTS.map(({ theme, motion }) => {
        const contextResult = contextResults.get(`${theme}:${motion}`)!;
        const trace = contextResult.traces.get(registryEntry.path);
        const resolved = contextResult.resolved[registryEntry.path];
        const usage = contextResult.usage.get(registryEntry.path);
        if (!usage)
          throw new Error(
            `${registryEntry.path}: missing authoring usage contract for ${theme}:${motion}`,
          );
        const value = resolved?.$value ?? entry.value;
        const recipeInputs = usage.recipeInputs;
        const recipeDependencies: ResolverTraceDependency[] = recipeInputs.map((targetPath) => {
          if (!trace)
            throw new Error(`${registryEntry.path}: trusted recipe has no source provenance`);
          const target = contextResult.traces.get(targetPath)?.winningLocation;
          if (!target)
            throw new Error(
              `${registryEntry.path}: recipe input ${targetPath} has no source provenance`,
            );
          return {
            kind: 'recipe',
            source: {
              ...trace.winningLocation,
              sourcePointer: `${trace.winningLocation.sourcePointer}/$extensions/com.lostgradient.cinder/cssRecipe`,
            },
            targetPath,
            target,
          };
        });
        return {
          context: { theme, motion },
          winningLocation: trace?.winningLocation ?? null,
          contributingLocations: trace?.contributingLocations ?? [],
          effectiveType: resolved?.$type ?? entry.type ?? null,
          typeOrigin: trace?.typeOrigin ?? null,
          directDependencies: [...(trace?.directDependencies ?? []), ...recipeDependencies],
          recipeInputs,
          resolvedValue: value,
        };
      });
      const firstContext = contextResults.get('light:default')!;
      const usage = firstContext.usage.get(registryEntry.path)!;
      const portabilityFailures = THEME_CONTEXTS.flatMap(({ theme, motion }) => {
        const reason = contextResults
          .get(`${theme}:${motion}`)!
          .usage.get(registryEntry.path)!.portabilityReason;
        return reason === null ? [] : [`${theme}:${motion}: ${reason}`];
      });
      if (
        usage.scale &&
        (entry.isRefAlias ||
          typeof entry.value !== 'object' ||
          entry.value === null ||
          Array.isArray(entry.value))
      )
        throw new Error(`${entry.path}: spacing scale requires an authored literal dimension`);
      const portable: CatalogueDisposition = portabilityFailures.length
        ? { status: 'omitted', reason: portabilityFailures.join('; '), value: null }
        : {
            status: 'supported',
            reason: null,
            value: firstContext.resolved[registryEntry.path]?.$value,
          };
      return {
        path: registryEntry.path,
        cssProperty: registryEntry.cssProperty,
        category: registryEntry.category ?? null,
        component: registryEntry.component ?? null,
        public: true as const,
        sourceType: sourceType(entry),
        usageContracts: usage.usageContracts,
        observedProperties: [...(observedProperties.get(registryEntry.cssProperty) ?? [])].sort(),
        scale: usage.scale,
        source: { status: 'supported' as const, reason: null, value: entry.value },
        css: {
          status: 'supported' as const,
          reason: null,
          value: serializeEntryValue(entry, baseIndex),
        },
        completePortable: portable,
        subsetPortable: { ...portable },
        contexts,
      };
    });
  return { version: 1, profileDefinitions: PROFILE_DEFINITIONS, entries };
}
