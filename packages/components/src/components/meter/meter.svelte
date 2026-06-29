<script lang="ts" module>
  /**
   * @cinder
   * @category feedback
   * @status alpha
   * @purpose Bounded measurement gauge with meter semantics for readings like battery, quota, CPU, and memory utilization.
   * @tag feedback
   * @tag measurement
   * @tag gauge
   * @useWhen Showing a fluctuating value within a known minimum and maximum range.
   * @useWhen Communicating low/optimal/high regions of a bounded measurement.
   * @avoidWhen Reporting task completion over time such as uploads/imports. | progress
   * @related progress, stat, slider
   * @a11yPattern WAI-ARIA Meter
   */
  export type { MeterProps, MeterSize, MeterState } from './meter.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import { devWarn } from '../../utilities/dev-warn.ts';
  import type { MeterProps, MeterState } from './meter.types.ts';

  const DEFAULT_MIN = 0;
  const DEFAULT_MAX = 100;

  let {
    value = 0,
    min = DEFAULT_MIN,
    max = DEFAULT_MAX,
    low,
    high,
    optimum,
    size = 'md',
    ariaValueText,
    ariaLabel,
    ariaLabelledby,
    class: className,
  }: MeterProps = $props();

  const hasValidRange = $derived(Number.isFinite(min) && Number.isFinite(max) && max > min);
  const effectiveMin = $derived(hasValidRange ? min : DEFAULT_MIN);
  const effectiveMax = $derived(hasValidRange ? max : DEFAULT_MAX);
  const range = $derived(effectiveMax - effectiveMin);

  const hasFiniteValue = $derived(Number.isFinite(value));
  const rawValue = $derived(hasFiniteValue ? value : effectiveMin);
  const clampedValue = $derived(Math.max(effectiveMin, Math.min(effectiveMax, rawValue)));

  const lowBoundary = $derived(
    low === undefined || !Number.isFinite(low)
      ? effectiveMin + range / 3
      : Math.max(effectiveMin, Math.min(effectiveMax, low)),
  );
  const highBoundary = $derived(
    high === undefined || !Number.isFinite(high)
      ? effectiveMin + (range * 2) / 3
      : Math.max(effectiveMin, Math.min(effectiveMax, high)),
  );

  const segmentLow = $derived(Math.min(lowBoundary, highBoundary));
  const segmentHigh = $derived(Math.max(lowBoundary, highBoundary));
  const effectiveOptimum = $derived(
    optimum === undefined || !Number.isFinite(optimum)
      ? effectiveMin + range / 2
      : Math.max(effectiveMin, Math.min(effectiveMax, optimum)),
  );
  const normalized = $derived((clampedValue - effectiveMin) / range);
  const progressScale = $derived(normalized);
  const percent = $derived(Math.round(progressScale * 100));
  const defaultValueText = $derived(`${percent}%`);
  const valueText = $derived(ariaValueText ?? defaultValueText);

  const meterState = $derived.by<MeterState>(() => {
    if (effectiveOptimum < segmentLow) {
      if (clampedValue <= segmentLow) return 'optimum';
      if (clampedValue <= segmentHigh) return 'high';
      return 'high';
    }
    if (effectiveOptimum > segmentHigh) {
      if (clampedValue < segmentLow) return 'low';
      if (clampedValue <= segmentHigh) return 'low';
      return 'optimum';
    }
    if (clampedValue < segmentLow) return 'low';
    if (clampedValue <= segmentHigh) return 'optimum';
    return 'high';
  });

  const lowPercent = $derived(((segmentLow - effectiveMin) / range) * 100);
  const optimumPercent = $derived(((segmentHigh - segmentLow) / range) * 100);
  const highPercent = $derived(((effectiveMax - segmentHigh) / range) * 100);

  $effect(() => {
    if (!hasValidRange) {
      devWarn(
        `[cinder/Meter] received an invalid range (min=${String(min)}, max=${String(max)}). Falling back to 0..100.`,
      );
    }
    if (!hasFiniteValue) {
      devWarn(
        `[cinder/Meter] received a non-finite value (${String(value)}). Falling back to min (${String(effectiveMin)}).`,
      );
    }
    if (hasFiniteValue && value !== clampedValue) {
      devWarn(
        `[cinder/Meter] value ${String(value)} is outside the [min,max] range (${String(effectiveMin)}..${String(effectiveMax)}). The rendered value is clamped.`,
      );
    }
    if (low !== undefined && !Number.isFinite(low)) {
      devWarn(
        `[cinder/Meter] low threshold must be finite when provided. Received ${String(low)}.`,
      );
    }
    if (high !== undefined && !Number.isFinite(high)) {
      devWarn(
        `[cinder/Meter] high threshold must be finite when provided. Received ${String(high)}.`,
      );
    }
    if (optimum !== undefined && !Number.isFinite(optimum)) {
      devWarn(
        `[cinder/Meter] optimum threshold must be finite when provided. Received ${String(optimum)}.`,
      );
    }
    const hasAriaLabel = typeof ariaLabel === 'string' && ariaLabel.trim().length > 0;
    const hasAriaLabelledby =
      typeof ariaLabelledby === 'string' && ariaLabelledby.trim().length > 0;
    if (!hasAriaLabel && !hasAriaLabelledby) {
      devWarn(
        '[cinder/Meter] rendered without an accessible name — pass `ariaLabel` or `ariaLabelledby`.',
      );
    }
  });
</script>

<div
  class={classNames('cinder-meter', className)}
  role="meter"
  aria-label={ariaLabel}
  aria-labelledby={ariaLabelledby}
  aria-valuemin={effectiveMin}
  aria-valuemax={effectiveMax}
  aria-valuenow={clampedValue}
  aria-valuetext={valueText}
  data-cinder-size={size}
  data-cinder-state={meterState}
  data-value={clampedValue}
  data-min={effectiveMin}
  data-max={effectiveMax}
>
  <div class="cinder-meter__track">
    <div class="cinder-meter__segments" aria-hidden="true">
      <div
        class="cinder-meter__segment cinder-meter__segment--low"
        style:width="{lowPercent}%"
      ></div>
      <div
        class="cinder-meter__segment cinder-meter__segment--optimum"
        style:width="{optimumPercent}%"
      ></div>
      <div
        class="cinder-meter__segment cinder-meter__segment--high"
        style:width="{highPercent}%"
      ></div>
    </div>
    <div class="cinder-meter__fill" style:--_cinder-meter-progress={progressScale}></div>
  </div>
</div>
