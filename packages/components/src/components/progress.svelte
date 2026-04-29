<script lang="ts" module>
  export type ProgressVariant = 'bar' | 'ring';
  export type ProgressSize = 'sm' | 'md' | 'lg';

  /**
   * Props for the Progress component.
   *
   * Determinate progress passes a `value` between 0 and `max` (default 100).
   * Indeterminate progress omits `value` (or passes `undefined`); the
   * component renders a looping animation under normal motion preferences
   * and a static surface under `prefers-reduced-motion: reduce`.
   */
  export type ProgressProps = {
    /** Current progress value. Omit for indeterminate. */
    value?: number;
    /** Maximum value. Defaults to 100. */
    max?: number;
    /** Visual variant. Default `bar`. */
    variant?: ProgressVariant;
    /** Size token. Default `md`. */
    size?: ProgressSize;
    /** Human-readable status, exposed as `aria-valuetext`. */
    label?: string;
    /** Additional class names merged with `.cinder-progress`. */
    class?: string;
  };
</script>

<script lang="ts">
  import { cn } from '../utilities/class-names.ts';

  let {
    value,
    max = 100,
    variant = 'bar',
    size = 'md',
    label,
    class: className,
  }: ProgressProps = $props();

  const isIndeterminate = $derived(value === undefined);
  const clampedValue = $derived(
    value === undefined ? undefined : Math.max(0, Math.min(max, value)),
  );
  const percent = $derived(
    clampedValue === undefined ? undefined : Math.round((clampedValue / max) * 100),
  );

  // Default valuetext mirrors the percent for determinate; falls back to a
  // generic "Loading" string for indeterminate so screen readers have
  // something to announce.
  const valueText = $derived(label ?? (isIndeterminate ? 'Loading' : `${percent}%`));
</script>

{#if variant === 'ring'}
  <div
    class={cn('cinder-progress', 'cinder-progress--ring', className)}
    role="progressbar"
    aria-valuemin={0}
    aria-valuemax={max}
    aria-valuenow={clampedValue}
    aria-valuetext={valueText}
    data-cinder-size={size}
    data-cinder-indeterminate={isIndeterminate || undefined}
  >
    <svg viewBox="0 0 36 36" class="cinder-progress__svg" aria-hidden="true">
      <circle class="cinder-progress__track" cx="18" cy="18" r="16" />
      {#if !isIndeterminate}
        <circle
          class="cinder-progress__fill"
          cx="18"
          cy="18"
          r="16"
          style:--_cinder-progress-percent={percent}
        />
      {:else}
        <circle
          class="cinder-progress__fill cinder-progress__fill--indeterminate"
          cx="18"
          cy="18"
          r="16"
        />
      {/if}
    </svg>
  </div>
{:else}
  <div
    class={cn('cinder-progress', 'cinder-progress--bar', className)}
    role="progressbar"
    aria-valuemin={0}
    aria-valuemax={max}
    aria-valuenow={clampedValue}
    aria-valuetext={valueText}
    data-cinder-size={size}
    data-cinder-indeterminate={isIndeterminate || undefined}
  >
    <div class="cinder-progress__track">
      {#if !isIndeterminate}
        <div class="cinder-progress__fill" style:width="{percent}%"></div>
      {:else}
        <div class="cinder-progress__fill cinder-progress__fill--indeterminate"></div>
      {/if}
    </div>
  </div>
{/if}
