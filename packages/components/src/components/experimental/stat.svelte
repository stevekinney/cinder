<script lang="ts" module>
  /**
   * EXPERIMENTAL — Stat API may change between minor versions.
   *
   * KPI / dashboard tile rendering a label + value pair plus an optional
   * delta. Pair with Cards to compose dashboard sections.
   */
  export type StatTrend = 'up' | 'down' | 'flat';

  export type StatProps = {
    /** Visible label above the value (e.g. "Active runs"). */
    label: string;
    /** The headline value. Strings are rendered verbatim; numbers are stringified. */
    value: string | number;
    /** Optional delta value (e.g. "+12.4%"). */
    delta?: string;
    /** Direction of the delta. Influences color and the indicator glyph. */
    trend?: StatTrend;
    /** Additional class names merged with `.cinder-stat`. */
    class?: string;
  };
</script>

<script lang="ts">
  import { cn } from '../../utilities/class-names.ts';

  let { label, value, delta, trend, class: className }: StatProps = $props();
</script>

<div class={cn('cinder-stat', className)}>
  <span class="cinder-stat__label">{label}</span>
  <span class="cinder-stat__value">{value}</span>
  {#if delta}
    <span class="cinder-stat__delta" data-cinder-trend={trend}>{delta}</span>
  {/if}
</div>
