/**
 * Recursively sort object keys for consistent comparison and serialization.
 *
 * This utility is used to ensure deterministic ordering of object keys,
 * which is important for:
 * - Comparing objects for equality via JSON.stringify
 * - Generating consistent YAML output
 * - Avoiding false positives in diff comparisons
 *
 * @param obj - The value to sort (objects have keys sorted recursively)
 * @returns The value with all object keys sorted alphabetically
 *
 * @example
 * ```ts
 * const obj = { z: 1, a: { y: 2, b: 3 } };
 * sortKeys(obj); // { a: { b: 3, y: 2 }, z: 1 }
 * ```
 */
export function sortKeys(obj: unknown): unknown {
  // Preserve arrays as arrays, recursing into each element
  if (Array.isArray(obj)) {
    return obj.map((item) => sortKeys(item));
  }

  // For non-null objects, sort keys and recurse into values
  if (obj !== null && typeof obj === 'object') {
    const entries = Object.entries(obj)
      .map(([key, value]: [string, unknown]) => [key, sortKeys(value)] as const)
      .toSorted(([a]: readonly [string, unknown], [b]: readonly [string, unknown]) =>
        a < b ? -1 : a > b ? 1 : 0,
      );

    return Object.fromEntries(entries);
  }

  // Primitives and all other types are returned as-is
  return obj;
}
