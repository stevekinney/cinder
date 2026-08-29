<script lang="ts" module>
  /** @cinder
   * @category data-display
   * @status beta
   * @purpose Displays categorical proportions as an accessible donut with an optional center total.
   * @tag chart
   * @useWhen Showing a small number of parts-of-whole categories.
   * @avoidWhen Comparing many categories or precise values; use BarChart.
   * @related bar-chart
   * @rationale Nearest alternative: BarChart compares magnitudes; this owns part-to-whole arcs.
   */
  export type { DonutChartDatum, DonutChartProps } from './donut-chart.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import type { DonutChartProps } from './donut-chart.types.ts';
  let {
    label,
    data,
    valueLabels = false,
    centerLabel,
    scrollable = false,
    onSeriesClick,
    class: className,
    ...rest
  }: DonutChartProps = $props();
  const normalizedData = $derived(
    data.map((datum) => ({ ...datum, value: Math.max(0, datum.value) })),
  );
  const total = $derived(normalizedData.reduce((sum, datum) => sum + datum.value, 0));
  const arcs = $derived.by(() => {
    let offset = 0;
    return normalizedData.map((datum, index) => {
      const value = datum.value;
      const start = offset;
      offset += total ? value / total : 0;
      return { datum, index, start, end: offset };
    });
  });
  function arcPath(start: number, end: number): string {
    const radius = 88,
      center = 100,
      startAngle = start * Math.PI * 2 - Math.PI / 2,
      endAngle = end * Math.PI * 2 - Math.PI / 2,
      large = end - start > 0.5 ? 1 : 0;
    if (end - start >= 1) {
      return `M ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center} ${center + radius} A ${radius} ${radius} 0 1 1 ${center} ${center - radius}`;
    }
    return `M ${center + radius * Math.cos(startAngle)} ${center + radius * Math.sin(startAngle)} A ${radius} ${radius} 0 ${large} 1 ${center + radius * Math.cos(endAngle)} ${center + radius * Math.sin(endAngle)}`;
  }
  function seriesColor(color: string | undefined, index: number): string {
    return color ?? `var(--cinder-chart-series-${(index % 8) + 1})`;
  }
  function handleSeriesKeydown(event: KeyboardEvent, index: number) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const arc = arcs[index];
    if (arc) onSeriesClick?.(arc.datum, arc.index);
  }
</script>

<div
  {...rest}
  class={classNames(
    'cinder-donut-chart',
    scrollable && 'cinder-donut-chart--scrollable',
    className,
  )}
>
  <figure aria-label={label}>
    <svg viewBox="0 0 200 200" role={onSeriesClick ? undefined : 'img'} aria-label={label}>
      {#each arcs as arc}<!-- svelte-ignore a11y_no_noninteractive_tabindex --><g
          role={onSeriesClick ? 'button' : undefined}
          tabindex={onSeriesClick ? 0 : undefined}
          aria-label={onSeriesClick ? `${arc.datum.label}: ${arc.datum.value}` : undefined}
          onclick={() => onSeriesClick?.(arc.datum, arc.index)}
          onkeydown={(event) => handleSeriesKeydown(event, arc.index)}
          ><path
            class="cinder-donut-chart__arc"
            d={arcPath(arc.start, arc.end)}
            pathLength="1"
            stroke={seriesColor(arc.datum.color, arc.index)}
          ></path></g
        >{/each}
      <text x="100" y="96" text-anchor="middle" class="cinder-donut-chart__total">{total}</text
      >{#if centerLabel}<text x="100" y="116" text-anchor="middle" class="cinder-donut-chart__label"
          >{centerLabel}</text
        >{/if}
    </svg>{#if valueLabels}<ul class="cinder-donut-chart__legend">
        {#each normalizedData as datum}<li>
            <span>{datum.label}</span><span>{datum.value}</span>
          </li>{/each}
      </ul>{/if}
    {#if !valueLabels}<ul class="cinder-sr-only" aria-label="{label} values">
        {#each normalizedData as datum}<li>{datum.label}: {datum.value}</li>{/each}
      </ul>{/if}
  </figure>
</div>
