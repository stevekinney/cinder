<script lang="ts" module>
  /** Test-only fixture rendering two independent Tabs instances sharing a common tab value. */
  export type TabsSiblingFixtureProps = {
    sharedValue: string;
  };
</script>

<script lang="ts">
  import Tab from '../../components/tab/tab.svelte';
  import TabList from '../../components/tab-list/tab-list.svelte';
  import TabPanel from '../../components/tab-panel/tab-panel.svelte';
  import Tabs from '../../components/tabs/tabs.svelte';

  let { sharedValue }: TabsSiblingFixtureProps = $props();
</script>

<Tabs value={sharedValue}>
  <TabList label="First tabs">
    <Tab value={sharedValue}>First {sharedValue}</Tab>
    <Tab value="other-first">Other First</Tab>
  </TabList>
  <TabPanel value={sharedValue}>First {sharedValue} panel</TabPanel>
  <TabPanel value="other-first">First other panel</TabPanel>
</Tabs>

<Tabs value={sharedValue}>
  <TabList label="Second tabs">
    <Tab value={sharedValue}>Second {sharedValue}</Tab>
    <Tab value="other-second">Other Second</Tab>
  </TabList>
  <TabPanel value={sharedValue}>Second {sharedValue} panel</TabPanel>
  <TabPanel value="other-second">Second other panel</TabPanel>
</Tabs>
