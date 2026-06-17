<script lang="ts" module>
  /** Test-only fixture driving Timeline via its `entries` + snippet API. */
  export type TimelineFixtureProps = {
    items: Array<{
      id: string;
      title?: string | undefined;
      datetime: string;
      timestamp: string;
      tone?: 'info' | 'success' | 'warning' | 'error' | undefined;
      groupLabel?: string | undefined;
      body?: string | undefined;
    }>;
    orientation?: 'vertical' | 'horizontal' | undefined;
    groupBy?: 'none' | 'day' | 'week' | undefined;
    weekStartsOn?: 'sunday' | 'monday' | undefined;
    groupHeaderLevel?: 1 | 2 | 3 | 4 | 5 | 6 | undefined;
    gapThresholdMinutes?: number | undefined;
  };
</script>

<script lang="ts">
  import Timeline from '../../components/timeline/timeline.svelte';

  let {
    items,
    orientation = 'vertical',
    groupBy = 'none',
    weekStartsOn = 'monday',
    groupHeaderLevel,
    gapThresholdMinutes,
  }: TimelineFixtureProps = $props();
</script>

<Timeline
  entries={items.map((item) => ({
    id: item.id,
    datetime: item.datetime,
    timestamp: item.timestamp,
    title: item.title ?? '',
    tone: item.tone,
    groupLabel: item.groupLabel,
  }))}
  {orientation}
  {groupBy}
  {weekStartsOn}
  {groupHeaderLevel}
  {gapThresholdMinutes}
>
  {#snippet children(item)}
    {@const body = items.find((sourceItem) => sourceItem.id === item.id)?.body}
    {#if body}
      {body}
    {/if}
  {/snippet}

  {#snippet marker(item)}
    <span data-testid={`marker-${item.id}`}></span>
  {/snippet}
</Timeline>
