/**
 * Fixture: locally-declared prop with the same name as an HTML attribute.
 *
 * `disabled` is declared in `HTMLButtonAttributes` AND locally. The filter
 * must preserve the local one (by-declaration-site, not by-name).
 */
import type { HTMLButtonAttributes } from 'svelte/elements';

export type LocalShadowProps = HTMLButtonAttributes & {
  /** Locally narrowed disabled — required, not nullable. */
  disabled: boolean;
};
