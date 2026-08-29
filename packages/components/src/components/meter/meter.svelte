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
   * @related progress, statistic, slider
   * @a11yPattern WAI-ARIA Meter
   */
  export type {
    MeterProps,
    MeterSize,
    MeterState,
    MeterVerdict,
    MeterVerdictLevel,
  } from './meter.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import { devWarn } from '../../utilities/dev-warn.ts';
  import type { MeterProps, MeterState } from './meter.types.ts';

  const DEFAULT_MIN = 0;
  const DEFAULT_MAX = 100;
  type OptimumDirection = 'low' | 'mid' | 'high';

  let {
    verdict,
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
    ...rest
  }: MeterProps = $props();

  const generatedId = $props.id();

  const verdictLevel = $derived.by<MeterState | 'unknown' | undefined>(() => {
    const level = (verdict as { level?: unknown } | undefined)?.level;
    return level === 'low' || level === 'optimum' || level === 'high' || level === 'unknown'
      ? level
      : undefined;
  });
  const hasVerdict = $derived(verdictLevel !== undefined);
  const isUnknownVerdict = $derived(verdictLevel === 'unknown');
  const verdictLabel = $derived.by(() => {
    const label = (verdict as { label?: unknown } | undefined)?.label;
    if (typeof label === 'string' && label.trim().length > 0) return label.trim();
    if (verdictLevel === 'low') return 'Low';
    if (verdictLevel === 'optimum') return 'Optimum';
    if (verdictLevel === 'high') return 'High';
    return isUnknownVerdict ? 'Unknown' : undefined;
  });
  const verdictLabelId = $derived(verdictLabel ? `${generatedId}-verdict` : undefined);

  const hasValidRange = $derived(Number.isFinite(min) && Number.isFinite(max) && max > min);
  const effectiveMin = $derived(hasValidRange ? min : DEFAULT_MIN);
  const effectiveMax = $derived(hasValidRange ? max : DEFAULT_MAX);
  const range = $derived(effectiveMax - effectiveMin);

  const hasFiniteValue = $derived(Number.isFinite(value));
  const rawValue = $derived(hasFiniteValue ? value : effectiveMin);
  const clampedValue = $derived(Math.max(effectiveMin, Math.min(effectiveMax, rawValue)));
  const hasThresholds = $derived(
    !hasVerdict &&
      ((low !== undefined && Number.isFinite(low)) ||
        (high !== undefined && Number.isFinite(high)) ||
        (optimum !== undefined && Number.isFinite(optimum))),
  );

  const lowBoundary = $derived(
    low === undefined || !Number.isFinite(low)
      ? effectiveMin
      : Math.max(effectiveMin, Math.min(effectiveMax, low)),
  );
  const highBoundary = $derived(
    high === undefined || !Number.isFinite(high)
      ? effectiveMax
      : Math.max(effectiveMin, Math.min(effectiveMax, high)),
  );

  const segmentLow = $derived(Math.min(lowBoundary, highBoundary));
  const segmentHigh = $derived(Math.max(lowBoundary, highBoundary));
  const effectiveOptimum = $derived(
    optimum === undefined || !Number.isFinite(optimum)
      ? effectiveMin + range / 2
      : Math.max(effectiveMin, Math.min(effectiveMax, optimum)),
  );
  const optimumDirection = $derived.by<OptimumDirection>(() => {
    if (effectiveOptimum <= segmentLow) return 'low';
    if (effectiveOptimum >= segmentHigh) return 'high';
    return 'mid';
  });
  const normalized = $derived((clampedValue - effectiveMin) / range);
  const progressScale = $derived(normalized);

  // `aria-label`/`aria-labelledby` can arrive two ways: forwarded through `rest` (a native
  // attribute the consumer spread onto the component) or via the bespoke `ariaLabel`/
  // `ariaLabelledby` props. Both are applied explicitly on the root element (after `{...rest}`)
  // so the spread can never silently clobber the resolved value. The rest-forwarded value wins
  // when present; the bespoke prop is the fallback. This mirrors Chip's resolved-value pattern.
  const normalizedAriaLabel = $derived.by(() => {
    const forwarded = rest['aria-label'];
    if (typeof forwarded === 'string' && forwarded.trim().length > 0) return forwarded;
    return typeof ariaLabel === 'string' && ariaLabel.trim().length > 0 ? ariaLabel : undefined;
  });
  const normalizedAriaLabelledby = $derived.by(() => {
    const forwarded = rest['aria-labelledby'];
    if (typeof forwarded === 'string' && forwarded.trim().length > 0) return forwarded;
    return typeof ariaLabelledby === 'string' && ariaLabelledby.trim().length > 0
      ? ariaLabelledby
      : undefined;
  });
  const accessibleLabel = $derived(
    isUnknownVerdict && verdictLabel && !normalizedAriaLabelledby
      ? [normalizedAriaLabel, verdictLabel].filter(Boolean).join(': ')
      : normalizedAriaLabel,
  );
  const accessibleLabelledby = $derived(
    isUnknownVerdict && normalizedAriaLabelledby && verdictLabelId
      ? `${normalizedAriaLabelledby} ${verdictLabelId}`
      : normalizedAriaLabelledby,
  );

  const meterState = $derived.by<MeterState | undefined>(() => {
    if (hasVerdict) return verdictLevel === 'unknown' ? undefined : verdictLevel;
    if (!hasThresholds) return undefined;
    if (effectiveOptimum <= segmentLow) {
      if (clampedValue <= segmentLow) return 'optimum';
      if (clampedValue < segmentHigh) return 'low';
      return 'high';
    }
    if (effectiveOptimum >= segmentHigh) {
      if (clampedValue <= segmentLow) return 'high';
      if (clampedValue < segmentHigh) return 'low';
      return 'optimum';
    }
    if (clampedValue < segmentLow) return 'low';
    if (clampedValue <= segmentHigh) return 'optimum';
    return 'high';
  });
  const valueText = $derived(hasVerdict ? verdictLabel : ariaValueText);
  const lowSegmentTone = $derived<MeterState>(
    optimumDirection === 'low' ? 'optimum' : optimumDirection === 'high' ? 'high' : 'low',
  );
  const optimumSegmentTone = $derived<MeterState>(optimumDirection === 'mid' ? 'optimum' : 'low');
  const highSegmentTone = $derived<MeterState>(optimumDirection === 'high' ? 'optimum' : 'high');

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
    if (verdict !== undefined && verdictLevel === undefined) {
      devWarn(
        '[cinder/Meter] verdict.level must be one of "low", "optimum", "high", or "unknown". Ignoring the malformed verdict.',
      );
    }
    const suppliedVerdictLabel = (verdict as { label?: unknown } | undefined)?.label;
    if (
      verdictLevel !== undefined &&
      (typeof suppliedVerdictLabel !== 'string' || suppliedVerdictLabel.trim().length === 0)
    ) {
      devWarn(
        isUnknownVerdict
          ? '[cinder/Meter] an unknown verdict requires a non-empty label. Falling back to "Unknown".'
          : `[cinder/Meter] a ${verdictLevel} verdict requires a non-empty label. Falling back to "${verdictLabel}".`,
      );
    }
    const hasAriaLabel = normalizedAriaLabel !== undefined;
    const hasAriaLabelledby = normalizedAriaLabelledby !== undefined;
    if (!hasAriaLabel && !hasAriaLabelledby) {
      devWarn(
        '[cinder/Meter] rendered without an accessible name — pass `ariaLabel` or `ariaLabelledby`.',
      );
    }
  });
</script>

<div
  {...rest}
  class={classNames('cinder-meter', className)}
  role={isUnknownVerdict ? 'status' : 'meter'}
  aria-label={accessibleLabel}
  aria-labelledby={accessibleLabelledby}
  aria-valuemin={isUnknownVerdict ? undefined : effectiveMin}
  aria-valuemax={isUnknownVerdict ? undefined : effectiveMax}
  aria-valuenow={isUnknownVerdict ? undefined : clampedValue}
  aria-valuetext={isUnknownVerdict ? undefined : valueText}
  data-cinder-size={size}
  data-cinder-state={meterState || undefined}
  data-value={isUnknownVerdict ? undefined : clampedValue}
  data-min={isUnknownVerdict ? undefined : effectiveMin}
  data-max={isUnknownVerdict ? undefined : effectiveMax}
>
  {#if hasVerdict && verdictLabel}
    <span id={verdictLabelId} class="cinder-meter__label">{verdictLabel}</span>
  {/if}
  <div class="cinder-meter__track">
    {#if hasThresholds}
      <div class="cinder-meter__segments" aria-hidden="true">
        <div
          class={classNames(
            'cinder-meter__segment',
            'cinder-meter__segment--band-low',
            `cinder-meter__segment--state-${lowSegmentTone}`,
          )}
          style:inline-size="{lowPercent}%"
        ></div>
        <div
          class={classNames(
            'cinder-meter__segment',
            'cinder-meter__segment--band-optimum',
            `cinder-meter__segment--state-${optimumSegmentTone}`,
          )}
          style:inline-size="{optimumPercent}%"
        ></div>
        <div
          class={classNames(
            'cinder-meter__segment',
            'cinder-meter__segment--band-high',
            `cinder-meter__segment--state-${highSegmentTone}`,
          )}
          style:inline-size="{highPercent}%"
        ></div>
      </div>
    {/if}
    {#if !isUnknownVerdict}
      <div class="cinder-meter__fill" style:--_cinder-meter-progress={progressScale}></div>
    {/if}
  </div>
</div>
