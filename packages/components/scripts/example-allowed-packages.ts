/**
 * Import specifiers allowed inside published `.example.svelte` files.
 * Any import not starting with `cinder` and not listed here is a hard error.
 *
 * Rules:
 * - `cinder` exact and `cinder/<subpath>` are validated separately against the
 *   set of real subpaths emitted by `generate-exports.ts#discoverDirectoryComponents`.
 * - Packages listed here are allowed because realistic consumer apps would have
 *   them installed alongside cinder.
 *
 * Do NOT add playground-only or workspace-only packages here.
 */
export const ALLOWED_EXAMPLE_PACKAGES: readonly string[] = [
  'svelte',
  'svelte/elements',
  'svelte/attachments',
  'svelte/reactivity',
  // Typical consumer-supplied syntax highlighter for CodeBlock's `highlighter` prop.
  'shiki',
];
