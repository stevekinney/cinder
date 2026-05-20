<script lang="ts" module>
  /** Test-only fixture composing Tabs / TabList / Tab / TabPanel. */
  export type TabsFixtureProps = {
    value?: string;
    orientation?: 'horizontal' | 'vertical';
    activateOnFocus?: boolean;
    items: Array<{ value: string; title: string; body: string; disabled?: boolean }>;
  };
</script>

<script lang="ts">
  import Tab from '../../components/tab/tab.svelte';
  import TabList from '../../components/tab-list/tab-list.svelte';
  import TabPanel from '../../components/tab-panel/tab-panel.svelte';
  import Tabs from '../../components/tabs.svelte';

  let {
    value = $bindable(''),
    orientation = 'horizontal',
    activateOnFocus,
    items,
  }: TabsFixtureProps = $props();
</script>

<Tabs bind:value {orientation} {...activateOnFocus !== undefined ? { activateOnFocus } : {}}>
  <TabList label="Test tabs">
    {#each items as item (item.value)}
      {#if item.disabled !== undefined}
        <Tab value={item.value} disabled={item.disabled}>{item.title}</Tab>
      {:else}
        <Tab value={item.value}>{item.title}</Tab>
      {/if}
    {/each}
  </TabList>
  {#each items as item (item.value)}
    <TabPanel value={item.value}>{item.body}</TabPanel>
  {/each}
</Tabs>
