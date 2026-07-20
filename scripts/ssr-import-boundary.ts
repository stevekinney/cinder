/**
 * Documented source of truth for the browser-bound import-boundary invariant
 * enforced by both `packages/commentary/src/editor/ssr-import.test.ts`
 * (formerly `packages/editor/src/ssr-import.test.ts`, migrated when
 * `@cinder/editor` was dissolved) and
 * `packages/components/src/components/markdown-editor/markdown-editor.import-boundary.test.ts`.
 *
 * Neither test imports this module directly — a repo-root `scripts/` import
 * sits outside both packages' `rootDir`, which `tsc` rejects (TS6059) once a
 * package typechecks its test files (as both do). Each test instead defines
 * its own copy of the relevant constant, with a comment pointing back here.
 * This module stays as the single documented definition; keeping both copies
 * in sync when a new browser-bound package is added is a manual step, not an
 * automated one.
 *
 * Adding a new package: edit PROTECTED_PREFIXES here, then update both
 * tests' local copies to match.
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
