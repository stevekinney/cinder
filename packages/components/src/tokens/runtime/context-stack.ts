/**
 * The six concrete evaluation contexts of the Cinder profile (`light|dark` by
 * `default|reduced|forced-reduced-motion`) and the ordered document stack each
 * one resolves. Shared by the authoring catalogue and by runtime evaluation so
 * both walk exactly the same layers.
 */

import type { ProvenanceLayerInput } from './authoring-provenance.ts';
import { authoringContextId, type AuthoringContext } from './authoring-types.ts';
import { requireDocument } from './context-order.ts';
import {
  combinations,
  normalizeSourcePath,
  parseResolutionOrder,
  sourcesForEntry,
} from './resolver-order.ts';
import type { ResolverDocument, TokenDocument } from './types.ts';

export function authoringContexts(
  resolver: ResolverDocument,
): Array<AuthoringContext & Record<string, string>> {
  const modifiers = Object.keys(resolver.modifiers);
  if (!modifiers.includes('theme') || !modifiers.includes('motion') || modifiers.length !== 2) {
    throw new Error(
      `The authoring catalogue is defined over the "theme" and "motion" modifiers; this resolver declares ${modifiers.join(', ')}.`,
    );
  }
  return combinations(resolver).map((selection) => ({
    id: authoringContextId(selection['theme']!, selection['motion']!),
    theme: selection['theme']!,
    motion: selection['motion']!,
  }));
}

export function authoringLayerStack(
  resolver: ResolverDocument,
  documentsByPath: Map<string, TokenDocument>,
  context: AuthoringContext,
): ProvenanceLayerInput[] {
  const modifierValues: Record<string, string> = { theme: context.theme, motion: context.motion };
  return parseResolutionOrder(resolver).flatMap((entry) =>
    sourcesForEntry(resolver, entry, modifierValues).map((reference) => ({
      document: normalizeSourcePath(reference.$ref),
      kind: entry.kind === 'sets' ? ('set' as const) : ('modifier' as const),
      layer:
        entry.kind === 'sets'
          ? `sets.${entry.name}`
          : `${entry.name}.${modifierValues[entry.name]}`,
      content: requireDocument(documentsByPath, reference.$ref),
    })),
  );
}
