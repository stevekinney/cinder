<script lang="ts" module>
  /** Test-only fixture composing Tabs with a trailing snippet on the first tab. */
  export type TabsTrailingFixtureProps = {
    value?: string;
    trailingText?: string;
  };
</script>

<script lang="ts">
  import Tab from '../../components/tab/tab.svelte';
  import TabList from '../../components/tab-list/tab-list.svelte';
  import TabPanel from '../../components/tab-panel/tab-panel.svelte';
  import Tabs from '../../components/tabs/tabs.svelte';

  let { value = $bindable('inbox'), trailingText = '3' }: TabsTrailingFixtureProps = $props();
</script>

<Tabs bind:value>
  <TabList label="Mailboxes">
    <Tab value="inbox">
      Inbox
      {#snippet trailing()}
        <span data-testid="trailing-badge">{trailingText}</span>
      {/snippet}
    </Tab>
    <Tab value="archive">Archive</Tab>
  </TabList>
  <TabPanel value="inbox">Inbox body</TabPanel>
  <TabPanel value="archive">Archive body</TabPanel>
</Tabs>
