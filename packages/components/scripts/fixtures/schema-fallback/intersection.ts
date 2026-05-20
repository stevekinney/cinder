/**
 * Fixture: intersection of two svelte/elements attribute sets.
 *
 * Properties present in either inherited interface must be filtered; the
 * local prop `tone` must survive.
 */
import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

export type IntersectionProps = HTMLButtonAttributes &
  HTMLAnchorAttributes & {
    /** Cinder-specific tone. */
    tone?: 'neutral' | 'accent';
  };
