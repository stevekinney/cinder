import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** Visual severity variants for the Alert component. `danger` is the canonical spelling shared by banner and callout. */
export type AlertVariant =
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  /** @deprecated Use `danger`. */
  | 'error';

/**
 * Props for the {@link Alert} component — a live-region notification card.
 *
 * Per design decision P6-C2, Alert is the assertive live region: it owns
 * `role="alert"` (which implies `aria-live="assertive"` and `aria-atomic="true"`)
 * and that role is non-overridable. `role`, `aria-live`, `aria-atomic`, and
 * `aria-relevant` are therefore omitted from the public surface so a consumer
 * cannot type `<Alert role="status" />`, downgrade the announcement urgency, or
 * fragment the assertive announcement — the component also scrubs all four from
 * spread props at runtime for defense in depth. Mirrors the `Omit`-plus-runtime-
 * scrub pattern in {@link CalloutProps} (the omit/scrub sets match the
 * component's behavior in each case). `aria-busy` remains on the surface: it is
 * a status flag rather than a live-region presentation attribute.
 */
export type AlertProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'children' | 'role' | 'aria-live' | 'aria-atomic' | 'aria-relevant'
> & {
  variant?: AlertVariant;
  dismissible?: boolean;
  ondismiss?: () => void;
  class?: string;
  children: Snippet;
  icon?: Snippet;
};

/**
 * Cinder-specific props for the Alert component, used by the schema generator.
 * Excludes the inherited HTML attribute surface that consumers can spread via
 * `...rest` — those are documented in the underlying element's MDN reference.
 */
export interface AlertSchemaProps {
  /**
   * Visual severity variant. `danger` is the canonical failure-severity spelling, consistent with banner and callout.
   * `error` remains accepted as a deprecated alias.
   * @default "info"
   */
  variant?: AlertVariant;
  /**
   * Allow the alert to be dismissed.
   * @default false
   */
  dismissible?: boolean;
  /** Custom class merged with `.cinder-alert`. */
  class?: string;
}
