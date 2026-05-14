<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';

  /**
   * Semantic status values understood by {@link StatusDot}.
   *
   * The string values are stamped onto the root as `data-cinder-status` and
   * drive color exclusively via CSS — there are no hard-coded color classes
   * on the component. The token mapping (e.g. `online` → `--cinder-success`,
   * `error` → `--cinder-danger`) lives in `status-dot.css` so consumers can
   * theme without forking the component.
   *
   * Exported so host components (e.g. `stacked-list-item.svelte`) can type
   * their own `status` prop against this union rather than restating it.
   */
  export type StatusDotStatus = 'online' | 'offline' | 'warning' | 'error' | 'building' | 'neutral';

  export type StatusDotSize = 'sm' | 'md';

  /**
   * Props for {@link StatusDot}.
   *
   * `aria-label` is excluded from the spread HTML attributes because the
   * component manages the accessible name itself: if `showLabel` is `false`
   * or no `label` is provided, the root receives `aria-label={status}` so
   * the status is not communicated by color alone (WCAG 1.4.1). A consumer
   * can still override that label by passing one explicitly.
   */
  export type StatusDotProps = Omit<HTMLAttributes<HTMLSpanElement>, 'class'> & {
    /** Required semantic status. Drives color via `data-cinder-status`. */
    status: StatusDotStatus;
    /** Optional human label shown next to the dot. */
    label?: string;
    /** Whether to render the visible label. Default `true`. */
    showLabel?: boolean;
    /** Dot size. Default `'md'`. */
    size?: StatusDotSize;
    /** Extra classes appended to the root element. */
    class?: string;
  };
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';

  let {
    status,
    label,
    showLabel = true,
    size = 'md',
    class: className,
    ...rest
  }: StatusDotProps = $props();

  const hasVisibleLabel = $derived(showLabel && label !== undefined && label.length > 0);

  // When no visible label is rendered the dot would communicate the state by
  // color alone, so fall back to `aria-label={status}`. A consumer-supplied
  // `aria-label` wins over the automatic one.
  const resolvedAriaLabel = $derived(rest['aria-label'] ?? (hasVisibleLabel ? undefined : status));
</script>

<span
  {...rest}
  class={classNames('cinder-status-dot', className)}
  data-cinder-status={status}
  data-cinder-size={size}
  aria-label={resolvedAriaLabel}
>
  <span class="cinder-status-dot__indicator" aria-hidden="true"></span>
  {#if hasVisibleLabel}
    <span class="cinder-status-dot__label">{label}</span>
  {/if}
</span>
