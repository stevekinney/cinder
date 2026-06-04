<script lang="ts" module>
  /**
   * @cinder
   * @category feedback
   * @status stable
   * @purpose Live-status pill pairing a semantic dot with a label to communicate real-time WebSocket, SSE, or polling connection state.
   * @tag connection
   * @tag status
   * @tag realtime
   * @useWhen Surfacing whether a realtime channel is connected, connecting, disconnected, or errored on a dashboard or app chrome.
   * @useWhen Giving operators an at-a-glance health signal for a long-lived transport.
   * @avoidWhen Communicating generic semantic state with no realtime connection backing it — status-dot is the lower-level primitive.
   * @related status-dot, spinner
   */
  export type { ConnectionIndicatorProps, ConnectionState } from './connection-indicator.types.ts';
</script>

<script lang="ts">
  import type { ConnectionIndicatorProps, ConnectionState } from './connection-indicator.types.ts';
  import { classNames } from '../../utilities/class-names.ts';

  let { state, label, class: className, ...rest }: ConnectionIndicatorProps = $props();

  const defaultLabels: Record<ConnectionState, string> = {
    connected: 'Connected',
    connecting: 'Connecting',
    disconnected: 'Disconnected',
    error: 'Error',
  };

  const visibleLabel = $derived(label ?? defaultLabels[state]);
</script>

<span
  {...rest}
  class={classNames('cinder-connection-indicator', className)}
  data-cinder-state={state}
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  <span class="cinder-connection-indicator__dot" aria-hidden="true"></span>
  <span class="cinder-connection-indicator__label">{visibleLabel}</span>
</span>
