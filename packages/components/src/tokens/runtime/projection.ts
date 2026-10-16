/**
 * Typed and trusted-recipe CSS projection for one evaluation context.
 *
 * Given the ordered documents of a context, this reports the value every public
 * `--cinder-*` custom property has there, written in the same syntax the
 * generated stylesheet uses (a whole-token alias stays `var(--cinder-...)`, a
 * trusted `cssRecipe` is emitted verbatim, a typed value is serialized). It is
 * the generator's own serializer (`serializeEntryValue`) applied to the
 * context's merged tokens, so the browser and `tokens-base.css` cannot disagree
 * about what a token means.
 *
 * A value that cannot be projected is reported, never skipped or replaced with
 * a fallback: the caller gets a path-addressed failure and no property map.
 */

import { scopeIndexFromDocuments } from './context-order.ts';
import type { CorpusEntry } from './corpus.ts';
import { createValueResolver } from './resolve.ts';
import type { TokenDocument } from './types.ts';
import { serializeEntryValue } from './value-entry.ts';

/** Public custom property -> CSS value, with keys in code-unit order. */
export type PropertyMap = Readonly<Record<string, string>>;

export type ProjectionFailure = { path: string; reason: string };

/** Whether a token belongs to the public `--cinder-*` surface. */
export function isPublicEntry(entry: CorpusEntry): boolean {
  return (
    entry.public === true &&
    typeof entry.cssProperty === 'string' &&
    entry.cssProperty.startsWith('--cinder-')
  );
}

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  return left > right ? 1 : 0;
}

/**
 * Projects a context to its public property map. Private `--_cinder-*` runtime
 * variables and tokens with no `cssProperty` never appear in the output.
 */
export function projectProperties(
  documents: readonly TokenDocument[],
  index: Map<string, CorpusEntry> = scopeIndexFromDocuments(documents),
): { properties: PropertyMap; failures: ProjectionFailure[] } {
  const resolveReferences = createValueResolver([...documents]);
  const projected: Array<[string, string]> = [];
  const failures: ProjectionFailure[] = [];
  for (const entry of index.values()) {
    if (!isPublicEntry(entry) || entry.cssProperty === undefined) continue;
    try {
      projected.push([entry.cssProperty, serializeEntryValue(entry, index, resolveReferences)]);
    } catch (error) {
      failures.push({
        path: entry.path,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  projected.sort(([left], [right]) => compareCodeUnits(left, right));
  return { properties: Object.fromEntries(projected), failures };
}
