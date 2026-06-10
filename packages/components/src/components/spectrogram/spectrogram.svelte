<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status alpha
   * @purpose Responsive SVG time × frequency heatmap for visualizing audio spectrogram data.
   * @tag chart
   * @tag spectrogram
   * @tag signal
   * @tag audio
   * @useWhen Visualizing how frequency content of a signal changes over time (time × frequency heatmap).
   * @useWhen Displaying pre-computed spectrogram frames from an FFT or short-time Fourier transform.
   * @avoidWhen Only a single spectrum snapshot is needed — use spectrum-chart instead.
   * @avoidWhen Real-time live audio spectrogram is needed — feed frames as props yourself.
   * @avoidWhen A categorical × categorical heatmap without a time axis is needed — use matrix-chart instead.
   * @related spectrum-chart, waveform, matrix-chart
   */
  export type {
    SpectrogramFrame,
    SpectrogramProps,
    SpectrogramSchemaProps,
  } from './spectrogram.types.ts';
</script>

<script lang="ts">
  import { dataTableClass } from '../../_internal/chart/chart-utilities.ts';
  import {
    heatmapCellFill,
    heatmapDomain,
    toFiniteOrNull,
  } from '../../_internal/chart/heatmap-utilities.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import type { SpectrogramProps } from './spectrogram.types.ts';

  let {
    label,
    description,
    frames,
    frequencyLabels,
    height = 200,
    loading = false,
    dataTableVisibility = 'screen-reader-only',
    dataTableCaption,
    class: customClassName,
    empty,
    loadingContent,
    id,
    ...rest
  }: SpectrogramProps = $props();

  const generatedId = $props.id();
  const rootId = $derived(id ?? generatedId);
  const descriptionId = $derived(description ? `${rootId}-description` : undefined);

  const marginTop = 8;
  const marginRight = 16;
  const marginBottom = 32;
  const marginLeft = 60;

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

  // Frequency-bin count is the MAX across frames so ragged input renders a full
  // rectangular grid: shorter frames leave explicit missing cells rather than
  // overflowing the plot or silently dropping rows.
  const binCount = $derived(frames.reduce((max, frame) => Math.max(max, frame.bins.length), 0));

  // A frame with zero bins contributes no usable data; the chart is "empty" when
  // there are no frames OR no frequency bins anywhere.
  const isEmpty = $derived(frames.length === 0 || binCount === 0);

  // Cell dimensions
  const cellWidth = $derived(frames.length > 0 ? plotWidth / frames.length : 0);
  const cellHeight = $derived(binCount > 0 ? plotHeight / binCount : 0);

  // Read a frame's bin as a finite value or null (missing). Non-finite values
  // (NaN/Infinity) and out-of-range indices (ragged frames) are missing.
  function binValueAt(frameIndex: number, binIndex: number): number | null {
    return toFiniteOrNull(frames[frameIndex]?.bins[binIndex]);
  }

  // Global color domain over the finite values only (shared with MatrixChart).
  const domain = $derived(heatmapDomain(frames.flatMap((frame) => frame.bins)));

  function cellFill(value: number | null): string {
    return heatmapCellFill(value, domain, 'sequential');
  }

  // Convert a bin index to a y-coordinate. Frequency increases UPWARD (the audio
  // convention): bin 0 (lowest frequency) sits at the BOTTOM of the plot.
  function binY(binIndex: number): number {
    return plotHeight - (binIndex + 1) * cellHeight;
  }

  // Frequency axis labels, one per bin index. A PARTIAL `frequencyLabels` is
  // honoured per-index — a provided label is used where present, and bins beyond
  // its length fall back to the numeric index (rather than discarding all of the
  // provided labels just because later/ragged frames added extra bins).
  const yLabels = $derived.by(() =>
    Array.from({ length: binCount }, (_, index) => frequencyLabels?.[index] ?? String(index)),
  );

  // Show a subset of y-axis labels
  const maxYLabels = 8;
  const yLabelStep = $derived(Math.max(1, Math.ceil(binCount / maxYLabels)));

  // Show a subset of x-axis (time) labels
  const maxXLabels = 10;
  const xLabelStep = $derived(Math.max(1, Math.ceil(frames.length / maxXLabels)));

  const hasDataTable = $derived(dataTableVisibility !== 'hidden');

  // Table rows: each frame is a column; rows are frequency bins.
  // For accessibility, sample every-Nth frame and bin so the full range is represented
  // rather than silently truncating to first-N.
  const maxTableFrames = 10;
  const maxTableBins = 10;
  const tableFrameStep = $derived(Math.max(1, Math.ceil(frames.length / maxTableFrames)));
  const tableBinStep = $derived(Math.max(1, Math.ceil(binCount / maxTableBins)));
  const tableFrames = $derived(
    frames
      .map((frame, frameIndex) => ({ frame, frameIndex }))
      .filter((_, index) => index % tableFrameStep === 0)
      .slice(0, maxTableFrames),
  );
  // Bins listed top-to-bottom to MATCH the visual: the SVG places bin 0 (lowest
  // frequency) at the bottom, so the table's first row is the highest sampled
  // bin and the last row is bin 0 — a screen-reader user reads the same vertical
  // frequency order they would see.
  const tableBinIndices = $derived(
    Array.from({ length: binCount }, (_, index) => index)
      .filter((index) => index % tableBinStep === 0)
      .slice(0, maxTableBins)
      .reverse(),
  );
  const isTruncated = $derived(frames.length > maxTableFrames || binCount > maxTableBins);
  const tableCaption = $derived(
    isTruncated
      ? `${dataTableCaption ?? label} (showing ${tableFrames.length} of ${frames.length} frames, ${tableBinIndices.length} of ${binCount} bins)`
      : (dataTableCaption ?? label),
  );

  function formatValue(value: number | null): string {
    if (value === null) return '—';
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
  }
</script>

<figure
  {...rest}
  bind:this={rootElement}
  id={rootId}
  class={classNames('cinder-spectrogram', customClassName)}
  aria-label={label}
  aria-describedby={descriptionId}
>
  {#if description}
    <p id={descriptionId} class="cinder-spectrogram__description">{description}</p>
  {/if}
  <div
    class="cinder-spectrogram__viewport"
    style:height="{height}px"
    data-cinder-loading={loading || undefined}
  >
    {#if loading}
      <div class="cinder-spectrogram__state">
        {#if loadingContent}{@render loadingContent()}{:else}Loading…{/if}
      </div>
    {:else if isEmpty}
      <div class="cinder-spectrogram__state">
        {#if empty}{@render empty()}{:else}No spectrogram data{/if}
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
        <!-- Frequency cells: a full frames × binCount rectangular grid. Ragged or
             non-finite cells render as the "missing" fill. Low frequency (bin 0)
             is at the bottom. -->
        {#each frames as _frame, frameIndex (frameIndex)}
          {#each Array.from({ length: binCount }, (_, binIndex) => binIndex) as binIndex (binIndex)}
            <rect
              class="cinder-spectrogram__cell"
              x={frameIndex * cellWidth}
              y={binY(binIndex)}
              width={cellWidth}
              height={cellHeight}
              fill={cellFill(binValueAt(frameIndex, binIndex))}
              aria-hidden="true"
            />
          {/each}
        {/each}
        <!-- Y-axis frequency labels (bin 0 / lowest frequency at the bottom) -->
        {#each yLabels as yLabel, index (index)}
          {#if index % yLabelStep === 0}
            <text
              class="cinder-spectrogram__tick-label"
              x={-6}
              y={binY(index) + cellHeight / 2}
              text-anchor="end"
              dominant-baseline="middle">{yLabel}</text
            >
          {/if}
        {/each}
        <!-- X-axis time labels -->
        {#each frames as frame, index (index)}
          {#if index % xLabelStep === 0}
            <text
              class="cinder-spectrogram__tick-label"
              x={index * cellWidth + cellWidth / 2}
              y={plotHeight + 16}
              text-anchor="middle"
              dominant-baseline="auto">{frame.label}</text
            >
          {/if}
        {/each}
      </g>
    </svg>
  </div>
  {#if hasDataTable}
    <table class={dataTableClass(dataTableVisibility)}>
      <caption>{tableCaption}</caption>
      <thead>
        <tr>
          <th scope="col">Frequency bin</th>
          {#each tableFrames as entry (entry.frameIndex)}
            <th scope="col">{entry.frame.label}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each tableBinIndices as binIndex (binIndex)}
          <tr>
            <th scope="row">{yLabels[binIndex] ?? binIndex}</th>
            {#each tableFrames as entry (entry.frameIndex)}
              <td>{formatValue(binValueAt(entry.frameIndex, binIndex))}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</figure>
