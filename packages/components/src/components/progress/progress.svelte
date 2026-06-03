<script lang="ts" module>
  /**
   * @cinder
   * @category feedback
   * @status stable
   * @purpose Determinate or indeterminate progressbar rendered as a horizontal bar or ring with full ARIA value semantics.
   * @tag feedback
   * @tag progress
   * @useWhen Reporting measurable progress of a known task such as a file upload or multi-step import.
   * @useWhen Showing an indeterminate work indicator when the task duration is unknown but the surface needs a progressbar role.
   * @avoidWhen Showing a small inline busy state next to a control — use spinner.
   * @avoidWhen Reserving placeholder space for incoming content — use skeleton.
   * @related spinner, skeleton
   */
  export type { ProgressProps, ProgressSize, ProgressVariant } from './progress.types.ts';
</script>

<script lang="ts">
  import type { ProgressProps } from './progress.types.ts';
  import { cn } from '../../utilities/class-names.ts';
  import { devWarn } from '../../utilities/dev-warn.ts';

  let {
    value,
    max = 100,
    variant = 'bar',
    size = 'md',
    label,
    ariaLabel,
    ariaLabelledby,
    class: className,
  }: ProgressProps = $props();

  // A progressbar must have an accessible name (ARIA 1.2 §6.9). `label` feeds
  // aria-valuetext only, so warn JS consumers (who bypass the TS docs) when
  // neither name source is supplied. Re-checks reactively; devWarn self-gates on DEV.
  $effect(() => {
    const hasAriaLabel = typeof ariaLabel === 'string' && ariaLabel.trim().length > 0;
    const hasAriaLabelledby =
      typeof ariaLabelledby === 'string' && ariaLabelledby.trim().length > 0;
    if (!hasAriaLabel && !hasAriaLabelledby) {
      devWarn(
        '[cinder/Progress] rendered without an accessible name — pass `ariaLabel` or `ariaLabelledby`. `label` only sets aria-valuetext and does not name the progressbar.',
      );
    }
  });

  // A usable upper bound: only a finite, strictly-positive `max` can define a
  // determinate scale. Zero, negative, or non-finite `max` cannot, so the bar
  // falls back to indeterminate rather than dividing by zero (NaN/Infinity).
  const effectiveMax = $derived(Number.isFinite(max) && max > 0 ? max : undefined);
  const isIndeterminate = $derived(
    value === undefined || !Number.isFinite(value) || effectiveMax === undefined,
  );
  const clampedValue = $derived(
    isIndeterminate ? undefined : Math.max(0, Math.min(effectiveMax!, value!)),
  );
  const percent = $derived(
    clampedValue === undefined ? undefined : Math.round((clampedValue / effectiveMax!) * 100),
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
    aria-label={ariaLabel}
    aria-labelledby={ariaLabelledby}
    aria-valuemin={0}
    aria-valuemax={effectiveMax}
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
    aria-label={ariaLabel}
    aria-labelledby={ariaLabelledby}
    aria-valuemin={0}
    aria-valuemax={effectiveMax}
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
