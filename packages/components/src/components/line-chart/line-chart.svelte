<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status beta
   * @purpose Responsive SVG line chart for comparing one or more numeric series over an ordered x domain.
   * @tag chart
   * @tag line
   * @tag analytics
   * @useWhen Showing trends over time or another ordered domain.
   * @useWhen Comparing several metric series on the same numeric axis.
   * @avoidWhen Comparing discrete category totals — use bar-chart instead.
   * @avoidWhen Showing cumulative filled trends — use area-chart instead.
   * @related area-chart, bar-chart, table, stat
   */
  export type { LineChartProps, LineChartSchemaProps } from './line-chart.types.ts';
</script>

<script lang="ts">
  import {
    assertValidNonNegativeInteger,
    createCartesianModel,
    dataTableClass,
    legendVisible,
    nearestTarget,
    toggleSeriesId,
    type ChartTarget,
  } from '../../_internal/chart/chart-utilities.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { useId } from '../../utilities/use-id.ts';
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
    class: customClassName,
    empty,
    loadingContent,
    id,
    ...rest
  }: LineChartProps = $props();

  const generatedId = useId('cinder-line-chart');
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
      componentId: 'line-chart',
      series,
      hiddenSeriesIds,
      width: measuredWidth,
      height,
      xAxis,
      yAxis,
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
      'line-chart',
      'invalid-maximum-interactive-points',
      maximumInteractivePoints,
      'maximumInteractivePoints',
    );
  });

  function toggleSeries(seriesId: string): void {
    hiddenSeriesIds = toggleSeriesId(hiddenSeriesIds, seriesId);
  }

  function activateByPointer(event: PointerEvent): void {
    const target = event.currentTarget as SVGRectElement;
    const bounds = target.getBoundingClientRect();
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
    const keyOffsets: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };
    if (event.key === 'Home') activeTarget = model.targets[0];
    else if (event.key === 'End') activeTarget = model.targets.at(-1);
    else if (event.key in keyOffsets) {
      const nextIndex =
        (currentIndex + (keyOffsets[event.key] ?? 0) + model.targets.length) % model.targets.length;
      activeTarget = model.targets[nextIndex] ?? activeTarget;
    } else return;
    event.preventDefault();
  }
</script>

<figure
  {...rest}
  bind:this={rootElement}
  id={rootId}
  class={classNames('cinder-line-chart', customClassName)}
  aria-label={label}
  aria-describedby={descriptionId}
>
  {#if description}
    <p id={descriptionId} class="cinder-line-chart__description">{description}</p>
  {/if}

  {#if legendVisible(legendPosition, series.length) && legendPosition === 'top'}
    <div class="cinder-line-chart__legend" aria-label="Series">
      {#each series as item}
        <button
          type="button"
          aria-pressed={!hiddenSeriesIds.includes(item.id)}
          onclick={() => toggleSeries(item.id)}
        >
          <span style:background={item.color}></span>{item.label}
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
      viewBox={`0 0 ${measuredWidth} ${height}`}
      role="img"
      aria-hidden={loading ? 'true' : undefined}
    >
      <g transform={`translate(${model.geometry.marginLeft}, ${model.geometry.marginTop})`}>
        {#each model.yTicks as tick}
          <line
            class="cinder-line-chart__gridline"
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
        {/each}
        {#each model.normalizedSeries as item}
          {#if !item.hidden && item.path}
            <path
              class="cinder-line-chart__line"
              d={item.path}
              stroke={item.color}
              aria-hidden="true"
              data-cinder-series={item.id}
            />
            {#each item.points as point}
              {#if point.y !== null}
                <circle
                  class="cinder-line-chart__point"
                  cx={model.targets.find((target) => target.id === `${item.id}-${point.x.key}`)
                    ?.x ?? 0}
                  cy={model.targets.find((target) => target.id === `${item.id}-${point.x.key}`)
                    ?.y ?? 0}
                  r="3"
                  fill={item.color}
                  aria-hidden="true"
                  data-cinder-series={item.id}
                />
              {/if}
            {/each}
          {/if}
        {/each}
        {#if activeTarget}
          <line
            class="cinder-line-chart__crosshair"
            x1={activeTarget.x}
            x2={activeTarget.x}
            y1="0"
            y2={model.geometry.plotHeight}
            aria-hidden="true"
          />
        {/if}
        {#if model.targets.length > 0}
          <rect
            class="cinder-line-chart__hit-surface"
            width={model.geometry.plotWidth}
            height={model.geometry.plotHeight}
            tabindex={keyboardEnabled ? 0 : undefined}
            role={keyboardEnabled ? 'application' : undefined}
            aria-label={keyboardEnabled ? `${label} plot area` : undefined}
            onpointermove={activateByPointer}
            onpointerleave={() => (activeTarget = undefined)}
            onfocus={() => (activeTarget = model.targets[0])}
            onblur={() => (activeTarget = undefined)}
            onkeydown={activateByKeyboard}
          />
        {/if}
      </g>
    </svg>
    {#if activeTarget}
      <div
        class="cinder-line-chart__tooltip"
        style:left="{model.geometry.marginLeft + activeTarget.x}px"
        style:top="{model.geometry.marginTop + activeTarget.y}px"
      >
        <strong>{activeTarget.seriesLabel}</strong>
        <span>{activeTarget.xLabel}: {activeTarget.valueLabel}</span>
      </div>
    {/if}
  </div>

  {#if guidanceId}
    <p id={guidanceId} class="cinder-sr-only">
      Use the data table to inspect this chart with a keyboard.
    </p>
  {/if}

  {#if dataTableVisibility !== 'hidden'}
    <table class={dataTableClass(dataTableVisibility)}>
      <caption>{dataTableCaption ?? label}</caption>
      <thead
        ><tr><th scope="col">Series</th><th scope="col">X</th><th scope="col">Value</th></tr></thead
      >
      <tbody>
        {#each model.normalizedSeries as item}
          {#each item.points as point}
            <tr
              ><th scope="row">{item.label}</th><td>{point.x.label}</td><td>{point.y ?? ''}</td></tr
            >
          {/each}
        {/each}
      </tbody>
    </table>
  {/if}

  {#if legendVisible(legendPosition, series.length) && legendPosition === 'bottom'}
    <div class="cinder-line-chart__legend" aria-label="Series">
      {#each series as item}
        <button
          type="button"
          aria-pressed={!hiddenSeriesIds.includes(item.id)}
          onclick={() => toggleSeries(item.id)}
        >
          <span style:background={item.color}></span>{item.label}
        </button>
      {/each}
    </div>
  {/if}
</figure>
