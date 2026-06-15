<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Filled SVG area chart for showing magnitude and cumulative trends across an ordered x domain.
   * @tag chart
   * @tag area
   * @tag analytics
   * @useWhen Showing magnitude under a trend line.
   * @useWhen Comparing cumulative or stacked contribution over an ordered domain.
   * @avoidWhen Exact point comparison matters more than area magnitude — use line-chart instead.
   * @avoidWhen Comparing discrete category totals — use bar-chart instead.
   * @related line-chart, bar-chart, table, stat
   */
  export type { AreaChartProps, AreaChartSchemaProps } from './area-chart.types.ts';
</script>

<script lang="ts">
  import {
    assertValidNonNegativeInteger,
    chartPaletteColor,
    createCartesianModel,
    dataTableClass,
    formatNumericValue,
    legendVisible,
    type ChartTarget,
  } from '../../_internal/chart/chart-utilities.ts';
  import {
    DEFAULT_CHART_FOCUS_RING_STROKE_PADDING,
    createPointFocusRingGeometry,
  } from '../../_internal/chart/chart-focus-ring.ts';
  import { ChartInteraction } from '../../_internal/chart/chart-interaction.svelte.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import type { AreaChartProps } from './area-chart.types.ts';

  let {
    label,
    description,
    series,
    mode = 'single',
    height = 280,
    xAxis,
    yAxis,
    legendPosition = 'top',
    hiddenSeriesIds = $bindable([]),
    loading = false,
    dataTableCaption,
    dataTableVisibility = 'screen-reader-only',
    maximumInteractivePoints = 500,
    class: customClassName,
    empty,
    loadingContent,
    id,
    ...rest
  }: AreaChartProps = $props();

  const generatedId = $props.id();
  const rootId = $derived(id ?? generatedId);
  const descriptionId = $derived(description ? `${rootId}-description` : undefined);

  // Shared interaction state — pointer/keyboard targets and resize measurement.
  // Pointer axis defaults to 'x', which is correct for line/area charts.
  const interaction = new ChartInteraction();

  let rootElement = $state<HTMLElement>();

  $effect(() => {
    if (!rootElement) return;
    return interaction.observeResize(rootElement);
  });

  const model = $derived(
    createCartesianModel({
      componentId: 'area-chart',
      series,
      hiddenSeriesIds,
      width: interaction.measuredWidth,
      height,
      xAxis,
      yAxis,
      stackedArea: mode === 'stacked',
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
      'area-chart',
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
  class={classNames('cinder-area-chart', customClassName)}
  aria-label={label}
  aria-describedby={descriptionId}
  data-cinder-mode={mode}
>
  {#if description}<p id={descriptionId} class="cinder-area-chart__description">
      {description}
    </p>{/if}
  {#if legendVisible(legendPosition, series.length) && legendPosition === 'top'}
    <div class="cinder-area-chart__legend" aria-label="Series">
      {#each series as item, index (item.id)}
        <button
          type="button"
          aria-pressed={!hiddenSeriesIds.includes(item.id)}
          onclick={() => (hiddenSeriesIds = interaction.toggleSeries(hiddenSeriesIds, item.id))}
          ><span style:background={item.color ?? chartPaletteColor(index)}
          ></span>{item.label}</button
        >
      {/each}
    </div>
  {/if}
  <div
    class="cinder-area-chart__viewport"
    style:height="{height}px"
    data-cinder-loading={loading || undefined}
  >
    {#if loading}
      <div class="cinder-area-chart__state">
        {#if loadingContent}{@render loadingContent()}{:else}Loading chart…{/if}
      </div>
    {:else if model.empty}
      <div class="cinder-area-chart__state">
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
      {/if}
      <g transform={`translate(${model.geometry.marginLeft}, ${model.geometry.marginTop})`}>
        {#each model.yTicks as tick, index (tick)}
          {@const tickY =
            model.geometry.plotHeight -
            ((tick - model.yDomain[0]) / (model.yDomain[1] - model.yDomain[0])) *
              model.geometry.plotHeight}
          <line
            class="cinder-area-chart__gridline"
            x1="0"
            x2={model.geometry.plotWidth}
            y1={tickY}
            y2={tickY}
            aria-hidden="true"
          />
          <text
            class="cinder-area-chart__tick-label"
            x="-8"
            y={tickY}
            text-anchor="end"
            dominant-baseline="middle">{formatNumericValue(tick, yAxis, undefined, { index })}</text
          >
        {/each}
        {#each model.xTicks as tick (tick.label)}
          <text
            class="cinder-area-chart__tick-label"
            x={tick.x}
            y={model.geometry.plotHeight + 20}
            text-anchor="middle">{tick.label}</text
          >
        {/each}
        <!-- Series-specific rendering: filled area paths + stroke line paths. -->
        {#each model.normalizedSeries as item (item.id)}
          {#if !item.hidden && item.areaPath}
            <path
              class="cinder-area-chart__area"
              d={item.areaPath}
              fill={item.color}
              aria-hidden="true"
              data-cinder-series={item.id}
            />
            <path
              class="cinder-area-chart__line"
              d={item.path}
              stroke={item.color}
              aria-hidden="true"
              data-cinder-series={item.id}
            />
          {/if}
        {/each}
        {#if interaction.activeTarget}
          <!-- Vertical crosshair — area charts always use a vertical indicator. -->
          <line
            class="cinder-area-chart__crosshair"
            x1={interaction.activeTarget.x}
            x2={interaction.activeTarget.x}
            y1="0"
            y2={model.geometry.plotHeight}
            aria-hidden="true"
          />
        {/if}
        {#if model.targets.length > 0}
          <rect
            class="cinder-area-chart__hit-surface"
            role="presentation"
            width={model.geometry.plotWidth}
            height={model.geometry.plotHeight}
            onpointermove={(event) => interaction.activateByPointer(event, model.targets)}
            onpointerleave={() => interaction.clearPointerTarget()}
          />
          {#if keyboardEnabled}
            {#each model.targets as target (target.id)}
              <!-- Area charts use circle focus targets centered on the data point. -->
              <circle
                class="cinder-area-chart__focus-target"
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
                aria-describedby={interaction.activeTarget?.id === target.id
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
          <g class="cinder-area-chart__focus-ring-layer" aria-hidden="true">
            {#if pointFocusRing.kind === 'point'}
              <circle
                class="cinder-area-chart__focus-ring-halo"
                cx={pointFocusRing.cx}
                cy={pointFocusRing.cy}
                r={pointFocusRing.radius}
              />
              <circle
                class="cinder-area-chart__focus-ring"
                cx={pointFocusRing.cx}
                cy={pointFocusRing.cy}
                r={pointFocusRing.radius}
              />
              {#if pointFocusRing.connector && pointFocusRing.dot}
                <path
                  class="cinder-area-chart__focus-ring-connector cinder-area-chart__focus-ring-halo"
                  d={`M ${pointFocusRing.connector.x1} ${pointFocusRing.connector.y1} L ${pointFocusRing.connector.x2} ${pointFocusRing.connector.y2}`}
                />
                <path
                  class="cinder-area-chart__focus-ring-connector cinder-area-chart__focus-ring"
                  d={`M ${pointFocusRing.connector.x1} ${pointFocusRing.connector.y1} L ${pointFocusRing.connector.x2} ${pointFocusRing.connector.y2}`}
                />
                <circle
                  class="cinder-area-chart__focus-ring-dot cinder-area-chart__focus-ring-halo"
                  cx={pointFocusRing.dot.cx}
                  cy={pointFocusRing.dot.cy}
                  r={pointFocusRing.dot.radius}
                />
                <circle
                  class="cinder-area-chart__focus-ring-dot cinder-area-chart__focus-ring"
                  cx={pointFocusRing.dot.cx}
                  cy={pointFocusRing.dot.cy}
                  r={pointFocusRing.dot.radius}
                />
              {/if}
            {:else}
              <rect
                class="cinder-area-chart__focus-ring-halo"
                x={pointFocusRing.x}
                y={pointFocusRing.y}
                width={pointFocusRing.width}
                height={pointFocusRing.height}
                rx={pointFocusRing.radius}
              />
              <rect
                class="cinder-area-chart__focus-ring"
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
    </svg>
    {#if interaction.activeTarget}<div
        id="{rootId}-tooltip"
        role="tooltip"
        class="cinder-area-chart__tooltip"
        style:left="{model.geometry.marginLeft + interaction.activeTarget.x}px"
        style:top="{model.geometry.marginTop + interaction.activeTarget.y}px"
      >
        <strong>{interaction.activeTarget.seriesLabel}</strong><span
          >{interaction.activeTarget.xLabel}: {interaction.activeTarget.valueLabel}</span
        >
      </div>{/if}
  </div>
  {#if guidanceId}<p id={guidanceId} class="cinder-sr-only">
      Use the data table to inspect this chart with a keyboard.
    </p>{/if}
  {#if hasDataTable}
    <table class={dataTableClass(dataTableVisibility)} aria-describedby={guidanceId}>
      <caption>{dataTableCaption ?? label}</caption>
      <thead
        ><tr><th scope="col">Series</th><th scope="col">X</th><th scope="col">Value</th></tr></thead
      >
      <tbody
        >{#each model.tableRows as row (row.id)}<tr
            ><th scope="row">{row.seriesLabel}</th><td>{row.xLabel}</td><td>{row.valueLabel}</td
            ></tr
          >{/each}</tbody
      >
    </table>
  {/if}
  {#if legendVisible(legendPosition, series.length) && legendPosition === 'bottom'}
    <div class="cinder-area-chart__legend" aria-label="Series">
      {#each series as item, index (item.id)}
        <button
          type="button"
          aria-pressed={!hiddenSeriesIds.includes(item.id)}
          onclick={() => (hiddenSeriesIds = interaction.toggleSeries(hiddenSeriesIds, item.id))}
          ><span style:background={item.color ?? chartPaletteColor(index)}
          ></span>{item.label}</button
        >
      {/each}
    </div>
  {/if}
</figure>
