/**
 * Shared constants for the browser-bound import-boundary invariant.
 *
 * `packages/editor/src/ssr-import.test.ts` imports MILKDOWN_PREFIX directly.
 *
 * `packages/components/src/components/markdown-editor/markdown-editor.import-boundary.test.ts`
 * cannot import from this file (TypeScript rootDir constraint: the components package
 * sets rootDir to packages/components, and scripts/ is outside that tree). That test
 * defines PROTECTED_PREFIXES inline and references this file in a comment.
 *
 * To add a new protected package:
 *   1. Add the prefix to PROTECTED_PREFIXES here.
 *   2. Also update the inline PROTECTED_PREFIXES in markdown-editor.import-boundary.test.ts.
 */

/** The full set of package-name prefixes whose runtime exports touch browser globals. */
export const PROTECTED_PREFIXES = ['@milkdown/', 'prosemirror-'] as const;

/**
 * The Milkdown prefix specifically. Used by the editor package's ssr-import.test.ts
 * because that test cannot use PROTECTED_PREFIXES directly — prosemirror-* is a
 * legitimate static import in the editor source (the editor IS the browser-side layer).
 */
export const MILKDOWN_PREFIX = '@milkdown/' as const;
