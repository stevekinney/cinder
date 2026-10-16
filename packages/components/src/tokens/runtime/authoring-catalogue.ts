/**
 * Builds the token authoring catalogue: one record per public registry entry,
 * with per-context provenance, a CSS usage profile, and the edit / CSS-export /
 * DTCG-portability disposition.
 *
 * Takes `(resolver, documentsByPath)` rather than reading the disk, so a
 * fixture corpus feeds it exactly as the real one does. Reuses the registry's
 * base index and theme-awareness instead of re-walking the corpus, and the
 * provenance tracer instead of re-deriving evaluation.
 */

import { NO_PALETTE, paletteOf, validatePalettes } from './authoring-palette.ts';
import { PROFILES, selectProfile } from './authoring-profiles.ts';
import { collectCinderExtensions, traceProvenance } from './authoring-provenance.ts';
import {
  UNKNOWN,
  type AuthoringCatalogue,
  type AuthoringLayer,
  type AuthoringRecord,
  type ProvenanceVariant,
  type TokenContextProvenance,
  type TokenDisposition,
} from './authoring-types.ts';
import { authoringContexts, authoringLayerStack } from './context-stack.ts';
import type { CorpusEntry } from './corpus.ts';
import { buildBaseIndex, buildTokenRegistryFromIndexes, themeAwarePaths } from './registry.ts';
import { mergeAndExpandExtends } from './resolve.ts';
import type { ResolverDocument, TokenDocument } from './types.ts';

/** Scale name -> the token group whose public literal dimension members form it. */
export const DEFAULT_SCALE_GROUPS: Readonly<Record<string, string>> = {
  spacing: 'space',
  radius: 'radius',
};

export type CatalogueOptions = {
  scaleGroups?: Readonly<Record<string, string>>;
};

type Extensions = Record<string, unknown>;

function dispositionOf(
  path: string,
  entry: CorpusEntry,
  extensionsByContext: Extensions[],
): TokenDisposition {
  const flags = new Set(extensionsByContext.map((ext) => ext['nonRepresentableValue'] === true));
  if (flags.size > 1) {
    throw new Error(
      `Token "${path}" is css-only in some contexts and portable in others; nonRepresentableValue must be consistent.`,
    );
  }
  if (flags.has(true)) {
    if (typeof entry.cssRecipe !== 'string' || entry.cssRecipe.trim() === '') {
      throw new Error(`CSS-only token "${path}" carries no cssRecipe, so it has no CSS value.`);
    }
    return {
      edit: 'css-only',
      cssExport: 'supported',
      dtcgExport: 'none',
      cssSerialization: 'trusted-recipe',
      cssValue: entry.cssRecipe,
      reason:
        'The real CSS value has no faithful DTCG representation; the token is excluded from resolved contexts and portable export.',
    };
  }
  // A recipe belongs to the declaration that wins in a context: a theme override
  // that restates a literal value carries none, so recipes are judged per context.
  const withRecipe = extensionsByContext.filter(
    (ext) => typeof ext['cssRecipe'] === 'string' && ext['cssRecipe'].trim() !== '',
  ).length;
  if (withRecipe === extensionsByContext.length) {
    return {
      edit: 'recipe',
      cssExport: 'supported',
      dtcgExport: 'subset',
      cssSerialization: 'trusted-recipe',
      reason: 'The DTCG value is exported; the trusted CSS recipe that governs emission is not.',
    };
  }
  if (withRecipe > 0 || entry.cssRecipe !== undefined) {
    return {
      edit: 'supported',
      cssExport: 'supported',
      dtcgExport: 'subset',
      cssSerialization: 'mixed',
      reason:
        'Some contexts emit a trusted CSS recipe and others a typed value; the DTCG value is exported, the recipe is not.',
    };
  }
  return {
    edit: 'supported',
    cssExport: 'supported',
    dtcgExport: 'complete',
    cssSerialization: 'typed-value',
  };
}

/**
 * Reads the scale membership the corpus declares and checks it against the
 * group it is defined over: every public literal dimension member of the group
 * is marked, every mark sits on such a member, and each appears exactly once.
 */
function collectScales(
  baseIndex: ReadonlyMap<string, CorpusEntry>,
  baseExtensions: ReadonlyMap<string, Extensions>,
  scaleGroups: Readonly<Record<string, string>>,
): Record<string, string[]> {
  const scales: Record<string, string[]> = {};
  const claimed = new Map<string, string>();
  for (const [path, extensions] of baseExtensions) {
    const scale = extensions['scale'];
    if (scale === undefined) continue;
    if (typeof scale !== 'string' || scaleGroups[scale] === undefined) {
      const shown = typeof scale === 'string' ? scale : JSON.stringify(scale);
      throw new Error(`Token "${path}" declares unknown scale "${shown}".`);
    }
    claimed.set(path, scale);
  }
  for (const [scale, group] of Object.entries(scaleGroups)) {
    const members: string[] = [];
    for (const entry of baseIndex.values()) {
      const inGroup =
        entry.path.startsWith(`${group}.`) && !entry.path.slice(group.length + 1).includes('.');
      const marked = claimed.get(entry.path) === scale;
      const literalDimension =
        entry.public === true && entry.type === 'dimension' && typeof entry.value !== 'string';
      if (marked && !(inGroup && literalDimension)) {
        throw new Error(
          `Scale "${scale}" member "${entry.path}" is not a public literal dimension in group "${group}".`,
        );
      }
      if (inGroup && literalDimension && !marked) {
        throw new Error(
          `Public literal dimension "${entry.path}" in group "${group}" lacks scale "${scale}" metadata.`,
        );
      }
      if (marked) members.push(entry.path);
    }
    scales[scale] = members;
  }
  return scales;
}

/** Builds the catalogue for a loaded corpus. */
export function buildAuthoringCatalogue(
  resolver: ResolverDocument,
  documentsByPath: Map<string, TokenDocument>,
  options: CatalogueOptions = {},
): AuthoringCatalogue {
  const baseIndex = buildBaseIndex(resolver, documentsByPath);
  const registry = buildTokenRegistryFromIndexes(
    baseIndex,
    themeAwarePaths(resolver, documentsByPath),
  );
  const contexts = authoringContexts(resolver);
  const stacks = new Map(
    contexts.map((c) => [c.id, authoringLayerStack(resolver, documentsByPath, c)]),
  );
  const traced = new Map(
    [...stacks].map(([id, stack]) => [
      id,
      traceProvenance(stack, { cssPropertyToPath: registry.cssPropertyToPath }),
    ]),
  );
  const extensions = new Map(
    [...stacks].map(([id, stack]) => [
      id,
      collectCinderExtensions(mergeAndExpandExtends(stack.map((layer) => layer.content))),
    ]),
  );
  const scales = collectScales(
    baseIndex,
    new Map(
      [...baseIndex.keys()].map((path) => [path, extensions.get(contexts[0]!.id)!.get(path) ?? {}]),
    ),
    options.scaleGroups ?? DEFAULT_SCALE_GROUPS,
  );
  const scaleOf = new Map(
    Object.entries(scales).flatMap(([scale, members]) => members.map((m) => [m, scale] as const)),
  );

  const records: AuthoringRecord[] = [];
  const usedProfiles = new Set<string>();
  for (const entry of registry.entries) {
    // Private runtime variables are not part of the authoring surface.
    if (!entry.public || !entry.cssProperty.startsWith('--cinder-')) continue;
    const base = baseIndex.get(entry.path)!;
    const profile = selectProfile({
      path: entry.path,
      type: base.type,
      category: entry.category,
      hasRecipe: base.cssRecipe !== undefined,
    });
    usedProfiles.add(profile.id);
    const variants: ProvenanceVariant[] = [];
    const byKey = new Map<string, ProvenanceVariant>();
    for (const context of contexts) {
      const provenance: TokenContextProvenance | undefined = traced
        .get(context.id)!
        .get(entry.path);
      if (!provenance) {
        throw new Error(`Token "${entry.path}" is not defined in context ${context.id}.`);
      }
      const key = JSON.stringify(provenance);
      const existing = byKey.get(key);
      if (existing) existing.contexts.push(context.id);
      else {
        const variant = { contexts: [context.id], provenance };
        byKey.set(key, variant);
        variants.push(variant);
      }
    }
    const scale = scaleOf.get(entry.path);
    const palette = paletteOf(
      entry.path,
      contexts.map((c) => extensions.get(c.id)!.get(entry.path) ?? {}),
    );
    if (palette !== undefined && base.type !== 'color') {
      throw new Error(`Token "${entry.path}" declares a palette but is not a color.`);
    }
    records.push({
      path: entry.path,
      cssProperty: entry.cssProperty,
      category: entry.category ?? UNKNOWN,
      component: entry.component ?? null,
      description: entry.description ?? UNKNOWN,
      themeAware: entry.themeAware,
      deprecated: entry.deprecated,
      profile: profile.id,
      ...(scale ? { scale } : {}),
      ...(base.type === 'color' ? { palette: palette ?? NO_PALETTE } : {}),
      disposition: dispositionOf(
        entry.path,
        base,
        contexts.map((c) => extensions.get(c.id)!.get(entry.path) ?? {}),
      ),
      variants,
    });
  }

  validatePalettes(records);

  const layerStacks: Record<string, AuthoringLayer[]> = {};
  for (const [id, stack] of stacks)
    layerStacks[id] = stack.map(({ document, kind, layer }) => ({ document, kind, layer }));
  return {
    version: 1,
    dtcgVersion: '2025.10',
    contexts: contexts.map(({ id, theme, motion }) => ({ id, theme, motion })),
    layerStacks,
    profiles: Object.fromEntries([...usedProfiles].toSorted().map((id) => [id, PROFILES[id]!])),
    scales,
    records,
  };
}
