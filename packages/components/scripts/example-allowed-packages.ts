/**
 * Import specifiers allowed inside published `.example.svelte` files.
 * Any import not starting with `@lostgradient/cinder` and not listed here is a hard error.
 *
 * Rules:
 * - `@lostgradient/cinder` exact and `@lostgradient/cinder/<subpath>` are validated separately against the
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

/**
 * Specifier PREFIXES allowed inside published `.example.svelte` files, for
 * packages whose public API is a family of per-module subpaths that cannot be
 * enumerated exactly.
 *
 * `lucide-svelte/icons/<name>` is cinder's own icon vocabulary
 * (docs/icon-vocabulary.md): components import icons this way, so realistic
 * consumer apps have the package installed and examples may demonstrate
 * icon-bearing snippets with real icons rather than text glyphs.
 */
export const ALLOWED_EXAMPLE_PACKAGE_PREFIXES: readonly string[] = ['lucide-svelte/icons/'];
