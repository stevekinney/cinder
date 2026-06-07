<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status alpha
   * @purpose Responsive SVG frequency-bin bar chart for visualizing audio spectrum magnitude data.
   * @tag chart
   * @tag spectrum
   * @tag signal
   * @tag audio
   * @useWhen Displaying pre-computed frequency-domain magnitude data from an FFT or spectrum analyzer.
   * @useWhen Showing a static frequency response or spectrum snapshot with labelled frequency bins.
   * @avoidWhen Real-time live audio spectrum is needed — feed live AnalyserNode data as props yourself.
   * @avoidWhen A full time × frequency heatmap is needed — use spectrogram instead.
   * @avoidWhen General categorical bar comparison — use bar-chart instead.
   * @related waveform, spectrogram, bar-chart
   */
  export type { SpectrumChartProps, SpectrumChartSchemaProps } from './spectrum-chart.types.ts';
</script>

<script lang="ts">
  import { dataTableClass, formatNumericValue } from '../../_internal/chart/chart-utilities.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import type { SpectrumChartProps } from './spectrum-chart.types.ts';

  let {
    label,
    description,
    bins,
    height = 160,
    loading = false,
    dataTableVisibility = 'screen-reader-only',
    dataTableCaption,
    class: customClassName,
    empty,
    loadingContent,
    id,
    ...rest
  }: SpectrumChartProps = $props();

  const generatedId = $props.id();
  const rootId = $derived(id ?? generatedId);
  const descriptionId = $derived(description ? `${rootId}-description` : undefined);

  const marginTop = 8;
  const marginRight = 8;
  const marginBottom = 32;
  const marginLeft = 40;

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

  const plotWidth = $derived(Math.max(1, measuredWidth - marginLeft - marginRight));
  const plotHeight = $derived(Math.max(1, height - marginTop - marginBottom));

  const isEmpty = $derived(bins.length === 0);

  // Spectrum magnitudes are linear non-negative. Coerce each bin's value to a
  // finite, non-negative number so a stray NaN/Infinity/negative can't break the
  // axis domain or invert bar geometry.
  function sanitizeMagnitude(value: number): number {
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  // Single-pass max over the sanitized magnitudes — NOT Math.max(...spread),
  // which can overflow the argument limit on a very large bin array.
  const maxValue = $derived.by(() => {
    let max = 0;
    for (const bin of bins) {
      const magnitude = sanitizeMagnitude(bin.value);
      if (magnitude > max) max = magnitude;
    }
    return max;
  });

  // Y-axis ticks (5 ticks from 0 to maxValue)
  const tickCount = 5;
  const yTicks = $derived.by(() => {
    if (maxValue <= 0) return [0];
    return Array.from({ length: tickCount }, (_, index) => (maxValue * index) / (tickCount - 1));
  });

  function scaleY(value: number): number {
    if (maxValue <= 0) return plotHeight;
    return plotHeight - (value / maxValue) * plotHeight;
  }

  const barWidth = $derived(bins.length > 0 ? plotWidth / bins.length : 0);

  type SpectrumBar = {
    x: number;
    y: number;
    barHeight: number;
    barWidth: number;
    label: string;
    value: number;
  };
  const spectrumBars = $derived.by((): SpectrumBar[] => {
    return bins.map((bin, index) => {
      const magnitude = sanitizeMagnitude(bin.value);
      // Scale against the real maxValue (with a zero guard) — NOT Math.max(maxValue, 1),
      // which would prevent data whose max is < 1 from ever reaching the top tick.
      const barHeight = maxValue > 0 ? (magnitude / maxValue) * plotHeight : 0;
      return {
        x: index * barWidth + 1,
        y: plotHeight - barHeight,
        barHeight,
        barWidth: Math.max(1, barWidth - 2),
        label: bin.label,
        value: magnitude,
      };
    });
  });

  // Show only a subset of x-axis labels to avoid clutter
  const maxXLabels = 8;
  const xLabelStep = $derived(Math.max(1, Math.ceil(bins.length / maxXLabels)));

  const hasDataTable = $derived(dataTableVisibility !== 'hidden');
</script>

<figure
  {...rest}
  bind:this={rootElement}
  id={rootId}
  class={classNames('cinder-spectrum-chart', customClassName)}
  aria-label={label}
  aria-describedby={descriptionId}
>
  {#if description}
    <p id={descriptionId} class="cinder-spectrum-chart__description">{description}</p>
  {/if}
  <div
    class="cinder-spectrum-chart__viewport"
    style:height="{height}px"
    data-cinder-loading={loading || undefined}
  >
    {#if loading}
      <div class="cinder-spectrum-chart__state">
        {#if loadingContent}{@render loadingContent()}{:else}Loading…{/if}
      </div>
    {:else if isEmpty}
      <div class="cinder-spectrum-chart__state">
        {#if empty}{@render empty()}{:else}No spectrum data{/if}
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
      <g transform={`translate(${marginLeft}, ${marginTop})`}>
        <!-- Y-axis ticks -->
        {#each yTicks as tick, index (index)}
          <text
            class="cinder-spectrum-chart__tick-label"
            x={-6}
            y={scaleY(tick)}
            text-anchor="end"
            dominant-baseline="middle"
            >{formatNumericValue(tick, undefined, undefined, { index })}</text
          >
          <line
            class="cinder-spectrum-chart__grid-line"
            x1="0"
            x2={plotWidth}
            y1={scaleY(tick)}
            y2={scaleY(tick)}
            aria-hidden="true"
          />
        {/each}
        <!-- Frequency bars -->
        {#each spectrumBars as bar, index (index)}
          <rect
            class="cinder-spectrum-chart__bar"
            x={bar.x}
            y={bar.y}
            width={bar.barWidth}
            height={bar.barHeight}
            aria-hidden="true"
            data-cinder-bin={bar.label}
          />
        {/each}
        <!-- X-axis frequency labels (sampled to avoid overlap) -->
        {#each spectrumBars as bar, index (index)}
          {#if index % xLabelStep === 0}
            <text
              class="cinder-spectrum-chart__tick-label"
              x={bar.x + bar.barWidth / 2}
              y={plotHeight + 16}
              text-anchor="middle"
              dominant-baseline="auto">{bar.label}</text
            >
          {/if}
        {/each}
      </g>
    </svg>
  </div>
  {#if hasDataTable}
    <table class={dataTableClass(dataTableVisibility)}>
      <caption>{dataTableCaption ?? label}</caption>
      <thead>
        <tr>
          <th scope="col">Frequency</th>
          <th scope="col">Magnitude</th>
        </tr>
      </thead>
      <tbody>
        <!-- Keyed by index, not label: frequency-bin labels are not guaranteed unique. -->
        {#each spectrumBars as bar, index (index)}
          <tr>
            <td>{bar.label}</td>
            <td>{formatNumericValue(bar.value, undefined, undefined, { index: 0 })}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</figure>
