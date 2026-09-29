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
  import { tick } from 'svelte';

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
  let rootElement: HTMLDivElement | null = $state(null);
  // The arc currently holding real DOM focus, tracked by datum id (not
  // position) — see the reconciliation effect below for why identity, not
  // index, is what keyboard activation must stay attached to across reorders.
  let focusedArcId = $state<string | null>(null);
  // Ids of the arcs that were interactive as of the last reconciliation, in
  // their rendered order at that time. Plain (untracked) bookkeeping: it only
  // needs to be read the *next* time an arc disappears or goes noninteractive,
  // to know what "the next/previous surviving one" meant before this update.
  let previousInteractiveOrder: string[] = [];
  const normalizedData = $derived(
    data.map((datum) => ({
      ...datum,
      value: Number.isFinite(datum.value) ? Math.max(0, datum.value) : 0,
    })),
  );
  const total = $derived(normalizedData.reduce((sum, datum) => sum + datum.value, 0));
  const maximumValue = $derived(
    normalizedData.reduce((maximum, datum) => Math.max(maximum, datum.value), 0),
  );
  const arcTotal = $derived.by(() => {
    if (Number.isFinite(total)) return total;
    if (maximumValue === 0) return 0;
    return normalizedData.reduce((sum, datum) => sum + datum.value / maximumValue, 0);
  });
  const totalLabel = $derived.by(() => {
    if (Number.isFinite(total)) return String(total);
    if (maximumValue === 0 || arcTotal === 0) return '0';
    const exponent = Math.floor(Math.log10(maximumValue));
    const mantissa = (maximumValue / 10 ** exponent) * arcTotal;
    return `${mantissa.toPrecision(16)}e+${exponent}`;
  });
  const arcs = $derived.by(() => {
    let offset = 0;
    return normalizedData.map((datum, index) => {
      const value = datum.value;
      const start = offset;
      const arcValue = Number.isFinite(total)
        ? value
        : maximumValue === 0
          ? 0
          : value / maximumValue;
      offset += arcTotal ? arcValue / arcTotal : 0;
      return { datum, index, start, end: offset };
    });
  });
  function isArcInteractive(arc: { start: number; end: number }): boolean {
    return Boolean(onSeriesClick) && arc.end > arc.start;
  }
  // Ids of the currently interactive arcs, in rendered order — the "current"
  // side of the prior/current comparison the reconciliation effect below runs.
  const interactiveOrder = $derived(
    arcs.filter((arc) => isArcInteractive(arc)).map((arc) => arc.datum.id),
  );
  function getArcElements(): SVGGElement[] {
    return Array.from(rootElement?.querySelectorAll<SVGGElement>('[data-cinder-arc-id]') ?? []);
  }
  function getArcElementById(id: string): SVGGElement | undefined {
    return getArcElements().find((element) => element.dataset['cinderArcId'] === id);
  }
  async function focusArcOrContainer(id: string | null): Promise<void> {
    await tick();
    if (id !== null) {
      getArcElementById(id)?.focus();
    } else {
      rootElement?.focus();
    }
  }
  // Id-survival focus reconciliation. Every unkeyed-vs-keyed distinction here
  // matters: arcs are keyed by `arc.datum.id` in the markup below, so Svelte
  // already moves (rather than recreates) an arc's `<g>` for a reorder,
  // insertion, or removal elsewhere in the list — real DOM focus naturally
  // stays put in those cases with no extra code. This effect only has to
  // handle the case keying *can't* solve on its own: the focused datum itself
  // disappearing, or losing its zero-area interactivity.
  //
  // Uses `$effect.pre`, which runs before Svelte patches the DOM, so this
  // reads `previousInteractiveOrder` (and decides the fallback) before the
  // focused arc's node is actually removed.
  $effect.pre(() => {
    const currentOrder = interactiveOrder;
    const currentSet = new Set(currentOrder);

    if (focusedArcId !== null && !currentSet.has(focusedArcId)) {
      const priorIndex = previousInteractiveOrder.indexOf(focusedArcId);
      let fallbackId: string | null = null;

      if (priorIndex !== -1) {
        for (let i = priorIndex + 1; i < previousInteractiveOrder.length && !fallbackId; i += 1) {
          const candidate = previousInteractiveOrder[i]!;
          if (currentSet.has(candidate)) fallbackId = candidate;
        }
        for (let i = priorIndex - 1; i >= 0 && !fallbackId; i -= 1) {
          const candidate = previousInteractiveOrder[i]!;
          if (currentSet.has(candidate)) fallbackId = candidate;
        }
      }

      focusedArcId = fallbackId;
      void focusArcOrContainer(fallbackId);
    }

    previousInteractiveOrder = currentOrder;
  });
  function handleSeriesFocus(id: string): void {
    focusedArcId = id;
  }
  function handleSeriesBlur(id: string): void {
    if (focusedArcId === id) focusedArcId = null;
  }
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
  bind:this={rootElement}
  tabindex="-1"
  class={classNames(
    'cinder-donut-chart',
    scrollable && 'cinder-donut-chart--scrollable',
    className,
  )}
>
  <figure aria-label={label}>
    <svg viewBox="0 0 200 200" role={onSeriesClick ? undefined : 'img'} aria-label={label}>
      {#each arcs as arc (arc.datum.id)}{@const interactive =
          isArcInteractive(arc)}<!-- svelte-ignore a11y_no_noninteractive_tabindex --><g
          role={interactive ? 'button' : undefined}
          tabindex={interactive ? 0 : undefined}
          aria-label={interactive ? `${arc.datum.label}: ${arc.datum.value}` : undefined}
          data-cinder-arc-id={arc.datum.id}
          onclick={interactive ? () => onSeriesClick?.(arc.datum, arc.index) : undefined}
          onkeydown={interactive ? (event) => handleSeriesKeydown(event, arc.index) : undefined}
          onfocus={interactive ? () => handleSeriesFocus(arc.datum.id) : undefined}
          onblur={interactive ? () => handleSeriesBlur(arc.datum.id) : undefined}
          ><path
            class="cinder-donut-chart__arc"
            d={arcPath(arc.start, arc.end)}
            pathLength="1"
            stroke={seriesColor(arc.datum.color, arc.index)}
          ></path>{#if interactive}<g
              class="cinder-donut-chart__focus-ring-layer"
              aria-hidden="true"
            >
              <path
                class="cinder-donut-chart__focus-ring-halo"
                d={arcPath(arc.start, arc.end)}
                pathLength="1"
              ></path>
              <path
                class="cinder-donut-chart__focus-ring"
                d={arcPath(arc.start, arc.end)}
                pathLength="1"
              ></path>
            </g>{/if}</g
        >{/each}
      <text x="100" y="96" text-anchor="middle" class="cinder-donut-chart__total">{totalLabel}</text
      >{#if centerLabel}<text x="100" y="116" text-anchor="middle" class="cinder-donut-chart__label"
          >{centerLabel}</text
        >{/if}
    </svg>{#if valueLabels}<ul class="cinder-donut-chart__legend">
        {#each normalizedData as datum, index (datum.id)}<li>
            <span class="cinder-donut-chart__legend-label">
              <span
                class="cinder-donut-chart__legend-swatch"
                aria-hidden="true"
                style="background-color: {seriesColor(datum.color, index)}"
              ></span>
              <span>{datum.label}</span>
            </span>
            <span>{datum.value}</span>
          </li>{/each}
      </ul>{/if}
    {#if !valueLabels}<ul class="cinder-sr-only" aria-label="{label} values">
        {#each normalizedData as datum (datum.id)}<li>{datum.label}: {datum.value}</li>{/each}
      </ul>{/if}
  </figure>
</div>
