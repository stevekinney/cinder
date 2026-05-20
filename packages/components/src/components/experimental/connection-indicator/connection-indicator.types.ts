/**
 * EXPERIMENTAL — ConnectionIndicator API may change between minor versions.
 *
 * Live-status pill with a semantic dot and label. Use to show real-time
 * connection state (WebSocket, SSE, polling) on dashboards.
 */
export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';
export type ConnectionIndicatorProps = {
  /** Current connection state. */
  state: ConnectionState;
  /** Optional override for the visible label. Defaults derived from `state`. */
  label?: string;
  /** Additional class names merged with `.cinder-connection-indicator`. */
  class?: string;
};
