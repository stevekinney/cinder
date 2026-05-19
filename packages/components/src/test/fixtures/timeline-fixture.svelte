<script lang="ts" module>
  /** Test-only fixture composing Timeline + TimelineItem. */
  export type TimelineFixtureProps = {
    items: Array<{
      id: string;
      title?: string;
      time?: string;
      status?: 'info' | 'success' | 'warning' | 'danger';
      body?: string;
    }>;
  };
</script>

<script lang="ts">
  import Timeline from '../../components/experimental/timeline/timeline.svelte';
  import TimelineItem from '../../components/experimental/timeline-item/timeline-item.svelte';

  let { items }: TimelineFixtureProps = $props();
</script>

<Timeline>
  {#each items as item (item.id)}
    {#if item.body !== undefined}
      <TimelineItem
        {...item.title !== undefined ? { title: item.title } : {}}
        {...item.time !== undefined ? { time: item.time } : {}}
        {...item.status !== undefined ? { status: item.status } : {}}
      >
        {item.body}
      </TimelineItem>
    {:else}
      <TimelineItem
        {...item.title !== undefined ? { title: item.title } : {}}
        {...item.time !== undefined ? { time: item.time } : {}}
        {...item.status !== undefined ? { status: item.status } : {}}
      />
    {/if}
  {/each}
</Timeline>
