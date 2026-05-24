<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status beta
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
    legendVisible,
    nearestTarget,
    toggleSeriesId,
    type ChartTarget,
  } from '../../_internal/chart/chart-utilities.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { useId } from '../../utilities/use-id.ts';
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

  const generatedId = useId('cinder-area-chart');
  const rootId = $derived(id ?? generatedId);
  const descriptionId = $derived(description ? `${rootId}-description` : undefined);
  let measuredWidth = $state(640);
  let rootElement = $state<HTMLElement>();
  let activeTarget = $state<ChartTarget | undefined>();

  $effect(() => {
    if (!rootElement || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      measuredWidth = Math.max(320, Math.round(entry.contentRect.width));
    });
    observer.observe(rootElement);
    return () => observer.disconnect();
  });

  const model = $derived(
    createCartesianModel({
      componentId: 'area-chart',
      series,
      hiddenSeriesIds,
      width: measuredWidth,
      height,
      xAxis,
      yAxis,
      stackedArea: mode === 'stacked',
    }),
  );
  const keyboardEnabled = $derived(
    model.targets.length > 0 && model.targets.length <= maximumInteractivePoints,
  );
  const guidanceId = $derived(
    !keyboardEnabled && model.targets.length > 0 ? `${rootId}-table-guidance` : undefined,
  );

  $effect(() => {
    assertValidNonNegativeInteger(
      'area-chart',
      'invalid-maximum-interactive-points',
      maximumInteractivePoints,
      'maximumInteractivePoints',
    );
  });

  function toggleSeries(seriesId: string): void {
    hiddenSeriesIds = toggleSeriesId(hiddenSeriesIds, seriesId);
  }

  function activateByPointer(event: PointerEvent): void {
    if (!(event.currentTarget instanceof SVGRectElement)) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    activeTarget = nearestTarget(
      model.targets,
      event.clientX - bounds.left,
      event.clientY - bounds.top,
    );
  }

  function activateByKeyboard(event: KeyboardEvent): void {
    if (!keyboardEnabled) return;
    const currentIndex = Math.max(
      0,
      model.targets.findIndex((target) => target.id === activeTarget?.id),
    );
    if (event.key === 'Escape') {
      activeTarget = undefined;
      return;
    }
    const offsets: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };
    if (event.key === 'Home') activeTarget = model.targets[0];
    else if (event.key === 'End') activeTarget = model.targets.at(-1);
    else if (event.key in offsets)
      activeTarget =
        model.targets[
          (currentIndex + (offsets[event.key] ?? 0) + model.targets.length) % model.targets.length
        ] ?? activeTarget;
    else return;
    event.preventDefault();
  }
</script>

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
          onclick={() => toggleSeries(item.id)}
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
      viewBox={`0 0 ${measuredWidth} ${height}`}
      role="img"
      aria-hidden={loading || model.empty ? 'true' : undefined}
    >
      <g transform={`translate(${model.geometry.marginLeft}, ${model.geometry.marginTop})`}>
        {#each model.yTicks as tick}
          <line
            class="cinder-area-chart__gridline"
            x1="0"
            x2={model.geometry.plotWidth}
            y1={model.geometry.plotHeight -
              ((tick - model.yDomain[0]) / (model.yDomain[1] - model.yDomain[0])) *
                model.geometry.plotHeight}
            y2={model.geometry.plotHeight -
              ((tick - model.yDomain[0]) / (model.yDomain[1] - model.yDomain[0])) *
                model.geometry.plotHeight}
            aria-hidden="true"
          />
          <text
            class="cinder-area-chart__tick-label"
            x="-8"
            y={model.geometry.plotHeight -
              ((tick - model.yDomain[0]) / (model.yDomain[1] - model.yDomain[0])) *
                model.geometry.plotHeight}
            text-anchor="end"
            dominant-baseline="middle">{tick}</text
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
        {#each model.normalizedSeries as item}
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
        {#if activeTarget}<line
            class="cinder-area-chart__crosshair"
            x1={activeTarget.x}
            x2={activeTarget.x}
            y1="0"
            y2={model.geometry.plotHeight}
            aria-hidden="true"
          />{/if}
        {#if model.targets.length > 0}
          <rect
            class="cinder-area-chart__hit-surface"
            width={model.geometry.plotWidth}
            height={model.geometry.plotHeight}
            onpointermove={activateByPointer}
            onpointerleave={() => (activeTarget = undefined)}
          />
          {#if keyboardEnabled}
            {#each model.targets as target (target.id)}
              <circle
                class="cinder-area-chart__focus-target"
                cx={target.x}
                cy={target.y}
                r="8"
                tabindex="0"
                role="button"
                aria-label={`${target.seriesLabel}, ${target.xLabel}, ${target.valueLabel}`}
                aria-describedby={activeTarget?.id === target.id ? `${rootId}-tooltip` : undefined}
                onfocus={() => (activeTarget = target)}
                onblur={() => (activeTarget = undefined)}
                onkeydown={activateByKeyboard}
              />
            {/each}
          {/if}
        {/if}
      </g>
    </svg>
    {#if activeTarget}<div
        id="{rootId}-tooltip"
        role="tooltip"
        class="cinder-area-chart__tooltip"
        style:left="{model.geometry.marginLeft + activeTarget.x}px"
        style:top="{model.geometry.marginTop + activeTarget.y}px"
      >
        <strong>{activeTarget.seriesLabel}</strong><span
          >{activeTarget.xLabel}: {activeTarget.valueLabel}</span
        >
      </div>{/if}
  </div>
  {#if !keyboardEnabled && model.targets.length > 0}<p id={guidanceId} class="cinder-sr-only">
      Use the data table to inspect this chart with a keyboard.
    </p>{/if}
  {#if dataTableVisibility !== 'hidden'}
    <table class={dataTableClass(dataTableVisibility)} aria-describedby={guidanceId}>
      <caption>{dataTableCaption ?? label}</caption>
      <thead
        ><tr><th scope="col">Series</th><th scope="col">X</th><th scope="col">Value</th></tr></thead
      >
      <tbody
        >{#each model.tableRows as row}<tr
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
          onclick={() => toggleSeries(item.id)}
          ><span style:background={item.color ?? chartPaletteColor(index)}
          ></span>{item.label}</button
        >
      {/each}
    </div>
  {/if}
</figure>
