<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Compact labeled meter with a thin horizontal fill bar for inline cost, token, budget, or quota breakdowns.
   * @tag sparkbar
   * @tag meter
   * @tag cost
   * @useWhen Comparing several bounded values in dense rows, such as per-step spend, token usage, or budget consumption.
   * @avoidWhen Showing task completion or loading progress. | progress
   * @avoidWhen Rendering a full cartesian chart with axes, scales, or multiple series. | bar-chart
   * @related meter, progress, bar-chart
   */
  export type { SparkbarProps, SparkbarSize, SparkbarVariant } from './sparkbar.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';

  import type { SparkbarProps } from './sparkbar.types.ts';

  let {
    value,
    max = 1,
    label,
    trailing,
    size = 'md',
    variant = 'accent',
    ariaLabel,
    ariaValueText,
    class: customClassName,
    ...rest
  }: SparkbarProps = $props();

  const effectiveMax = $derived(Number.isFinite(max) && max > 0 ? max : 1);
  const clampedValue = $derived(
    Number.isFinite(value) ? Math.max(0, Math.min(effectiveMax, value)) : 0,
  );
  const percent = $derived(Math.round((clampedValue / effectiveMax) * 100));
  const normalizedAriaLabel = $derived(ariaLabel?.trim() || undefined);
  const normalizedTrailing = $derived(trailing?.trim() || undefined);
  const normalizedAriaValueText = $derived(ariaValueText?.trim() || undefined);
  const accessibleName = $derived(normalizedAriaLabel ?? `${label}, ${percent}%`);
  const accessibleValueText = $derived(normalizedAriaValueText ?? normalizedTrailing);
</script>

<div
  {...rest}
  class={classNames('cinder-sparkbar', customClassName)}
  role="meter"
  aria-label={accessibleName}
  aria-valuemin={0}
  aria-valuemax={effectiveMax}
  aria-valuenow={clampedValue}
  aria-valuetext={accessibleValueText}
  data-cinder-size={size}
  data-cinder-variant={variant}
>
  <div class="cinder-sparkbar__row">
    <span class="cinder-sparkbar__label">{label}</span>
    {#if normalizedTrailing}
      <span class="cinder-sparkbar__trailing">{normalizedTrailing}</span>
    {/if}
  </div>
  <div class="cinder-sparkbar__track" aria-hidden="true">
    <div
      class="cinder-sparkbar__fill"
      style:--_cinder-sparkbar-progress={clampedValue / effectiveMax}
    ></div>
  </div>
</div>
