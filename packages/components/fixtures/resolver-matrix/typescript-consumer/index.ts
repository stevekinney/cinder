/**
 * Resolver-matrix consumer source.
 *
 * Imports `@lostgradient/cinder/button` and `@lostgradient/cinder/styles/guard` to exercise their type
 * surfaces. Both tsconfigs (`nodenext` and `bundler`) compile this file with
 * `tsc --noEmit` to confirm the condition ordering (`types` first, then
 * `svelte`, `node`, `default`) resolves under both module-resolution modes.
 *
 * The `@lostgradient/cinder/styles/guard` import specifically validates that the `./styles/guard`
 * export resolves to real files under all four conditions — a regression guard
 * for the class of defect where the export entry points at files that do not
 * exist in the published package.
 */
import type { ButtonProps } from '@lostgradient/cinder/button';
import type {
  BASE_LOADED_PROPERTY,
  isBaseLoaded,
  MISSING_BASE_WARNING,
} from '@lostgradient/cinder/styles/guard';

export const example: ButtonProps = {
  label: 'Submit',
  disabled: false,
};

// Type-level reference to force resolution of the guard module exports.
// If the `./styles/guard` entry in package.json does not resolve, tsc errors here.
export type GuardExports = {
  baseLoadedProperty: typeof BASE_LOADED_PROPERTY;
  checkFn: typeof isBaseLoaded;
  warning: typeof MISSING_BASE_WARNING;
};
