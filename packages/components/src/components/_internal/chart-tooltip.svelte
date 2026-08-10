<script lang="ts">
  import type { Snippet } from 'svelte';

  import type { ChartGeometry, ChartTarget } from '../chart.types.ts';
  import Popover from '../popover/popover.svelte';

  let {
    id,
    target,
    geometry,
    content,
  }: {
    id: string;
    target?: ChartTarget | undefined;
    geometry: ChartGeometry;
    content?: boolean | Snippet<[ChartTarget]> | undefined;
  } = $props();

  let anchorElement = $state<HTMLSpanElement | null>(null);
  const outsideClickIgnoreRefs = [() => anchorElement?.ownerDocument.body ?? null];
  const customContent = $derived(typeof content === 'function' ? content : undefined);
  const open = $derived(Boolean(anchorElement && target && content));
</script>

<span
  bind:this={anchorElement}
  class="cinder-chart-tooltip-anchor"
  aria-hidden="true"
  style:left={`${geometry.marginLeft + (target?.x ?? 0)}px`}
  style:top={`${geometry.marginTop + (target?.y ?? 0)}px`}
></span>

<!-- This non-interactive tooltip stays controlled by the chart's active target. -->
<Popover
  id={`${id}-popover`}
  {open}
  triggerRef={anchorElement}
  placement="right"
  arrowVisible
  role="group"
  focusManagement="preserve"
  {outsideClickIgnoreRefs}
  wireTriggerAria={false}
  closeOnEscape={false}
  widthMode="content"
>
  {#snippet children()}
    {#if target}
      <div {id} role="tooltip" class="cinder-chart-tooltip">
        {#if customContent}
          {@render customContent(target)}
        {:else}
          <strong>{target.seriesLabel}</strong>
          <span>{target.xLabel}: {target.valueLabel}</span>
        {/if}
      </div>
    {/if}
  {/snippet}
</Popover>
