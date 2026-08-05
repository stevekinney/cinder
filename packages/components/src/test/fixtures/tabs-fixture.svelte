<script lang="ts" module>
  /** Test-only fixture composing Tabs / TabList / Tab / TabPanel. */
  export type TabsFixtureProps = {
    value?: string;
    orientation?: 'horizontal' | 'vertical';
    fill?: boolean;
    activateOnFocus?: boolean;
    items: Array<{
      value: string;
      title: string;
      body: string;
      disabled?: boolean;
    }>;
    /** Optional extra native attributes forwarded to TabList (for passthrough tests). */
    tabListRest?: Record<string, string>;
    /** Optional extra native attributes forwarded to every Tab (for passthrough tests). */
    tabRest?: Record<string, string>;
    /** Optional extra native attributes forwarded to every TabPanel (for passthrough tests). */
    tabPanelRest?: Record<string, string>;
  };
</script>

<script lang="ts">
  import Tab from '../../components/tab/tab.svelte';
  import TabList from '../../components/tab-list/tab-list.svelte';
  import TabPanel from '../../components/tab-panel/tab-panel.svelte';
  import Tabs from '../../components/tabs/tabs.svelte';

  let {
    value = $bindable(''),
    orientation = 'horizontal',
    fill = false,
    activateOnFocus,
    items,
    tabListRest,
    tabRest,
    tabPanelRest,
  }: TabsFixtureProps = $props();
</script>

<Tabs bind:value {orientation} {fill} {...activateOnFocus !== undefined ? { activateOnFocus } : {}}>
  <TabList label="Test tabs" {...tabListRest}>
    {#each items as item (item.value)}
      {#if item.disabled !== undefined}
        <Tab value={item.value} disabled={item.disabled} {...tabRest}>{item.title}</Tab>
      {:else}
        <Tab value={item.value} {...tabRest}>{item.title}</Tab>
      {/if}
    {/each}
  </TabList>
  {#each items as item (item.value)}
    <TabPanel value={item.value} {...tabPanelRest}>{item.body}</TabPanel>
  {/each}
</Tabs>
