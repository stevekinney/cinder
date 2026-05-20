/**
 * Resolver-matrix consumer source.
 *
 * Imports `cinder/button` and exercises its type surface. Both tsconfigs
 * (`nodenext` and `bundler`) compile this file with `tsc --noEmit` to confirm
 * the new condition ordering (`types` first, then `svelte`, `node`, `default`)
 * resolves under both module-resolution modes.
 */
import type { ButtonProps } from 'cinder/button';

export const example: ButtonProps = {
  label: 'Submit',
  disabled: false,
};
