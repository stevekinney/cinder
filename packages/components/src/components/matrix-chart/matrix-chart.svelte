<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status alpha
   * @purpose Categorical × categorical heatmap for dense analytics, confusion matrices, and correlation grids.
   * @tag chart
   * @tag heatmap
   * @tag matrix
   * @tag analytics
   * @useWhen Showing density or magnitude across two categorical dimensions simultaneously.
   * @useWhen Rendering a confusion matrix where rows are actual classes and columns are predicted classes.
   * @avoidWhen Showing a continuous trend over time — use line-chart instead.
   * @avoidWhen Comparing discrete category totals — use bar-chart instead.
   * @related bar-chart, line-chart, area-chart
   */
  export type { MatrixChartProps, MatrixChartSchemaProps } from './matrix-chart.types.ts';
</script>

<script lang="ts">
  import { dataTableClass } from '../../_internal/chart/chart-utilities.ts';
  import {
    heatmapCellFill,
    heatmapDomain,
    heatmapLabelFill,
    toFiniteOrNull,
  } from '../../_internal/chart/heatmap-utilities.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import type { MatrixChartProps } from './matrix-chart.types.ts';

  let {
    label,
    description,
    data,
    xField,
    yField,
    valueField,
    colorScale = 'sequential',
    showCellLabels = true,
    height = 280,
    loading = false,
    dataTableCaption,
    dataTableVisibility = 'screen-reader-only',
    class: customClassName,
    empty,
    loadingContent,
    id,
    ...rest
  }: MatrixChartProps = $props();

  const generatedId = $props.id();
  const rootId = $derived(id ?? generatedId);
  const descriptionId = $derived(description ? `${rootId}-description` : undefined);

  // Geometry constants
  const marginTop = 40;
  const marginRight = 16;
  const marginBottom = 16;
  const marginLeft = 80;

  let measuredWidth = $state(400);
  let rootElement = $state<HTMLElement>();

  $effect(() => {
    const element = rootElement;
    if (!element) return;
    // Guard for SSR / test environments without ResizeObserver — fall back to a
    // one-shot measurement so the chart still renders at a sensible width.
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

  // Collect unique x and y labels in insertion order
  const xLabels = $derived.by(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const datum of data) {
      const value = datum[xField];
      if (value === null || value === undefined) continue;
      const label = String(value);
      if (!seen.has(label)) {
        seen.add(label);
        result.push(label);
      }
    }
    return result;
  });

  const yLabels = $derived.by(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const datum of data) {
      const value = datum[yField];
      if (value === null || value === undefined) continue;
      const label = String(value);
      if (!seen.has(label)) {
        seen.add(label);
        result.push(label);
      }
    }
    return result;
  });

  const isEmpty = $derived(xLabels.length === 0 || yLabels.length === 0);

  // Cell pixel dimensions
  const cellWidth = $derived(xLabels.length > 0 ? plotWidth / xLabels.length : 0);
  const cellHeight = $derived(yLabels.length > 0 ? plotHeight / yLabels.length : 0);

  // Build value lookup and find min/max for color scaling
  type CellData = {
    /** Stable, collision-free key built from the grid indices (labels may contain `::`). */
    key: string;
    xLabel: string;
    yLabel: string;
    value: number | null;
    x: number;
    y: number;
    width: number;
    height: number;
  };

  // Nested x → (y → value) lookup. A nested map avoids the string-join collision
  // where `x="A::B", y="C"` and `x="A", y="B::C"` would share a flat `A::B::C` key.
  const valueLookup = $derived.by((): Map<string, Map<string, number | null>> => {
    const lookup = new Map<string, Map<string, number | null>>();
    for (const datum of data) {
      const xRaw = datum[xField];
      const yRaw = datum[yField];
      if (xRaw === null || xRaw === undefined) continue;
      if (yRaw === null || yRaw === undefined) continue;
      const xKey = String(xRaw);
      const yKey = String(yRaw);
      let column = lookup.get(xKey);
      if (!column) {
        column = new Map<string, number | null>();
        lookup.set(xKey, column);
      }
      // Non-finite values (NaN / Infinity) are treated as missing rather than
      // poisoning the domain, normalization, and color-mix percentages.
      column.set(yKey, toFiniteOrNull(datum[valueField]));
    }
    return lookup;
  });

  function lookupValue(xLabel: string, yLabel: string): number | null {
    return valueLookup.get(xLabel)?.get(yLabel) ?? null;
  }

  const cells = $derived.by((): CellData[] => {
    const result: CellData[] = [];
    for (const [yIndex, currentYLabel] of yLabels.entries()) {
      for (const [xIndex, currentXLabel] of xLabels.entries()) {
        result.push({
          key: `${xIndex}:${yIndex}`,
          xLabel: currentXLabel,
          yLabel: currentYLabel,
          value: lookupValue(currentXLabel, currentYLabel),
          x: xIndex * cellWidth,
          y: yIndex * cellHeight,
          width: cellWidth,
          height: cellHeight,
        });
      }
    }
    return result;
  });

  // Domain over the finite values only (shared with Spectrogram). Diverging is
  // zero-centred inside the utility so 0 always maps to the neutral midpoint.
  const domain = $derived(heatmapDomain(cells.map((cell) => cell.value)));

  function cellFill(value: number | null): string {
    return heatmapCellFill(value, domain, colorScale);
  }

  function formatValue(value: number | null): string {
    if (value === null) return '';
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
  }

  function cellLabelFill(value: number | null): string {
    return heatmapLabelFill(value, domain, colorScale);
  }

  const hasDataTable = $derived(dataTableVisibility !== 'hidden');

  // Table rows for the data table fallback: xLabel × yLabel grid. Reuses the
  // nested lookup (O(1) per cell) instead of scanning the flattened cells array.
  const tableRows = $derived.by(() => {
    return yLabels.map((currentYLabel) => {
      const values = xLabels.map((currentXLabel) => ({
        xLabel: currentXLabel,
        value: lookupValue(currentXLabel, currentYLabel),
      }));
      return { yLabel: currentYLabel, values };
    });
  });
</script>

<figure
  {...rest}
  bind:this={rootElement}
  id={rootId}
  class={classNames('cinder-matrix-chart', customClassName)}
  aria-label={label}
  aria-describedby={descriptionId}
  data-cinder-color-scale={colorScale}
>
  {#if description}
    <p id={descriptionId} class="cinder-matrix-chart__description">{description}</p>
  {/if}
  <div
    class="cinder-matrix-chart__viewport"
    style:height="{height}px"
    data-cinder-loading={loading || undefined}
  >
    {#if loading}
      <div class="cinder-matrix-chart__state">
        {#if loadingContent}{@render loadingContent()}{:else}Loading chart…{/if}
      </div>
    {:else if isEmpty}
      <div class="cinder-matrix-chart__state">
        {#if empty}{@render empty()}{:else}No chart data{/if}
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
        <!-- X-axis labels (column headers) -->
        {#each xLabels as xLabel, index (xLabel)}
          <text
            class="cinder-matrix-chart__tick-label"
            x={index * cellWidth + cellWidth / 2}
            y={-8}
            text-anchor="middle"
            dominant-baseline="auto">{xLabel}</text
          >
        {/each}
        <!-- Y-axis labels (row headers) -->
        {#each yLabels as yLabel, index (yLabel)}
          <text
            class="cinder-matrix-chart__tick-label"
            x={-8}
            y={index * cellHeight + cellHeight / 2}
            text-anchor="end"
            dominant-baseline="middle">{yLabel}</text
          >
        {/each}
        <!-- Matrix cells -->
        {#each cells as cell (cell.key)}
          <g>
            <rect
              class="cinder-matrix-chart__cell"
              x={cell.x}
              y={cell.y}
              width={cell.width}
              height={cell.height}
              fill={cellFill(cell.value)}
              aria-hidden="true"
              data-cinder-x={cell.xLabel}
              data-cinder-y={cell.yLabel}
            >
              <title
                >{cell.xLabel} × {cell.yLabel}: {cell.value !== null
                  ? formatValue(cell.value)
                  : 'no data'}</title
              >
            </rect>
            {#if showCellLabels && cell.value !== null}
              <text
                class="cinder-matrix-chart__cell-label"
                x={cell.x + cell.width / 2}
                y={cell.y + cell.height / 2}
                text-anchor="middle"
                dominant-baseline="middle"
                fill={cellLabelFill(cell.value)}
                aria-hidden="true">{formatValue(cell.value)}</text
              >
            {/if}
          </g>
        {/each}
      </g>
    </svg>
  </div>
  {#if hasDataTable}
    <table class={dataTableClass(dataTableVisibility)}>
      <caption>{dataTableCaption ?? label}</caption>
      <thead>
        <tr>
          <th scope="col">{yField}</th>
          {#each xLabels as xLabel (xLabel)}
            <th scope="col">{xLabel}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each tableRows as row (row.yLabel)}
          <tr>
            <th scope="row">{row.yLabel}</th>
            {#each row.values as cell (cell.xLabel)}
              <td>{cell.value !== null ? formatValue(cell.value) : '—'}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</figure>
