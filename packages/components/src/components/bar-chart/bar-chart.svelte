<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Responsive SVG bar chart for grouped or stacked category comparisons.
   * @tag chart
   * @tag bar
   * @tag analytics
   * @useWhen Comparing discrete category totals or grouped category breakdowns.
   * @useWhen Showing stacked contribution across known categories.
   * @avoidWhen Showing a continuous ordered trend — use line-chart instead.
   * @avoidWhen Showing magnitude under a trend — use area-chart instead.
   * @related line-chart, area-chart, table, statistic
   */
  export type { BarChartProps, BarChartSchemaProps } from './bar-chart.types.ts';
</script>

<script lang="ts">
  import {
    assertValidNonNegativeInteger,
    chartPaletteColor,
    createBarModel,
    dataTableClass,
    formatNumericValue,
    legendVisible,
    type ChartTarget,
  } from '../../_internal/chart/chart-utilities.ts';
  import {
    DEFAULT_CHART_FOCUS_RING_STROKE_PADDING,
    createBarFocusRingGeometry,
  } from '../../_internal/chart/chart-focus-ring.ts';
  import { ChartInteraction } from '../../_internal/chart/chart-interaction.svelte.ts';
  import ChartDataTable from '../_internal/chart-data-table.svelte';
  import ChartTooltip from '../_internal/chart-tooltip.svelte';
  import { classNames } from '../../utilities/class-names.ts';
  import type { BarChartProps } from './bar-chart.types.ts';

  let {
    label,
    description,
    data,
    categoryKey,
    series,
    orientation = 'vertical',
    mode = 'grouped',
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
  }: BarChartProps = $props();

  const generatedId = $props.id();
  const rootId = $derived(id ?? generatedId);
  const descriptionId = $derived(description ? `${rootId}-description` : undefined);

  // Bar chart interaction: pointer axis switches with orientation.
  // Vertical bars snap to x-buckets; horizontal bars snap to y-buckets.
  // A reactive getter is passed so the same instance follows orientation
  // changes without resetting measuredWidth — intentionally different from
  // line/area charts which always use pointer axis 'x'.
  const interaction = new ChartInteraction({
    pointerAxis: () => (orientation === 'vertical' ? 'x' : 'y'),
  });

  let rootElement = $state<HTMLElement>();

  $effect(() => {
    if (!rootElement) return;
    return interaction.observeResize(rootElement);
  });

  const model = $derived(
    createBarModel({
      data,
      categoryKey,
      series,
      hiddenSeriesIds,
      width: interaction.measuredWidth,
      height,
      orientation,
      mode,
      xAxis,
      yAxis,
      theme,
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
  const barFocusRing = $derived(
    focusRingTarget
      ? createBarFocusRingGeometry({
          target: focusRingTarget,
          plotWidth: model.geometry.plotWidth,
          plotHeight: model.geometry.plotHeight,
          strokePadding: DEFAULT_CHART_FOCUS_RING_STROKE_PADDING,
        })
      : null,
  );

  $effect(() => {
    assertValidNonNegativeInteger(
      'bar-chart',
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
  class={classNames('cinder-bar-chart', customClassName)}
  style:--_cinder-chart-foreground={model.theme.foreground}
  style:--_cinder-chart-muted={model.theme.muted}
  style:--_cinder-chart-grid={model.theme.grid}
  style:--_cinder-chart-background={model.theme.background}
  aria-label={label}
  aria-describedby={descriptionId}
  data-cinder-orientation={orientation}
  data-cinder-mode={mode}
>
  {#if description}<p id={descriptionId} class="cinder-bar-chart__description">
      {description}
    </p>{/if}
  {#if legendVisible(legendPosition, series.length) && legendPosition === 'top'}
    <div class="cinder-bar-chart__legend" aria-label="Series">
      {#each series as item, index (item.id)}
        <button
          type="button"
          aria-pressed={!hiddenSeriesIds.includes(item.id)}
          onclick={() => (hiddenSeriesIds = interaction.toggleSeries(hiddenSeriesIds, item.id))}
          ><span style:background={item.color ?? chartPaletteColor(index, model.theme.palette)}
          ></span>{item.label}</button
        >
      {/each}
    </div>
  {/if}
  <div
    class="cinder-bar-chart__viewport"
    style:height="{height}px"
    data-cinder-loading={loading || undefined}
  >
    {#if loading}
      <div class="cinder-bar-chart__state">
        {#if loadingContent}{@render loadingContent()}{:else}Loading chart…{/if}
      </div>
    {:else if model.empty}
      <div class="cinder-bar-chart__state">
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
            <!--
            Bar chart tick positions depend on orientation:
            - Vertical: y-axis labels appear left of the chart (same as line/area).
            - Horizontal: value labels appear along the bottom x-axis instead.
            This is intentionally different from line/area chart tick rendering.
          -->
            <text
              class="cinder-bar-chart__tick-label"
              x={orientation === 'vertical'
                ? -8
                : ((tick - model.valueDomain[0]) / (model.valueDomain[1] - model.valueDomain[0])) *
                  model.geometry.plotWidth}
              y={orientation === 'vertical'
                ? model.geometry.plotHeight -
                  ((tick - model.valueDomain[0]) / (model.valueDomain[1] - model.valueDomain[0])) *
                    model.geometry.plotHeight
                : model.geometry.plotHeight + 20}
              transform={orientation === 'horizontal' && xAxis?.tickLabelRotation
                ? `rotate(${xAxis.tickLabelRotation} ${((tick - model.valueDomain[0]) / (model.valueDomain[1] - model.valueDomain[0])) * model.geometry.plotWidth} ${model.geometry.plotHeight + 20})`
                : undefined}
              text-anchor={orientation === 'vertical' ? 'end' : 'middle'}
              dominant-baseline={orientation === 'vertical' ? 'middle' : undefined}
              >{formatNumericValue(tick, orientation === 'vertical' ? yAxis : xAxis, undefined, {
                index,
              })}</text
            >
          {/each}
          {#if yAxis?.label}
            <text
              class="cinder-bar-chart__axis-title"
              x={-model.geometry.plotHeight / 2}
              y={-model.geometry.marginLeft + 12}
              text-anchor="middle"
              transform="rotate(-90)">{yAxis.label}</text
            >
          {/if}
          <!-- Series-specific rendering: rectangular bars. -->
          {#if mark}
            {#each series as item (item.id)}
              {@render mark({
                series: item,
                points: model.bars.filter((bar) => bar.seriesId === item.id),
                geometry: model.geometry,
              })}
            {/each}
          {:else}
            {#each model.bars as bar (bar.id)}
              <rect
                class="cinder-bar-chart__bar"
                x={bar.x}
                y={bar.y}
                width={bar.width}
                height={bar.height}
                fill={bar.color}
                aria-hidden="true"
                data-cinder-series={bar.seriesId}
                data-cinder-category={bar.categoryLabel}
                data-cinder-active={interaction.activeTarget?.seriesId === bar.seriesId &&
                interaction.activeTarget?.xLabel === bar.categoryLabel
                  ? ''
                  : undefined}
              />
            {/each}
          {/if}
          {#each model.categoryTicks as tick (tick.categoryKey)}
            <!--
            Category axis labels differ by orientation:
            - Vertical: labels appear below bars (middle-anchored x, no baseline).
            - Horizontal: labels appear left of bars (end-anchored x, middle baseline).
          -->
            <text
              class="cinder-bar-chart__tick-label"
              x={tick.x}
              y={tick.y}
              transform={orientation === 'vertical' && xAxis?.tickLabelRotation
                ? `rotate(${xAxis.tickLabelRotation} ${tick.x} ${tick.y})`
                : undefined}
              text-anchor={orientation === 'vertical' ? 'middle' : 'end'}
              dominant-baseline={orientation === 'vertical' ? undefined : 'middle'}
              >{#if tick.label !== tick.fullLabel}<title>{tick.fullLabel}</title
                >{/if}{tick.label}</text
            >
          {/each}
          {#if xAxis?.label}
            <text
              class="cinder-bar-chart__axis-title"
              x={model.geometry.plotWidth / 2}
              y={model.geometry.plotHeight + model.geometry.marginBottom - 4}
              text-anchor="middle">{xAxis.label}</text
            >
          {/if}
          {#if interaction.activeTarget}
            <!--
            Bar chart crosshair direction depends on orientation:
            - Vertical bars: vertical crosshair through the active bar's x position.
            - Horizontal bars: horizontal crosshair through the active bar's y position.
            This is intentionally different from line/area charts which always draw a
            vertical crosshair.
          -->
            {#if orientation === 'vertical'}
              <line
                class="cinder-bar-chart__crosshair"
                x1={interaction.activeTarget.x}
                x2={interaction.activeTarget.x}
                y1="0"
                y2={model.geometry.plotHeight}
                aria-hidden="true"
              />
            {:else}
              <line
                class="cinder-bar-chart__crosshair"
                x1="0"
                x2={model.geometry.plotWidth}
                y1={interaction.activeTarget.y}
                y2={interaction.activeTarget.y}
                aria-hidden="true"
              />
            {/if}
          {/if}
          {#if model.targets.length > 0}
            <rect
              class="cinder-bar-chart__hit-surface"
              role="presentation"
              width={model.geometry.plotWidth}
              height={model.geometry.plotHeight}
              onpointermove={(event) => interaction.activateByPointer(event, model.targets)}
              onpointerleave={() => interaction.clearPointerTarget()}
            />
            {#if keyboardEnabled}
              {#each model.targets as target (target.id)}
                <!--
                Bar chart uses rect focus targets centered on each bar, not circle targets.
                Circles are suitable for point-based charts (line/area); rects match the
                bar geometry and produce better hit areas for bar-shaped data points.
              -->
                <rect
                  class="cinder-bar-chart__focus-target"
                  x={(target.x ?? 0) - 6}
                  y={(target.y ?? 0) - 6}
                  width="12"
                  height="12"
                  tabindex="0"
                  role="button"
                  data-cinder-target-id={target.id}
                  data-cinder-series-id={target.seriesId}
                  data-cinder-focus-ring-active={barFocusRing && focusRingTarget?.id === target.id
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
          {#if barFocusRing}
            <g class="cinder-bar-chart__focus-ring-layer" aria-hidden="true">
              <rect
                class="cinder-bar-chart__focus-ring-halo"
                x={barFocusRing.x}
                y={barFocusRing.y}
                width={barFocusRing.width}
                height={barFocusRing.height}
                rx={barFocusRing.radius}
              />
              <rect
                class="cinder-bar-chart__focus-ring"
                x={barFocusRing.x}
                y={barFocusRing.y}
                width={barFocusRing.width}
                height={barFocusRing.height}
                rx={barFocusRing.radius}
              />
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
  {#if guidanceId}<p id={guidanceId} class="cinder-sr-only">
      Use the data table to inspect this chart with a keyboard.
    </p>{/if}
  {#if hasDataTable}
    <!--
      Bar chart data table uses Category/Series/Value columns rather than
      Series/X/Value (line/area). This reflects that bar charts are category-
      primary: each row is one category, with each series as a column value.
    -->
    <ChartDataTable
      caption={dataTableCaption ?? label}
      headers={['Category', 'Series', 'Value']}
      rows={model.tableRows.flatMap((row) =>
        row.values.map((value) => ({
          id: JSON.stringify([row.categoryKey, value.seriesId]),
          header: row.categoryLabel,
          cells: [value.seriesLabel, value.valueLabel],
        })),
      )}
      visibilityClass={dataTableClass(dataTableVisibility)}
      describedBy={guidanceId}
    />
  {/if}
  {#if legendVisible(legendPosition, series.length) && legendPosition === 'bottom'}
    <div class="cinder-bar-chart__legend" aria-label="Series">
      {#each series as item, index (item.id)}
        <button
          type="button"
          aria-pressed={!hiddenSeriesIds.includes(item.id)}
          onclick={() => (hiddenSeriesIds = interaction.toggleSeries(hiddenSeriesIds, item.id))}
          ><span style:background={item.color ?? chartPaletteColor(index, model.theme.palette)}
          ></span>{item.label}</button
        >
      {/each}
    </div>
  {/if}
</figure>
