/**
 * The published root entry point for `@lostgradient/editor`.
 *
 * Upstream's barrel re-exported the anchor decorations, anchoring, comments,
 * export, session and anchor-type modules. Corvidae split the anchor plugin out
 * of `anchor-decorations.ts` into `anchor-plugin-state.ts`,
 * `anchor-plugin-types.ts` and `anchor-plugin.ts`, so those four names are named
 * from their new homes to keep the published surface identical.
 *
 * This is the module the package's `bun`, `browser` and `svelte` conditions
 * resolve to directly, so it is the public API for every source consumer.
 */

export { resolveAnchorSelectionRange, selectAnchorRange } from './anchor-decorations.ts';
export { anchorPluginKey } from './anchor-plugin-state.ts';
export type { AnchorPluginOptions, AnchorPluginState, AnchorState } from './anchor-plugin-types.ts';
export { createAnchorPlugin } from './anchor-plugin.ts';
export * from './anchoring.ts';
export * from './comments/index.ts';
export * from './export/index.ts';
export * from './session/index.ts';
export * from './shared/anchor-types.ts';
