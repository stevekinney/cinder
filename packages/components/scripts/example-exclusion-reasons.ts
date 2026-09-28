/**
 * Allowed values for `// @cinder-example-exclude: <reason>` markers on
 * playground `.example.svelte` files. Any reason not in this list is a hard
 * error in `generate-component-examples.ts`.
 *
 * The total number of exclusions across the package may not exceed 10 % of
 * all playground examples; see Phase 3 acceptance criteria for details.
 *
 * COR-1196: this constant used to live in `src/manifest.meta.ts`, which
 * `stageSurface` overwrites wholesale with corvidae's own copy of that file
 * on every sync. Corvidae carries no playground and never needed the
 * concept, so its current `manifest.meta.ts` does not export this — it was
 * never corvidae's to keep. The playground, its `.example.svelte` authoring
 * contract, and this exclusion-reason list are entirely target-owned (the
 * mirror's `sourceRoot` for `@lostgradient/cinder` is `src` only; `scripts/`
 * — where this file lives — is never touched by a sync), so the constant
 * moved here rather than being ported to a corvidae equivalent that does
 * not exist.
 */
export const allowedExampleExclusionReasons = [
  'playground-only-interaction',
  'requires-router',
  'requires-server-data',
  'requires-iframe-isolation',
] as const satisfies readonly string[];

/** Union of allowed example exclusion reason strings. */
export type ExampleExclusionReason = (typeof allowedExampleExclusionReasons)[number];
