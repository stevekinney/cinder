<script lang="ts">
  import Tab from '@lostgradient/cinder/tab';
  import TabList from '@lostgradient/cinder/tab-list';
  import TabPanel from '@lostgradient/cinder/tab-panel';
  import Tabs from '@lostgradient/cinder/tabs';

  let namespaceTab = $state('workflow');
  let directTab = $state('direct');
  let hydrated = $state(false);

  $effect(() => {
    hydrated = true;
  });
</script>

<main data-dev-ssr-hydrated={hydrated}>
  <Tabs bind:value={namespaceTab}>
    <Tabs.List label="Editor files">
      <Tabs.Trigger value="workflow">
        <span data-dev-ssr-tabs-namespace-trigger>workflows.ts</span>
      </Tabs.Trigger>
    </Tabs.List>
    <Tabs.Panel value="workflow">
      <section data-dev-ssr-tabs-namespace-panel>Workflow editor</section>
    </Tabs.Panel>
  </Tabs>

  <Tabs bind:value={directTab}>
    <TabList label="Direct editor files">
      <Tab value="direct">
        <span data-dev-ssr-tabs-direct-trigger>direct.ts</span>
      </Tab>
    </TabList>
    <TabPanel value="direct">
      <section data-dev-ssr-tabs-direct-panel>Direct editor</section>
    </TabPanel>
  </Tabs>
</main>
