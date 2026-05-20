<script lang="ts" module>
  export const title = 'Tabs with trailing badges';
  export const description =
    'Tabs use a decorative `trailing` snippet (wrapped in aria-hidden) for badges and counters. The accessible name only includes the visible label.';
</script>

<script lang="ts">
  import { Tab } from 'cinder/tab';
  import { TabList } from 'cinder/tab-list';
  import { TabPanel } from 'cinder/tab-panel';
  import { Tabs } from 'cinder/tabs';

  let active = $state('inbox');
</script>

<Tabs bind:value={active}>
  <TabList label="Mailboxes">
    <Tab value="inbox">
      Inbox
      {#snippet trailing()}
        <span>3</span>
      {/snippet}
    </Tab>
    <Tab value="drafts">
      Drafts
      {#snippet trailing()}
        <span>12</span>
      {/snippet}
    </Tab>
    <Tab value="archive">Archive</Tab>
  </TabList>

  <TabPanel value="inbox">
    <p>You have three unread messages.</p>
  </TabPanel>
  <TabPanel value="drafts">
    <p>Twelve drafts waiting for your attention.</p>
  </TabPanel>
  <TabPanel value="archive">
    <p>Nothing archived recently.</p>
  </TabPanel>
</Tabs>
