import type { HTMLAttributes } from 'svelte/elements';

/**
 * Live-status pill with a semantic dot and label. Use to show real-time
 * connection state (WebSocket, SSE, polling) on dashboards.
 */
export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';
// Extends native span attributes so consumers can forward `id`, `data-*`,
// `aria-*`, etc. onto the root. `class` and `role` are Omit-ted: `class` is
// merged explicitly, and `role="status"` is intrinsic to the live-region purpose.
export type ConnectionIndicatorProps = Omit<HTMLAttributes<HTMLSpanElement>, 'class' | 'role'> & {
  /** Current connection state. */
  state: ConnectionState;
  /** Optional override for the visible label. Defaults derived from `state`. */
  label?: string;
  /** Additional class names merged with `.cinder-connection-indicator`. */
  class?: string;
};
