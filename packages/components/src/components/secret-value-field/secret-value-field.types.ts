import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/**
 * Props for the SecretValueField component.
 *
 * Displays a masked secret value (API key, token, webhook secret) with an
 * accessible copy action. The secret is never rendered into passive attributes
 * like `title`, `aria-label`, or `data-*`. Reveal is opt-in and off by default.
 */
export type SecretValueFieldProps = Omit<HTMLAttributes<HTMLDivElement>, 'class' | 'children'> & {
  /** The secret value to copy. Never rendered in attributes or visible text post-copy. Required. */
  value: string;

  /** Visible prefix shown before the masked region (e.g. `example_live_`). Does not contain the secret. */
  prefix?: string;

  /** Visible suffix shown after the masked region (e.g. last 4 chars "a3f9"). Does not contain the secret. */
  suffix?: string;

  /** Accessible label for the field and copy button region. Defaults to "Secret value". */
  label?: string;

  /** When true, allows the user to reveal/hide the full secret. Opt-in; false by default for security. */
  allowReveal?: boolean;

  /**
   * Shows the full unmasked value on initial render. This is an explicit
   * one-time reveal for the "secret was just created, copy it now" flow and is
   * INDEPENDENT of `allowReveal`: it does not add a reveal/hide toggle, it just
   * starts unmasked. Only set this when the surrounding UI makes the one-time
   * exposure intentional (e.g. a "copy your new key" panel).
   */
  initiallyRevealed?: boolean;

  /** Duration in milliseconds to show the copy confirmation state. Default 1500. */
  confirmDuration?: number;

  /** Accessible label announced after a successful copy. Defaults to "Copied". */
  copiedLabel?: string;

  /** Optional advisory content rendered below the field (e.g. "Copy this now; it will not be shown again"). */
  warning?: Snippet;

  /** Additional CSS classes applied to the root element. */
  class?: string;
};
