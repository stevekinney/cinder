/**
 * Parse the optional `CINDER_TEST_COMPONENTS` allow-list and validate it
 * against the manifest. Used by `tests/components.spec.ts` to scope the
 * Playwright matrix when CI has narrowed the run to specific components.
 *
 * Behavior:
 *
 *   - `null` or `undefined` raw value → no filter; the full matrix runs.
 *   - empty / whitespace-only value → no filter; the full matrix runs.
 *     (CI emits an empty string when the scope job decided `mode=full`;
 *     treating it as "run everything" keeps the spec's contract simple.)
 *   - one or more comma-separated slugs → run only those entries.
 *   - any slug not present in the manifest → throws synchronously so the
 *     suite fails loudly rather than silently skipping coverage.
 */

export type ComponentEntryLike = { readonly slug: string };

/**
 * Parses the comma-separated component-scope grammar shared by browser tests,
 * update scripts, and CI dispatch inputs. This function only normalizes shape:
 * callers that know the manifest should pass the result through
 * `parseComponentFilter()` so unknown slugs fail loudly.
 */
export function parseComponentScopeValue(rawValue: string | undefined): string[] {
  if (rawValue === undefined) return [];

  return [
    ...new Set(
      rawValue
        .split(',')
        .map((slug) => slug.trim())
        .filter((slug) => slug.length > 0),
    ),
  ].toSorted();
}

/**
 * Parse + validate the raw env-var value. Pure function for unit testing;
 * the spec file calls this with `process.env['CINDER_TEST_COMPONENTS']`.
 */
export function parseComponentFilter(
  rawValue: string | undefined,
  knownSlugs: ReadonlySet<string>,
): ReadonlySet<string> | null {
  const parsedSlugs = parseComponentScopeValue(rawValue);
  if (parsedSlugs.length === 0) return null;

  const unknown = parsedSlugs.filter((slug) => !knownSlugs.has(slug));
  if (unknown.length > 0) {
    throw new Error(
      `CINDER_TEST_COMPONENTS references unknown component slugs: ${unknown
        .toSorted()
        .join(', ')}. Known slugs: ${[...knownSlugs].toSorted().join(', ')}.`,
    );
  }

  return new Set(parsedSlugs);
}

/**
 * Apply a parsed filter to the manifest entries. Returns the full list when
 * the filter is `null`, otherwise the entries whose slug is in the filter.
 */
export function applyComponentFilter<Entry extends ComponentEntryLike>(
  entries: readonly Entry[],
  filter: ReadonlySet<string> | null,
): readonly Entry[] {
  if (filter === null) return entries;
  return entries.filter((entry) => filter.has(entry.slug));
}
