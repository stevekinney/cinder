/**
 * A saved theme as runtime sources.
 *
 * A Cinder Theme v1 envelope embeds an immutable Cinder base (resolver and documents) and
 * five override trees. The overrides are DTCG documents appended to the resolver's own
 * source lists, so layering is the resolver's and is never reimplemented: shared overrides
 * join the first set, `light`/`dark` join the theme contexts, and `reduced`/`forcedReduced`
 * join the motion contexts. The theme builder and a consumer that loads a saved envelope
 * compose sources through this one function.
 */

import { AUTHORING_CATALOGUE } from './authoring-catalogue.generated.ts';
import { authoringLayerStack } from './context-stack.ts';
import type { ThemeSources } from './evaluate.ts';
import { mergeDocuments } from './resolve.ts';
import type { ResolverDocument, TokenDocument } from './types.ts';

/** Where each override scope's document lives in the resolver. */
export const OVERRIDE_DOCUMENTS = {
  shared: 'overrides/shared.tokens.json',
  light: 'overrides/light.tokens.json',
  dark: 'overrides/dark.tokens.json',
  reduced: 'overrides/reduced.tokens.json',
  forcedReduced: 'overrides/forced-reduced-motion.tokens.json',
} as const;

export type OverrideScopeName = keyof typeof OVERRIDE_DOCUMENTS;

/** The part of an envelope the runtime needs; the playground's envelope type satisfies it. */
export type ThemeSourceEnvelope = {
  base: { resolver: unknown; documents: Readonly<Record<string, unknown>> };
  overrides: Readonly<Record<OverrideScopeName, unknown>>;
};

type SourceList = Array<{ $ref: string }>;
type ResolverShape = {
  sets: Record<string, { sources: SourceList }>;
  modifiers: Record<string, { contexts: Record<string, SourceList> }>;
  resolutionOrder: Array<{ $ref: string }>;
};

function append(list: SourceList | undefined, path: string): void {
  list?.push({ $ref: path });
}

/** The first set in resolution order: the base set the shared overrides follow. */
function firstSetName(resolver: ResolverShape): string | undefined {
  const entry = resolver.resolutionOrder.find((reference) => reference.$ref.startsWith('#/sets/'));
  return entry?.$ref.slice('#/sets/'.length);
}

/** The envelope as runtime sources: the embedded base with the override documents inserted. */
export function buildThemeSources(envelope: ThemeSourceEnvelope, revision: number): ThemeSources {
  // The sources are validated by the caller before they are evaluated; this only appends refs.
  // eslint-disable-next-line no-unsafe-type-assertion
  const resolver = structuredClone(envelope.base.resolver) as ResolverShape;
  append(resolver.sets[firstSetName(resolver) ?? '']?.sources, OVERRIDE_DOCUMENTS.shared);
  const theme = resolver.modifiers['theme']?.contexts;
  append(theme?.['light'], OVERRIDE_DOCUMENTS.light);
  append(theme?.['dark'], OVERRIDE_DOCUMENTS.dark);
  const motion = resolver.modifiers['motion']?.contexts;
  append(motion?.['reduced'], OVERRIDE_DOCUMENTS.reduced);
  append(motion?.['forced-reduced-motion'], OVERRIDE_DOCUMENTS.forcedReduced);
  return {
    revision,
    resolver,
    documents: {
      ...envelope.base.documents,
      [OVERRIDE_DOCUMENTS.shared]: envelope.overrides.shared,
      [OVERRIDE_DOCUMENTS.light]: envelope.overrides.light,
      [OVERRIDE_DOCUMENTS.dark]: envelope.overrides.dark,
      [OVERRIDE_DOCUMENTS.reduced]: envelope.overrides.reduced,
      [OVERRIDE_DOCUMENTS.forcedReduced]: envelope.overrides.forcedReduced,
    },
  };
}

const cssPropertyByPath = new Map(
  AUTHORING_CATALOGUE.records.map((record) => [record.path, record.cssProperty] as const),
);

/**
 * Lay CSS-only edits (public token path, then concrete context, then value) over a projected
 * context. They win over everything. A path outside the public registry is ignored, and
 * `accept` lets the caller apply a stricter value check than the stylesheet's own.
 */
export function applyCssOnlyOverrides(
  properties: Readonly<Record<string, string>>,
  cssOverrides: Readonly<Record<string, Readonly<Record<string, string | undefined>>>>,
  context: string,
  accept: (value: string) => boolean = () => true,
): Record<string, string> {
  const merged: Record<string, string> = { ...properties };
  for (const [path, byContext] of Object.entries(cssOverrides)) {
    const value = byContext[context];
    const property = cssPropertyByPath.get(path);
    if (value !== undefined && property !== undefined && accept(value)) merged[property] = value;
  }
  return merged;
}

/**
 * The token document one concrete context resolves to: its ordered documents merged the way
 * evaluation merges them, with aliases, `$extends`, descriptions and extensions still in
 * place. Nothing is flattened or evaluated. The sources must already have passed validation.
 */
export function mergedContextDocument(
  sources: ThemeSources,
  context: { theme: string; motion: string },
): TokenDocument {
  // The sources must already have passed validation, which checks every document.
  // eslint-disable-next-line no-unsafe-type-assertion
  const documents = new Map(Object.entries(sources.documents) as Array<[string, TokenDocument]>);
  // eslint-disable-next-line no-unsafe-type-assertion
  const layers = authoringLayerStack(sources.resolver as ResolverDocument, documents, {
    id: `${context.theme}/${context.motion}`,
    theme: context.theme,
    motion: context.motion,
  });
  return mergeDocuments(layers.map((layer) => layer.content));
}
