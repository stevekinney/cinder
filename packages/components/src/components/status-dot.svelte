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
   * The component manages the accessible name itself so the status is never
   * communicated by color alone (WCAG 1.4.1): the visible label text wins,
   * then a hidden but provided `label`, then the raw `status` token. A
   * consumer-supplied `aria-label` always takes priority over the automatic
   * fallback.
   */
  export type StatusDotProps = Omit<HTMLAttributes<HTMLSpanElement>, 'class'> & {
    /** Required semantic status. Drives color via `data-cinder-status`. */
    status: StatusDotStatus;
    /** Optional human label. Rendered visibly when `showLabel` is true; used as the accessible name either way. */
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
    'aria-label': ariaLabel,
    ...rest
  }: StatusDotProps = $props();

  const normalizedAriaLabel = $derived(ariaLabel?.trim() ? ariaLabel.trim() : undefined);
  const normalizedLabel = $derived(label?.trim() ? label.trim() : undefined);
  const hasLabelText = $derived(normalizedLabel !== undefined);
  const hasVisibleLabel = $derived(showLabel && hasLabelText);

  // `role="img"` needs an author-provided name. Blank labels are treated as
  // absent so status is never communicated by color alone.
  const resolvedAriaLabel = $derived(normalizedAriaLabel ?? normalizedLabel ?? status);
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
  data-cinder-status={status}
  data-cinder-size={size}
  role="img"
  aria-label={resolvedAriaLabel}
>
  <span class="cinder-status-dot__indicator" aria-hidden="true"></span>
  {#if hasVisibleLabel}
    <span class="cinder-status-dot__label">{label}</span>
  {/if}
</span>
