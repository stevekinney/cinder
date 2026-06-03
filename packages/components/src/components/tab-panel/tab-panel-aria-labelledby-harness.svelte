<script lang="ts" module>
  /** Test-only harness: a custom Tab `id` paired with a TabPanel `ariaLabelledby` override. */
  export type TabPanelAriaLabelledbyHarnessProps = {
    value?: string;
    customTabId: string;
  };
</script>

<script lang="ts">
  import Tab from '../tab/tab.svelte';
  import TabList from '../tab-list/tab-list.svelte';
  import TabPanel from './tab-panel.svelte';
  import Tabs from '../tabs/tabs.svelte';

  let { value = $bindable('a'), customTabId }: TabPanelAriaLabelledbyHarnessProps = $props();
</script>

<Tabs bind:value>
  <TabList label="Override tabs">
    <Tab value="a" id={customTabId}>A tab</Tab>
  </TabList>
  <TabPanel value="a" ariaLabelledby={customTabId}>A body</TabPanel>
</Tabs>
