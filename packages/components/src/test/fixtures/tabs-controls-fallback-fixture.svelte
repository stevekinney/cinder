<script lang="ts" module>
  /** Test-only fixture proving blank controls fall back to the default TabPanel id. */
  export type TabsControlsFallbackFixtureProps = {
    value?: string;
    controls?: string;
  };
</script>

<script lang="ts">
  import Tab from '../../components/tab/tab.svelte';
  import TabList from '../../components/tab-list/tab-list.svelte';
  import TabPanel from '../../components/tab-panel/tab-panel.svelte';
  import Tabs from '../../components/tabs/tabs.svelte';

  let { value = $bindable('a'), controls = '   ' }: TabsControlsFallbackFixtureProps = $props();
</script>

<Tabs bind:value>
  <TabList label="Test tabs">
    <Tab value="a" {controls}>A tab</Tab>
  </TabList>
  <TabPanel value="a">A body</TabPanel>
</Tabs>
