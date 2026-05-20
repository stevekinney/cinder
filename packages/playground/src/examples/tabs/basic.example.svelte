<script lang="ts" module>
  export const title = 'Basic tabs';
  export const description =
    'Three tabs with associated panels; clicking a tab switches the panel.';
</script>

<script lang="ts">
  import { Tab } from 'cinder/tab';
  import { TabList } from 'cinder/tab-list';
  import { TabPanel } from 'cinder/tab-panel';
  import { Tabs } from 'cinder/tabs';
  let active = $state('overview');
</script>

<Tabs bind:value={active}>
  <TabList label="Project sections">
    <Tab value="overview">Overview</Tab>
    <Tab value="activity">Activity</Tab>
    <Tab value="settings">Settings</Tab>
  </TabList>

  <TabPanel value="overview">
    <p>Cinder is a small but opinionated component library for Svelte 5.</p>
  </TabPanel>
  <TabPanel value="activity">
    <p>You have 3 unread comments and 1 pending review.</p>
  </TabPanel>
  <TabPanel value="settings">
    <p>Adjust your project preferences here.</p>
  </TabPanel>
</Tabs>
