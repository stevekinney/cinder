import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/**
 * The six connection lifecycle states ConnectionIndicator understands.
 *
 * Stamped directly onto the root as `data-cinder-status` and driving color
 * exclusively through `connection-indicator.css` — there are no hard-coded
 * color classes on the component. Each state also carries its own icon and
 * text label so status is never communicated by color alone (WCAG 1.4.1).
 *
 * - `connecting` — initial handshake in progress, no data yet.
 * - `live` — connected and actively receiving pushed updates.
 * - `reconnecting` — a previously live connection dropped and is retrying.
 * - `polling` — receiving updates via interval polling rather than push.
 * - `stale` — connected but data has not refreshed within an expected window.
 * - `closed` — the connection is intentionally or terminally closed.
 */
export type ConnectionIndicatorStatus =
  | 'connecting'
  | 'live'
  | 'reconnecting'
  | 'polling'
  | 'stale'
  | 'closed';

/**
 * Props for ConnectionIndicator.
 *
 * The component always renders `role="status"` with a computed accessible
 * name of the form "Connection: {label}" (overridable via `aria-label`), so
 * assistive technology gets the same signal as sighted users regardless of
 * which visual treatment (icon, motion, font-weight) carries the difference
 * between states.
 */
export type ConnectionIndicatorProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'class' | 'children'
> & {
  /** Current connection lifecycle state. Drives icon, text, and color via `data-cinder-status`. */
  status: ConnectionIndicatorStatus;
  /** Optional human label override. Replaces the default text for `status` (and the "Connection: …" accessible name). */
  label?: string;
  /** Attempt-count content rendered next to the label when `status` is `'reconnecting'`, e.g. "attempt 3 of 5". Ignored for other states. */
  attempt?: Snippet;
  /** Extra classes appended to the root element. */
  class?: string;
};

/** Schema-facing mirror of {@link ConnectionIndicatorProps}, omitting the non-serializable `attempt` snippet and native HTML attribute passthrough. */
export interface ConnectionIndicatorSchemaProps {
  /** Current connection lifecycle state. Drives icon, text, and color via `data-cinder-status`. */
  status: ConnectionIndicatorStatus;
  /** Optional human label override. Replaces the default text for `status` (and the "Connection: …" accessible name). */
  label?: string;
  /** Extra classes appended to the root element. */
  class?: string;
}
