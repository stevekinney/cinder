<script lang="ts" module>
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
</script>

<script lang="ts">
  import { cn } from '../../utilities/class-names.ts';

  let { state, label, class: className }: ConnectionIndicatorProps = $props();

  const defaultLabels: Record<ConnectionState, string> = {
    connected: 'Connected',
    connecting: 'Connecting',
    disconnected: 'Disconnected',
    error: 'Error',
  };

  const visibleLabel = $derived(label ?? defaultLabels[state]);
</script>

<span class={cn('cinder-connection-indicator', className)} data-cinder-state={state} role="status">
  <span class="cinder-connection-indicator__dot" aria-hidden="true"></span>
  <span class="cinder-connection-indicator__label">{visibleLabel}</span>
</span>
