<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status alpha
   * @purpose Responsive SVG rendering of time-domain audio amplitude data as a waveform path or bar display.
   * @tag chart
   * @tag waveform
   * @tag signal
   * @tag audio
   * @useWhen Visualizing pre-recorded or pre-processed audio amplitude samples in a static display.
   * @useWhen Showing an audio waveform thumbnail or preview with mocked or pre-computed sample data.
   * @avoidWhen Real-time live audio capture is needed — wire AudioContext / AnalyserNode yourself and feed samples as props.
   * @avoidWhen Frequency-domain data — use spectrum-chart or spectrogram instead.
   * @related spectrum-chart, spectrogram, bar-chart, line-chart
   */
  export type { WaveformProps, WaveformSchemaProps } from './waveform.types.ts';
</script>

<script lang="ts">
  import { dataTableClass } from '../../_internal/chart/chart-utilities.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import type { WaveformProps } from './waveform.types.ts';

  let {
    label,
    description,
    data,
    renderMode = 'path',
    height = 80,
    loading = false,
    dataTableVisibility = 'screen-reader-only',
    dataTableCaption,
    class: customClassName,
    empty,
    loadingContent,
    id,
    ...rest
  }: WaveformProps = $props();

  const generatedId = $props.id();
  const rootId = $derived(id ?? generatedId);
  const descriptionId = $derived(description ? `${rootId}-description` : undefined);

  let measuredWidth = $state(400);
  let rootElement = $state<HTMLElement>();

  $effect(() => {
    const element = rootElement;
    if (!element) return;
    // Guard for SSR / test environments without ResizeObserver.
    if (typeof ResizeObserver === 'undefined') {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0) measuredWidth = rect.width;
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) measuredWidth = entry.contentRect.width;
    });
    observer.observe(element);
    return () => observer.disconnect();
  });

  const isEmpty = $derived(data.length === 0);
  const midY = $derived(height / 2);

  // Cap the number of rendered geometry points so a multi-million-sample buffer
  // doesn't produce a megabyte-long path string or one <rect> per sample. We
  // downsample with a min/max envelope per bucket so transients survive. The
  // accessible table reports the ORIGINAL length and notes the sampling.
  const MAX_RENDER_POINTS = 2000;

  // Clamp a single sample to [-1, 1]; non-finite samples (NaN/Infinity) collapse
  // to the baseline (0) rather than producing invalid SVG coordinates. Applied
  // lazily per-sample so a multi-million-sample buffer is never copied wholesale
  // — only the ~MAX_RENDER_POINTS values that actually render are materialized.
  function clampSample(sample: number | undefined): number {
    return sample !== undefined && Number.isFinite(sample) ? Math.max(-1, Math.min(1, sample)) : 0;
  }

  // Envelope-downsampled samples for rendering: each bucket contributes its min
  // and max so peaks aren't lost. The two extremes are emitted in their ORIGINAL
  // temporal order (min-then-max only if the min occurred first) so the rendered
  // path doesn't invert the local waveform shape. Clamping is folded into this
  // pass so the full input buffer is never duplicated. When the data already
  // fits, we still produce a fresh clamped array of just `length` points.
  const renderSamples = $derived.by((): number[] => {
    const length = data.length;
    if (length <= MAX_RENDER_POINTS) return data.map(clampSample);
    const bucketCount = Math.floor(MAX_RENDER_POINTS / 2);
    const bucketSize = length / bucketCount;
    const out: number[] = [];
    for (let bucket = 0; bucket < bucketCount; bucket += 1) {
      const start = Math.floor(bucket * bucketSize);
      // The final bucket extends to the end so the very last sample is included.
      const end =
        bucket === bucketCount - 1
          ? length
          : Math.min(length, Math.floor((bucket + 1) * bucketSize));
      let min = clampSample(data[start]);
      let max = min;
      let minIndex = start;
      let maxIndex = start;
      for (let index = start; index < end; index += 1) {
        const sample = clampSample(data[index]);
        if (sample < min) {
          min = sample;
          minIndex = index;
        }
        if (sample > max) {
          max = sample;
          maxIndex = index;
        }
      }
      if (minIndex <= maxIndex) out.push(min, max);
      else out.push(max, min);
    }
    return out;
  });

  // Build a centered waveform path
  const waveformPath = $derived.by(() => {
    const samples = renderSamples;
    if (samples.length === 0) return '';
    // A single sample has no horizontal extent — draw a short centered tick so
    // it is visible rather than dividing by (length - 1) === 0 → NaN.
    if (samples.length === 1) {
      const x = measuredWidth / 2;
      const y = midY - samples[0]! * midY;
      return `M${(x - 1).toFixed(2)},${y.toFixed(2)}L${(x + 1).toFixed(2)},${y.toFixed(2)}`;
    }
    const points = samples.map((sample, index) => {
      const x = (index / (samples.length - 1)) * measuredWidth;
      const y = midY - sample * midY;
      return { x, y };
    });
    const firstPoint = points[0]!;
    const restPoints = points.slice(1);
    return (
      `M${firstPoint.x.toFixed(2)},${firstPoint.y.toFixed(2)}` +
      restPoints.map((point) => `L${point.x.toFixed(2)},${point.y.toFixed(2)}`).join('')
    );
  });

  // Build bar segments for bars render mode
  type WaveformBar = { x: number; y: number; height: number; width: number };
  const waveformBars = $derived.by((): WaveformBar[] => {
    const samples = renderSamples;
    if (samples.length === 0) return [];
    // x-STEP is the fractional slot width so bars always span exactly the
    // viewport, even when there are more samples than pixels. The visible WIDTH
    // is clamped to a 1px minimum independently (bars may visually overlap when
    // the step is sub-pixel, which is the correct dense-waveform appearance).
    const step = measuredWidth / samples.length;
    const visualWidth = Math.max(1, step - 1);
    return samples.map((sample, index) => {
      const amplitude = Math.abs(sample);
      // Zero amplitude renders zero height (just the baseline) — do NOT force a
      // minimum 1px bar, which would make silence look like low-level signal.
      const barHeight = amplitude * midY;
      return {
        x: index * step,
        y: midY - barHeight,
        height: barHeight * 2,
        width: visualWidth,
      };
    });
  });

  const hasDataTable = $derived(dataTableVisibility !== 'hidden');

  // Sample the clamped/sanitized samples (the values the chart actually plots)
  // for the accessible table, capped at 20 rows so the table stays readable. The
  // caption reports the true length + sampling. Clamping is applied lazily at the
  // stride points so the full buffer is never copied here either.
  const TABLE_SAMPLE_LIMIT = 20;
  const isTableSampled = $derived(data.length > TABLE_SAMPLE_LIMIT);
  const tableSamples = $derived.by(() => {
    if (data.length === 0) return [];
    const step = Math.max(1, Math.ceil(data.length / TABLE_SAMPLE_LIMIT));
    const out: { index: number; value: number }[] = [];
    for (let index = 0; index < data.length; index += step) {
      out.push({ index, value: clampSample(data[index]) });
    }
    return out;
  });
  const tableCaption = $derived.by(() => {
    const base = dataTableCaption ?? label;
    if (!isTableSampled) return base;
    return `${base} (${tableSamples.length} of ${data.length} samples shown)`;
  });
</script>

<figure
  {...rest}
  bind:this={rootElement}
  id={rootId}
  class={classNames('cinder-waveform', customClassName)}
  aria-label={label}
  aria-describedby={descriptionId}
  data-cinder-render-mode={renderMode}
>
  {#if description}
    <p id={descriptionId} class="cinder-waveform__description">{description}</p>
  {/if}
  <div
    class="cinder-waveform__viewport"
    style:height="{height}px"
    data-cinder-loading={loading || undefined}
  >
    {#if loading}
      <div class="cinder-waveform__state">
        {#if loadingContent}{@render loadingContent()}{:else}Loading…{/if}
      </div>
    {:else if isEmpty}
      <div class="cinder-waveform__state">
        {#if empty}{@render empty()}{:else}No waveform data{/if}
      </div>
    {/if}
    <svg
      role="img"
      viewBox={`0 0 ${measuredWidth} ${height}`}
      aria-hidden={loading || isEmpty ? 'true' : undefined}
      aria-labelledby={!loading && !isEmpty ? `${rootId}-svg-title` : undefined}
    >
      {#if !loading && !isEmpty}
        <title id="{rootId}-svg-title">{label}</title>
      {/if}
      {#if !loading && !isEmpty}
        <!-- Center baseline -->
        <line
          class="cinder-waveform__baseline"
          x1="0"
          x2={measuredWidth}
          y1={midY}
          y2={midY}
          aria-hidden="true"
        />
        {#if renderMode === 'bars'}
          {#each waveformBars as bar, index (index)}
            <rect
              class="cinder-waveform__bar"
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
              aria-hidden="true"
            />
          {/each}
        {:else}
          <path class="cinder-waveform__path" d={waveformPath} aria-hidden="true" />
        {/if}
      {/if}
    </svg>
  </div>
  {#if hasDataTable}
    <table class={dataTableClass(dataTableVisibility)}>
      <caption>{tableCaption}</caption>
      <thead>
        <tr>
          <th scope="col">Sample index</th>
          <th scope="col">Amplitude</th>
        </tr>
      </thead>
      <tbody>
        {#each tableSamples as sample (sample.index)}
          <tr>
            <td>{sample.index}</td>
            <td>{sample.value.toFixed(4)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</figure>
