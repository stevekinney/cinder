import type { CorpusEntry } from './corpus.ts';
import type { ValueResolver } from './resolve.ts';
import { findBareColorComponents, isWholeTokenAlias, resolveAlias } from './value-color.ts';
import { isAliasReference, serializeTypedValue } from './value-formatters.ts';

export function serializeEntryValue(
  entry: CorpusEntry,
  baseIndex: Map<string, CorpusEntry>,
  resolveReferences: ValueResolver = (raw) => raw,
): string {
  const serialized = serializeEntryValueUnchecked(entry, baseIndex, resolveReferences);
  if (entry.type === 'color') {
    const bare = findBareColorComponents(serialized);
    if (bare !== undefined) {
      throw new Error(
        `Color token at "${entry.path}" serializes to "${serialized}", whose color position ` +
          `"${bare}" is a bare component list rather than a complete CSS color. A bare triplet ` +
          'is an invalid declaration that the browser drops silently; author the token as a ' +
          'complete `light-dark()`/`color-mix()`/`oklch()` value instead (CIN-242).',
      );
    }
  }
  return serialized;
}

function serializeEntryValueUnchecked(
  entry: CorpusEntry,
  baseIndex: Map<string, CorpusEntry>,
  resolveReferences: ValueResolver,
): string {
  if (typeof entry.cssRecipe === 'string') return entry.cssRecipe;
  if (isAliasReference(entry.value)) {
    // An ordinary bare-alias `$value` has always been required to name a
    // WHOLE token here -- a deliberate restriction (see `wholeTokenIndexPath`'s
    // doc comment) -- so a miss still throws via `resolveAlias` below. `$ref`
    // is a generic JSON Pointer with no such requirement: a property-level
    // `$ref` (e.g. `#/dimension/hairline/$value/value`, aliasing one scalar
    // member of another token rather than the whole token) resolves fine at
    // `tokens:validate` time but is not a whole-token identity, so it falls
    // through to typed serialization instead, which resolves it (and any
    // further nested references) via `resolveReferences` and formats the
    // result per `entry.type` -- the same path an embedded property-level
    // reference inside a composite `$value` already takes.
    if (!entry.isRefAlias || isWholeTokenAlias(entry.value, baseIndex)) {
      return resolveAlias(entry.value, baseIndex);
    }
  }
  if (entry.type === undefined) {
    throw new Error(`Token at "${entry.path}" has no $type and no cssRecipe; cannot serialize.`);
  }
  return serializeTypedValue(entry.type, entry.value, entry.path, resolveReferences);
}
