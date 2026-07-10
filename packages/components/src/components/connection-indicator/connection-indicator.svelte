<script lang="ts" module>
  /**
   * @cinder
   * @category feedback
   * @status beta
   * @purpose Small standalone status pill for a live connection, distinguishing connecting, live, reconnecting, polling, stale, and closed states through icon and text rather than color alone.
   * @tag connection
   * @tag status
   * @tag realtime
   * @useWhen Surfacing the transport-level health of a websocket, SSE stream, or polling loop as a compact, self-contained pill.
   * @useWhen Distinguishing push (`live`) from interval polling (`polling`) so operators don't mistake one for the other.
   * @avoidWhen Annotating a static entity's state (a row, a user, a deployment) rather than a live transport — use status-dot instead. | status-dot
   * @avoidWhen Rendering a full event log with per-event connection transitions — use event-stream-viewer instead. | event-stream-viewer
   * @a11yPattern role="status" live region
   * @a11yNote Status is conveyed by icon and text together, never color alone (WCAG 1.4.1); the live pulsing dot collapses to a static dot under prefers-reduced-motion.
   * @related status-dot, event-stream-viewer, badge
   */
  export type {
    ConnectionIndicatorProps,
    ConnectionIndicatorSchemaProps,
    ConnectionIndicatorStatus,
  } from './connection-indicator.types.ts';
</script>

<script lang="ts">
  import Loader from 'lucide-svelte/icons/loader';
  import RefreshCcwDot from 'lucide-svelte/icons/refresh-ccw-dot';
  import RefreshCw from 'lucide-svelte/icons/refresh-cw';
  import TriangleAlert from 'lucide-svelte/icons/triangle-alert';
  import Wifi from 'lucide-svelte/icons/wifi';
  import WifiOff from 'lucide-svelte/icons/wifi-off';
  import { classNames } from '../../utilities/class-names.ts';
  import type {
    ConnectionIndicatorProps,
    ConnectionIndicatorStatus,
  } from './connection-indicator.types.ts';

  const statusLabels: Record<ConnectionIndicatorStatus, string> = {
    connecting: 'Connecting',
    live: 'Live',
    reconnecting: 'Reconnecting',
    polling: 'Polling',
    stale: 'Stale',
    closed: 'Closed',
  };

  const statusIcons: Record<ConnectionIndicatorStatus, typeof Wifi> = {
    connecting: Loader,
    live: Wifi,
    reconnecting: RefreshCw,
    polling: RefreshCcwDot,
    stale: TriangleAlert,
    closed: WifiOff,
  };

  let {
    status,
    label,
    attempt,
    class: className,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
    ...rest
  }: ConnectionIndicatorProps = $props();

  // Normalize empty/whitespace-only ARIA name props to `undefined` so an empty
  // attribute is never emitted (which would suppress the accessible-name
  // fallback). A provided aria-labelledby takes precedence, so the automatic
  // aria-label default steps aside for it.
  const normalizedAriaLabel = $derived(ariaLabel?.trim() ? ariaLabel.trim() : undefined);
  const normalizedAriaLabelledby = $derived(ariaLabelledby?.trim() ? ariaLabelledby : undefined);
  const resolvedLabel = $derived(label?.trim() ? label.trim() : statusLabels[status]);
  const resolvedAriaLabel = $derived(
    normalizedAriaLabelledby !== undefined
      ? undefined
      : (normalizedAriaLabel ?? `Connection: ${resolvedLabel}`),
  );
  const Icon = $derived(statusIcons[status]);
</script>

<div
  {...rest}
  class={classNames('cinder-connection-indicator', className)}
  data-cinder-status={status}
  role="status"
  aria-live="polite"
  aria-atomic="true"
  aria-label={resolvedAriaLabel}
  aria-labelledby={normalizedAriaLabelledby}
>
  {#if status === 'live'}
    <span class="cinder-connection-indicator__dot" aria-hidden="true"></span>
  {/if}
  <span class="cinder-connection-indicator__icon" aria-hidden="true">
    <Icon size={13} strokeWidth={2.25} />
  </span>
  <span class="cinder-connection-indicator__label">{resolvedLabel}</span>
  {#if status === 'reconnecting' && attempt}
    <span class="cinder-connection-indicator__attempt">{@render attempt()}</span>
  {/if}
</div>
