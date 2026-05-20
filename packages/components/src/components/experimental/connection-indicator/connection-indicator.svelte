<script lang="ts" module>
  export type { ConnectionIndicatorProps, ConnectionState } from './connection-indicator.types.ts';
</script>

<script lang="ts">
  import type { ConnectionIndicatorProps, ConnectionState } from './connection-indicator.types.ts';
  import { cn } from '../../../utilities/class-names.ts';

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
