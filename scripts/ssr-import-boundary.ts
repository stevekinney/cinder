/**
 * Shared constants for the browser-bound import-boundary invariant.
 *
 * Both `packages/editor/src/ssr-import.test.ts` and
 * `packages/components/src/components/markdown-editor/markdown-editor.import-boundary.test.ts`
 * enforce the same protected-package set. This module is the single source of
 * truth so both tests fail in sync when a new browser-bound package is added.
 *
 * Adding a new package: edit PROTECTED_PREFIXES here and both tests pick it up.
 */

/** Package-name prefixes whose runtime exports touch browser globals. */
export const PROTECTED_PREFIXES = ['@milkdown/', 'prosemirror-'] as const;

/**
 * The Milkdown prefix specifically. Editor test files use this directly
 * because they legitimately import prosemirror-* at the source level.
 */
export const MILKDOWN_PREFIX = '@milkdown/' as const;

/** Returns true if the given import specifier is from a protected package. */
export function isProtectedSpecifier(specifier: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => specifier.startsWith(prefix));
}
