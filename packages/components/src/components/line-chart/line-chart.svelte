<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Responsive SVG line chart for comparing one or more numeric series over an ordered x domain.
   * @tag chart
   * @tag line
   * @tag analytics
   * @useWhen Showing trends over time or another ordered domain.
   * @useWhen Comparing several metric series on the same numeric axis.
   * @avoidWhen Comparing discrete category totals — use bar-chart instead.
   * @avoidWhen Showing cumulative filled trends — use area-chart instead.
   * @related area-chart, bar-chart, table, statistic
   */
  export type { LineChartProps, LineChartSchemaProps } from './line-chart.types.ts';
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import {
    assertValidNonNegativeInteger,
    chartPaletteColor,
    createCartesianModel,
    dataTableClass,
    formatNumericValue,
    legendVisible,
    observeChartFontLoading,
    type ChartTarget,
  } from '../../_internal/chart/chart-utilities.ts';
  import {
    DEFAULT_CHART_FOCUS_RING_STROKE_PADDING,
    createPointFocusRingGeometry,
  } from '../../_internal/chart/chart-focus-ring.ts';
  import { ChartInteraction } from '../../_internal/chart/chart-interaction.svelte.ts';
  import ChartDataTable from '../_internal/chart-data-table.svelte';
  import ChartTooltip from '../_internal/chart-tooltip.svelte';
  import { classNames } from '../../utilities/class-names.ts';
  import type { LineChartProps } from './line-chart.types.ts';

  let {
    label,
    description,
    series,
    height = 280,
    xAxis,
    yAxis,
    legendPosition = 'top',
    hiddenSeriesIds = $bindable([]),
    loading = false,
    dataTableCaption,
    dataTableVisibility = 'screen-reader-only',
    maximumInteractivePoints = 500,
    theme,
    tooltip = false,
    mark,
    class: customClassName,
    empty,
    loadingContent,
    id,
    ...rest
  }: LineChartProps = $props();

  const generatedId = $props.id();
  const rootId = $derived(id ?? generatedId);
  const descriptionId = $derived(description ? `${rootId}-description` : undefined);

  // Shared interaction state — pointer/keyboard targets and resize measurement.
  // Pointer axis defaults to 'x', which is correct for line/area charts.
  const interaction = new ChartInteraction();

  let rootElement = $state<HTMLElement>();
  let measureText = $state(false);
  let measurementVersion = $state(0);
  onMount(() => {
    measureText = true;
    return observeChartFontLoading(() => {
      measurementVersion += 1;
    });
  });

  $effect(() => {
    if (!rootElement) return;
    return interaction.observeResize(rootElement);
  });

  const model = $derived(
    createCartesianModel({
      componentId: 'line-chart',
      series,
      hiddenSeriesIds,
      width: interaction.measuredWidth,
      height,
      xAxis,
      yAxis,
      theme,
      measureText,
      measurementElement: rootElement,
      measurementVersion,
    }),
  );
  const keyboardEnabled = $derived(
    model.targets.length > 0 && model.targets.length <= maximumInteractivePoints,
  );
  const hasDataTable = $derived(dataTableVisibility !== 'hidden');
  const guidanceId = $derived(
    !keyboardEnabled && hasDataTable && model.targets.length > 0
      ? `${rootId}-table-guidance`
      : undefined,
  );
  const focusedTarget = $derived.by(() => {
    const currentTarget = interaction.focusedTarget;
    if (!currentTarget) return undefined;
    return model.targets.find((target) => target.id === currentTarget.id);
  });
  let keyboardFocusModality = $state(false);
  let focusVisibleTargetId = $state<string>();
  const focusRingTarget = $derived(
    keyboardFocusModality && focusedTarget && focusVisibleTargetId === focusedTarget.id
      ? focusedTarget
      : undefined,
  );
  const pointFocusRing = $derived(
    focusRingTarget
      ? createPointFocusRingGeometry({
          target: focusRingTarget,
          plotWidth: model.geometry.plotWidth,
          plotHeight: model.geometry.plotHeight,
          strokePadding: DEFAULT_CHART_FOCUS_RING_STROKE_PADDING,
        })
      : null,
  );

  $effect(() => {
    assertValidNonNegativeInteger(
      'line-chart',
      'invalid-maximum-interactive-points',
      maximumInteractivePoints,
      'maximumInteractivePoints',
    );
  });

  $effect(() => {
    interaction.clearStaleTargets(loading, model.empty, model.targets);
  });

  function rememberKeyboardFocusModality(event: KeyboardEvent): void {
    if (
      event.key === 'Tab' ||
      event.key === 'Home' ||
      event.key === 'End' ||
      event.key.startsWith('Arrow')
    ) {
      keyboardFocusModality = true;
    }
  }

  function clearKeyboardFocusModality(): void {
    keyboardFocusModality = false;
    focusVisibleTargetId = undefined;
  }

  function handleTargetFocus(target: ChartTarget): void {
    interaction.focusedTarget = target;
    focusVisibleTargetId = keyboardFocusModality ? target.id : undefined;
  }

  function handleTargetBlur(): void {
    interaction.focusedTarget = undefined;
    focusVisibleTargetId = undefined;
  }

  function handleTargetKeydown(event: KeyboardEvent): void {
    rememberKeyboardFocusModality(event);
    interaction.activateByKeyboard(event, rootElement!, model.targets, keyboardEnabled);
  }
</script>

<svelte:window
  onkeydown={rememberKeyboardFocusModality}
  onpointerdown={clearKeyboardFocusModality}
/>

<figure
  {...rest}
  bind:this={rootElement}
  id={rootId}
  class={classNames('cinder-line-chart', customClassName)}
  style:--_cinder-chart-foreground={model.theme.foreground}
  style:--_cinder-chart-muted={model.theme.muted}
  style:--_cinder-chart-grid={model.theme.grid}
  style:--_cinder-chart-background={model.theme.background}
  aria-label={label}
  aria-describedby={descriptionId}
>
  {#if description}
    <p id={descriptionId} class="cinder-line-chart__description">{description}</p>
  {/if}

  {#if legendVisible(legendPosition, series.length) && legendPosition === 'top'}
    <div class="cinder-line-chart__legend" aria-label="Series">
      {#each series as item, index (item.id)}
        <button
          type="button"
          aria-pressed={!hiddenSeriesIds.includes(item.id)}
          onclick={() => (hiddenSeriesIds = interaction.toggleSeries(hiddenSeriesIds, item.id))}
        >
          <span style:background={item.color ?? chartPaletteColor(index, model.theme.palette)}
          ></span>{item.label}
        </button>
      {/each}
    </div>
  {/if}

  <div
    class="cinder-line-chart__viewport"
    style:height="{height}px"
    data-cinder-loading={loading || undefined}
  >
    {#if loading}
      <div class="cinder-line-chart__state">
        {#if loadingContent}{@render loadingContent()}{:else}Loading chart…{/if}
      </div>
    {:else if model.empty}
      <div class="cinder-line-chart__state">
        {#if empty}{@render empty()}{:else}No chart data{/if}
      </div>
    {/if}
    <svg
      viewBox={`0 0 ${interaction.measuredWidth} ${height}`}
      aria-hidden={loading || model.empty ? 'true' : undefined}
      aria-labelledby={!loading && !model.empty ? `${rootId}-svg-title` : undefined}
    >
      {#if !loading && !model.empty}
        <title id="{rootId}-svg-title">{label}</title>
        <g transform={`translate(${model.geometry.marginLeft}, ${model.geometry.marginTop})`}>
          {#each model.yTicks as tick, index (tick)}
            {@const tickY =
              model.geometry.plotHeight -
              ((tick - model.yDomain[0]) / (model.yDomain[1] - model.yDomain[0])) *
                model.geometry.plotHeight}
            <line
              class="cinder-line-chart__gridline"
              x1="0"
              x2={model.geometry.plotWidth}
              y1={tickY}
              y2={tickY}
              aria-hidden="true"
            />
            <text
              class="cinder-line-chart__tick-label"
              x="-8"
              y={tickY}
              text-anchor="end"
              dominant-baseline="middle"
              >{formatNumericValue(tick, yAxis, undefined, { index })}</text
            >
          {/each}
          {#if yAxis?.label}
            <text
              class="cinder-line-chart__axis-title"
              x={-model.geometry.plotHeight / 2}
              y={-model.geometry.marginLeft + 12}
              text-anchor="middle"
              transform="rotate(-90)">{yAxis.label}</text
            >
          {/if}
          {#each model.xTicks as tick (tick.label)}
            <text
              class="cinder-line-chart__tick-label"
              x={tick.x}
              y={model.geometry.plotHeight + 20}
              transform={xAxis?.tickLabelRotation
                ? `rotate(${xAxis.tickLabelRotation} ${tick.x} ${model.geometry.plotHeight + 20})`
                : undefined}
              text-anchor="middle">{tick.label}</text
            >
          {/each}
          {#if xAxis?.label}
            <text
              class="cinder-line-chart__axis-title"
              x={model.geometry.plotWidth / 2}
              y={model.geometry.plotHeight + model.geometry.marginBottom - 4}
              text-anchor="middle">{xAxis.label}</text
            >
          {/if}
          <!-- Series-specific rendering: connected line paths + data points. -->
          {#if mark}
            {#each model.normalizedSeries as item (item.id)}
              {#if !hiddenSeriesIds.includes(item.id)}
                {@const sourceSeries = series.find((candidate) => candidate.id === item.id)}
                {#if sourceSeries}
                  {@render mark({
                    series: sourceSeries,
                    points: item.points,
                    geometry: model.geometry,
                  })}
                {/if}
              {/if}
            {/each}
          {:else}
            {#each model.normalizedSeries as item (item.id)}
              {#if !hiddenSeriesIds.includes(item.id) && item.path}
                <path
                  class="cinder-line-chart__line"
                  d={item.path}
                  stroke={item.color}
                  aria-hidden="true"
                  data-cinder-series={item.id}
                />
                {#each item.points as point (point.x.key)}
                  {#if point.y !== null}
                    <circle
                      class="cinder-line-chart__point"
                      cx={point.pixelX}
                      cy={point.pixelY}
                      r="3"
                      fill={item.color}
                      aria-hidden="true"
                      data-cinder-series={item.id}
                    />
                  {/if}
                {/each}
              {/if}
            {/each}
          {/if}
          {#if interaction.activeTarget}
            <!-- Vertical crosshair — line charts always use a vertical indicator. -->
            <line
              class="cinder-line-chart__crosshair"
              x1={interaction.activeTarget.x}
              x2={interaction.activeTarget.x}
              y1="0"
              y2={model.geometry.plotHeight}
              aria-hidden="true"
            />
          {/if}
          {#if model.targets.length > 0}
            <rect
              class="cinder-line-chart__hit-surface"
              role="presentation"
              width={model.geometry.plotWidth}
              height={model.geometry.plotHeight}
              onpointermove={(event) => interaction.activateByPointer(event, model.targets)}
              onpointerleave={() => interaction.clearPointerTarget()}
            />
            {#if keyboardEnabled}
              {#each model.targets as target (target.id)}
                <!-- Line charts use circle focus targets centered on the data point. -->
                <circle
                  class="cinder-line-chart__focus-target"
                  cx={target.x}
                  cy={target.y}
                  r="8"
                  tabindex="0"
                  role="button"
                  data-cinder-target-id={target.id}
                  data-cinder-series-id={target.seriesId}
                  data-cinder-focus-ring-active={pointFocusRing && focusRingTarget?.id === target.id
                    ? 'true'
                    : undefined}
                  aria-label={`${target.seriesLabel}, ${target.xLabel}, ${target.valueLabel}`}
                  aria-describedby={tooltip && interaction.activeTarget?.id === target.id
                    ? `${rootId}-tooltip`
                    : undefined}
                  onfocus={() => handleTargetFocus(target)}
                  onblur={handleTargetBlur}
                  onkeydown={handleTargetKeydown}
                />
              {/each}
            {/if}
          {/if}
          {#if pointFocusRing}
            <g class="cinder-line-chart__focus-ring-layer" aria-hidden="true">
              {#if pointFocusRing.kind === 'point'}
                <circle
                  class="cinder-line-chart__focus-ring-halo"
                  cx={pointFocusRing.cx}
                  cy={pointFocusRing.cy}
                  r={pointFocusRing.radius}
                />
                <circle
                  class="cinder-line-chart__focus-ring"
                  cx={pointFocusRing.cx}
                  cy={pointFocusRing.cy}
                  r={pointFocusRing.radius}
                />
                {#if pointFocusRing.connector && pointFocusRing.dot}
                  <path
                    class="cinder-line-chart__focus-ring-connector cinder-line-chart__focus-ring-halo"
                    d={`M ${pointFocusRing.connector.x1} ${pointFocusRing.connector.y1} L ${pointFocusRing.connector.x2} ${pointFocusRing.connector.y2}`}
                  />
                  <path
                    class="cinder-line-chart__focus-ring-connector cinder-line-chart__focus-ring"
                    d={`M ${pointFocusRing.connector.x1} ${pointFocusRing.connector.y1} L ${pointFocusRing.connector.x2} ${pointFocusRing.connector.y2}`}
                  />
                  <circle
                    class="cinder-line-chart__focus-ring-dot cinder-line-chart__focus-ring-halo"
                    cx={pointFocusRing.dot.cx}
                    cy={pointFocusRing.dot.cy}
                    r={pointFocusRing.dot.radius}
                  />
                  <circle
                    class="cinder-line-chart__focus-ring-dot cinder-line-chart__focus-ring"
                    cx={pointFocusRing.dot.cx}
                    cy={pointFocusRing.dot.cy}
                    r={pointFocusRing.dot.radius}
                  />
                {/if}
              {:else}
                <rect
                  class="cinder-line-chart__focus-ring-halo"
                  x={pointFocusRing.x}
                  y={pointFocusRing.y}
                  width={pointFocusRing.width}
                  height={pointFocusRing.height}
                  rx={pointFocusRing.radius}
                />
                <rect
                  class="cinder-line-chart__focus-ring"
                  x={pointFocusRing.x}
                  y={pointFocusRing.y}
                  width={pointFocusRing.width}
                  height={pointFocusRing.height}
                  rx={pointFocusRing.radius}
                />
              {/if}
            </g>
          {/if}
        </g>
      {/if}
    </svg>
    {#if tooltip}
      <ChartTooltip
        id={`${rootId}-tooltip`}
        target={interaction.activeTarget}
        geometry={model.geometry}
        content={tooltip}
      />
    {/if}
  </div>

  {#if guidanceId}
    <p id={guidanceId} class="cinder-sr-only">
      Use the data table to inspect this chart with a keyboard.
    </p>
  {/if}

  {#if hasDataTable}
    <ChartDataTable
      caption={dataTableCaption ?? label}
      headers={['Series', 'X', 'Value']}
      rows={model.tableRows.map((row) => ({
        id: row.id,
        header: row.seriesLabel,
        cells: [row.xLabel, row.valueLabel],
      }))}
      visibilityClass={dataTableClass(dataTableVisibility)}
      describedBy={guidanceId}
    />
  {/if}

  {#if legendVisible(legendPosition, series.length) && legendPosition === 'bottom'}
    <div class="cinder-line-chart__legend" aria-label="Series">
      {#each series as item, index (item.id)}
        <button
          type="button"
          aria-pressed={!hiddenSeriesIds.includes(item.id)}
          onclick={() => (hiddenSeriesIds = interaction.toggleSeries(hiddenSeriesIds, item.id))}
        >
          <span style:background={item.color ?? chartPaletteColor(index, model.theme.palette)}
          ></span>{item.label}
        </button>
      {/each}
    </div>
  {/if}
</figure>
