<script lang="ts">
  import Card from '@lostgradient/cinder/card';
  import SideNavigation from '@lostgradient/cinder/side-navigation';
  import SideNavigationItem from '@lostgradient/cinder/side-navigation-item';
  import Sidebar from '@lostgradient/cinder/sidebar';
  import Tab from '@lostgradient/cinder/tab';
  import TabList from '@lostgradient/cinder/tab-list';
  import TabPanel from '@lostgradient/cinder/tab-panel';
  import Tabs from '@lostgradient/cinder/tabs';

  let namespaceTab = $state('workflow');
  let directTab = $state('direct');
</script>

<main>
  <Card title="Place a food order" headingLevel={2}>
    <p data-dev-ssr-card-body>Spicy noodles</p>
  </Card>

  <Sidebar label="Project navigation">
    {#snippet brand()}
      <strong data-dev-ssr-sidebar-brand>Cinder workspace</strong>
    {/snippet}
    {#snippet navigation()}
      <SideNavigation ariaLabel="Workflow selection" data-dev-ssr-sidebar-navigation>
        <SideNavigationItem href="/dev-ssr" active={true}>
          <span data-dev-ssr-side-navigation-item>basicOrderWorkflow</span>
        </SideNavigationItem>
      </SideNavigation>
    {/snippet}
  </Sidebar>

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
