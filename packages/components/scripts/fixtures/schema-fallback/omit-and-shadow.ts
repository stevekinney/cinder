/**
 * Fixture: `Omit<HTMLButtonAttributes, 'disabled'> & { disabled: boolean }`.
 *
 * The Omit removes the HTML version of `disabled`; the intersection re-adds
 * it locally with a narrower type. The fallback filter must preserve the
 * local `disabled` because its declaration site is local, not in
 * `svelte/elements`.
 */
import type { HTMLButtonAttributes } from 'svelte/elements';

export type OmitAndShadowProps = Omit<HTMLButtonAttributes, 'disabled'> & {
  /** Locally-narrowed required boolean. */
  disabled: boolean;
  /** Cinder-specific prop. */
  size?: 'small' | 'medium' | 'large';
};
