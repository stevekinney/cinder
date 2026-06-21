import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** Availability state for a browser feature or permission. */
export type CapabilityGateState =
  | 'supported'
  | 'unsupported'
  | 'permission-needed'
  | 'permission-denied'
  | 'loading'
  | 'unavailable';

/** Presentation style for the gate. */
export type CapabilityGateVariant = 'inline' | 'banner' | 'callout';

/** Props for the CapabilityGate component. */
export type CapabilityGateProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'class' | 'children' | 'role'
> & {
  /** The feature being gated (used in accessible status text). */
  feature: string;
  /** Current availability state. */
  state: CapabilityGateState;
  /** Presentation variant. @default "inline" */
  variant?: CapabilityGateVariant;
  /** Label for the primary action button (e.g. "Allow access", "Enable notifications"). */
  primaryAction?: string;
  /** Called when the user clicks the primary action button. */
  onPrimaryAction?: () => void;
  /** Label for the fallback action (e.g. "Use a different method"). */
  fallbackAction?: string;
  /** Href for a fallback link (renders an anchor instead of a button). */
  fallbackHref?: string;
  /** Called when the user clicks the fallback action (only when no fallbackHref). */
  onFallbackAction?: () => void;
  /** Label for the dismiss action. When provided a dismiss button is rendered. */
  dismissAction?: string;
  /**
   * Called when the user dismisses the gate. The gate unmounts itself on
   * dismiss; move focus to a sensible target here (e.g. the control that
   * re-opens the gate) — the component blurs the dismiss button first so focus
   * is not stranded, but only the consumer knows the right next focus target.
   */
  ondismiss?: () => void;
  /** Custom content rendered below the status text and before the actions. */
  children?: Snippet;
  /** Additional class names merged with `.cinder-capability-gate`. */
  class?: string;
};

/**
 * Cinder-specific props for CapabilityGate, used by the schema generator.
 */
export interface CapabilityGateSchemaProps {
  /** The feature being gated. */
  feature: string;
  /** Current availability state. */
  state: CapabilityGateState;
  /**
   * Presentation variant.
   * @default "inline"
   */
  variant?: CapabilityGateVariant;
  /** Label for the primary action button. */
  primaryAction?: string;
  /** Label for the fallback action. */
  fallbackAction?: string;
  /** Href for a fallback link. */
  fallbackHref?: string;
  /** Label for the dismiss action. */
  dismissAction?: string;
  /** Additional class names merged with `.cinder-capability-gate`. */
  class?: string;
  /** Called when the primary action button is activated. */
  onPrimaryAction?: () => void;
  /** Called when the fallback action button is activated. */
  onFallbackAction?: () => void;
  /** Called when the gate is dismissed. */
  ondismiss?: () => void;
  /** Custom content rendered below the status text and before the actions. */
  children?: Snippet;
}
