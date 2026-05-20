<script lang="ts" module>
  export const title = 'Tabs with keyboard navigation';
  export const description =
    'Focus a tab and use ←/→ to move; horizontal tablists activate on focus per the WAI-ARIA pattern.';
</script>

<script lang="ts">
  import { Tab } from 'cinder/tab';
  import { TabList } from 'cinder/tab-list';
  import { TabPanel } from 'cinder/tab-panel';
  import { Tabs } from 'cinder/tabs';
  let active = $state('design');
</script>

<Tabs bind:value={active}>
  <TabList label="Workflow stages">
    <Tab value="design">Design</Tab>
    <Tab value="develop">Develop</Tab>
    <Tab value="ship" disabled>Ship</Tab>
    <Tab value="review">Review</Tab>
  </TabList>

  <TabPanel value="design">
    <p>Sketch the user experience before writing code.</p>
  </TabPanel>
  <TabPanel value="develop">
    <p>Build the components and wire up the state.</p>
  </TabPanel>
  <TabPanel value="ship">
    <p>Disabled tab — its panel is unreachable.</p>
  </TabPanel>
  <TabPanel value="review">
    <p>Review and iterate based on feedback.</p>
  </TabPanel>
</Tabs>
