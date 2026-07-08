<script lang="ts" module>
  /** Test-only fixture composing Tabs with one caller-owned panel. */
  export type TabsExternalPanelFixtureProps = {
    value?: string;
    panelId?: string;
    controls?: string;
    items: Array<{
      value: string;
      id: string;
      title: string;
      body: string;
    }>;
  };
</script>

<script lang="ts">
  import Tab from '../../components/tab/tab.svelte';
  import TabList from '../../components/tab-list/tab-list.svelte';
  import Tabs from '../../components/tabs/tabs.svelte';

  let {
    value = $bindable(''),
    panelId = 'editor-panel',
    controls,
    items,
  }: TabsExternalPanelFixtureProps = $props();

  const activeItem = $derived(items.find((item) => item.value === value) ?? items[0]);
</script>

<Tabs bind:value>
  <TabList label="Editor files">
    {#each items as item (item.value)}
      <Tab value={item.value} id={item.id} controls={controls ?? panelId}>{item.title}</Tab>
    {/each}
  </TabList>
</Tabs>

{#if activeItem}
  <div id={panelId} role="tabpanel" aria-labelledby={activeItem.id} tabindex="0">
    {activeItem.body}
  </div>
{/if}
