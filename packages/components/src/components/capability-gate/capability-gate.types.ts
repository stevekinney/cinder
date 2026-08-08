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
  /**
   * Action row content — compose your own Buttons/links (primary, fallback,
   * dismiss, anything else). The snippet receives a `dismiss` function that
   * runs the gate's own unmount-and-`onDismiss` path, so a consumer dismiss
   * button gets the component's focus handling for free:
   *
   * ```svelte
   * {#snippet actions({ dismiss })}
   *   <Button label="Allow access" onclick={requestAccess} />
   *   <Button variant="secondary" label="Not now" onclick={dismiss} />
   * {/snippet}
   * ```
   */
  actions?: Snippet<[{ dismiss: () => void }]>;
  /**
   * Called when the user dismisses the gate. The gate unmounts itself on
   * dismiss; move focus to a sensible target here (e.g. the control that
   * re-opens the gate) — the component blurs the dismiss button first so focus
   * is not stranded, but only the consumer knows the right next focus target.
   */
  onDismiss?: () => void;
  /** Custom content rendered below the status text and before the actions. */
  children?: Snippet;
  /** Additional class names merged with `.cinder-capability-gate`. */
  class?: string;
};

/**
 * Cinder-specific props for CapabilityGate, used by the schema generator.
 *
 * Rule: the schema surface includes every public prop; inexpressible ones
 * (callbacks, snippets) are surfaced via `unsupportedProps`, never omitted.
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
  /** Additional class names merged with `.cinder-capability-gate`. */
  class?: string;
  /** Action row content; receives the gate's own `dismiss` function. */
  actions?: Snippet<[{ dismiss: () => void }]>;
  /** Called when the gate is dismissed. */
  onDismiss?: () => void;
  /** Custom content rendered below the status text and before the actions. */
  children?: Snippet;
}
