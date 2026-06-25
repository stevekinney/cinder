<script lang="ts" module>
  /**
   * @cinder
   * @category feedback
   * @status stable
   * @purpose Static role="img" badge that communicates an entity's state through a colored dot with an accessible text label.
   * @tag feedback
   * @tag status
   * @useWhen Indicating the current state of a list row, user, deployment, or other entity alongside its name.
   * @useWhen Communicating status compactly when many indicators appear together without triggering live-region announcements.
   * @avoidWhen Counting items or showing a numeric value — use badge instead.
   * @avoidWhen Announcing a transient status change — use toast-region or alert so assistive tech reads it.
   * @related badge
   */
  export type { StatusDotProps, StatusDotSize, StatusDotStatus } from './status-dot.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import type {
    StatusDotConnectionState,
    StatusDotProps,
    StatusDotStatus,
  } from './status-dot.types.ts';

  const connectionStatusMap: Record<StatusDotConnectionState, StatusDotStatus> = {
    connected: 'online',
    connecting: 'warning',
    disconnected: 'offline',
    error: 'danger',
  };

  const connectionLabels: Record<StatusDotConnectionState, string> = {
    connected: 'Connected',
    connecting: 'Connecting',
    disconnected: 'Disconnected',
    error: 'Error',
  };

  let {
    status,
    connectionState,
    label,
    live,
    showLabel = true,
    size = 'md',
    class: className,
    'aria-label': ariaLabel,
    ...rest
  }: StatusDotProps = $props();

  const normalizedAriaLabel = $derived(ariaLabel?.trim() ? ariaLabel.trim() : undefined);
  const resolvedStatus = $derived(
    status ?? (connectionState === undefined ? 'neutral' : connectionStatusMap[connectionState]),
  );
  const resolvedLive = $derived(live ?? connectionState !== undefined);
  const normalizedLabel = $derived(
    label?.trim()
      ? label.trim()
      : connectionState === undefined
        ? undefined
        : connectionLabels[connectionState],
  );
  const hasVisibleLabel = $derived(showLabel && normalizedLabel !== undefined);

  // `role="img"` needs an author-provided name. Blank labels are treated as
  // absent so status is never communicated by color alone.
  const resolvedAriaLabel = $derived(normalizedAriaLabel ?? normalizedLabel ?? resolvedStatus);
  const visibleLabelIsLiveDuplicate = $derived(
    resolvedLive && normalizedLabel !== undefined && resolvedAriaLabel !== normalizedLabel,
  );
  const needsHiddenLiveLabel = $derived(
    resolvedLive && (!hasVisibleLabel || visibleLabelIsLiveDuplicate),
  );
</script>

<!--
  `role="img"` (not `role="status"`) because StatusDot is a static decorative
  indicator that can appear many times in a single view (e.g. one per row in a
  list). `role="status"` is an ARIA polite live region: when injected into an
  already-rendered DOM (paginated tables, virtualized lists) it can cause
  screen readers to announce each dot as it mounts. `role="img"` declares the
  element as a graphic with an accessible name supplied via `aria-label`,
  which is the semantically correct choice for a non-changing visual state
  badge.
-->
<span
  {...rest}
  class={classNames('cinder-status-dot', className)}
  data-cinder-status={resolvedStatus}
  data-cinder-state={connectionState}
  data-cinder-size={size}
  role={resolvedLive ? 'status' : 'img'}
  aria-live={resolvedLive ? 'polite' : undefined}
  aria-atomic={resolvedLive ? 'true' : undefined}
  aria-label={resolvedLive ? undefined : resolvedAriaLabel}
>
  <span class="cinder-status-dot__indicator" aria-hidden="true"></span>
  {#if hasVisibleLabel}
    <span
      class="cinder-status-dot__label"
      aria-hidden={visibleLabelIsLiveDuplicate ? 'true' : undefined}>{normalizedLabel}</span
    >
  {/if}
  {#if needsHiddenLiveLabel}
    <span class="cinder-sr-only">{resolvedAriaLabel}</span>
  {/if}
</span>
