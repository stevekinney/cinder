/**
 * Stable identity keys for composition branches in property-editor.
 *
 * Plain JSON branch values have no built-in identity. If we use the array
 * index as the {#each} key, removing a non-last branch makes Svelte diff by
 * index — surviving branches inherit the wrong PropertyEditor instance
 * (and its local $state). Each PropertyEditor instance keeps its own list
 * of branch keys parallel to the schema's branch array, and reconciles the
 * two lengths every render.
 */

/**
 * Reconcile a list of stable branch keys with the current branch count.
 *
 * - When branches are added beyond the existing key count, append fresh
 *   keys via `createKey()`.
 * - When branches are removed (count shrinks), truncate the keys array.
 * - When the count is unchanged, return the existing keys verbatim.
 *
 * @example
 * const keys = reconcileCompositionBranchKeys(['a'], 3, () => crypto.randomUUID());
 * // keys is now ['a', '<uuid-1>', '<uuid-2>']
 */
export function reconcileCompositionBranchKeys(
  existingKeys: string[],
  branchCount: number,
  createKey: () => string,
): string[] {
  // Return the same reference when no change is needed — callers that assign
  // the result back to $state won't trigger re-renders in that case.
  if (existingKeys.length === branchCount) return existingKeys;
  const nextKeys = existingKeys.slice(0, branchCount);
  while (nextKeys.length < branchCount) nextKeys.push(createKey());
  return nextKeys;
}
