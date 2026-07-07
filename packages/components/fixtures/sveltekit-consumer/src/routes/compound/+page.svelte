<script lang="ts">
  // Compound namespace exports — exercises the new Tabs.List / Table.Body /
  // Dropdown.Trigger style API from three resolution paths against the packed
  // cinder tarball (not in-repo source):
  //   1. Root barrel:           `import { Tabs } from '@lostgradient/cinder'`
  //   2. Parent subpath default: `import Table from '@lostgradient/cinder/table'`
  //   3. Parent subpath named:   `import { Dropdown } from '@lostgradient/cinder/dropdown'`
  //
  // Every parent family added in this PR is rendered below so the SSR compile
  // path resolves each namespace property against the packed `.d.ts`. If the
  // intersection cast in a parent barrel ever fails to survive declaration
  // emission, `<Parent.Leaf>` will fail to type-check or render here.
  //
  // A flat leaf subpath is also imported to prove the additive contract: flat
  // exports still resolve alongside the namespace API.
  import {
    Accordion,
    Feed,
    GridList,
    SideNavigation,
    StatGroup,
    Tabs,
    Tree,
  } from '@lostgradient/cinder';
  import Tab from '@lostgradient/cinder/tab';
  import { Dropdown } from '@lostgradient/cinder/dropdown';
  import { Segment, SegmentedControl } from '@lostgradient/cinder/segmented-control';
  import {
    Tab as SubpathTab,
    TabList,
    TabPanel,
    Tabs as SubpathTabs,
  } from '@lostgradient/cinder/tabs';
  import Table from '@lostgradient/cinder/table';
  import { ToastRegion, useToast } from '@lostgradient/cinder/toast-region';

  let active = $state('overview');
  let subpathActive = $state('code');
  let workbenchView = $state('source');
  let expandedIds = $state<string[]>([]);
  let expandedTreeIds = $state<string[]>(['fruit']);
</script>

<main>
  <h1>cinder sveltekit consumer fixture — compound namespace imports</h1>

  <section aria-label="Namespaced Tabs (root barrel)">
    <Tabs bind:value={active}>
      <Tabs.List label="Project sections">
        <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
        <Tabs.Trigger value="activity">Activity</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Panel value="overview">Project overview.</Tabs.Panel>
      <Tabs.Panel value="activity">Recent activity.</Tabs.Panel>
    </Tabs>
  </section>

  <section aria-label="Tabs named leaves from parent subpath">
    <SubpathTabs bind:value={subpathActive}>
      <TabList label="Subpath tabs">
        <SubpathTab value="code">Code</SubpathTab>
        <SubpathTab value="preview">Preview</SubpathTab>
      </TabList>
      <TabPanel value="code">Code panel.</TabPanel>
      <TabPanel value="preview">Preview panel.</TabPanel>
    </SubpathTabs>
  </section>

  <section aria-label="SegmentedControl named leaf from parent subpath">
    <SegmentedControl
      id="compound-workbench-view"
      selectionMode="single"
      bind:value={workbenchView}
      label="Workbench view"
    >
      <Segment value="source">Source</Segment>
      <Segment value="rendered">Rendered</Segment>
    </SegmentedControl>
  </section>

  <section aria-label="ToastRegion helper from parent subpath">
    <ToastRegion>
      {@const toast = useToast()}
      <button type="button" onclick={() => toast.show('Saved.', { variant: 'success' })}>
        Show toast
      </button>
    </ToastRegion>
  </section>

  <section aria-label="Namespaced Table (parent subpath default)">
    <Table caption="Sample">
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Name</Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        <Table.Row>
          <Table.Cell>Ada</Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table>
  </section>

  <section aria-label="Namespaced Dropdown (parent subpath named)">
    <Dropdown id="compound-dropdown">
      <Dropdown.Trigger>Actions</Dropdown.Trigger>
      <Dropdown.Menu>
        <Dropdown.Group labelledBy="compound-dropdown-doc">
          <Dropdown.Label id="compound-dropdown-doc">Document</Dropdown.Label>
          <Dropdown.Item>Edit</Dropdown.Item>
        </Dropdown.Group>
        <Dropdown.Separator />
        <Dropdown.Item variant="danger">Delete</Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  </section>

  <section aria-label="Namespaced Accordion">
    <Accordion bind:expandedIds>
      <Accordion.Item id="compound-accordion-one" title="One">First panel content.</Accordion.Item>
    </Accordion>
  </section>

  <section aria-label="Namespaced Tree">
    <Tree aria-label="Pantry" bind:expandedIds={expandedTreeIds}>
      <Tree.Item id="fruit" label="Fruit" branch>
        <Tree.Item id="apple" label="Apple" />
      </Tree.Item>
    </Tree>
  </section>

  <section aria-label="Namespaced Feed">
    <Feed aria-label="Activity">
      <Feed.Event variant="minimal" datetime="2026-05-24T00:00:00Z" timestamp="Just now">
        <p style="margin: 0;">Opened the pull request.</p>
      </Feed.Event>
    </Feed>
  </section>

  <section aria-label="Namespaced GridList">
    <GridList minColumnWidth="14rem" aria-label="Boards">
      <GridList.Item>
        {#snippet title()}<strong>Roadmap</strong>{/snippet}
      </GridList.Item>
      <GridList.Item>
        {#snippet title()}<strong>Inbox</strong>{/snippet}
      </GridList.Item>
    </GridList>
  </section>

  <section aria-label="Namespaced StatGroup">
    <StatGroup label="Metrics" columns={2}>
      <StatGroup.Stat label="Open PRs" value={12} />
      <StatGroup.Stat label="Merged" value={48} />
    </StatGroup>
  </section>

  <section aria-label="Namespaced SideNavigation">
    <SideNavigation ariaLabel="Primary">
      <SideNavigation.Item href="#overview">Overview</SideNavigation.Item>
      <SideNavigation.Group label="Workspace">
        <SideNavigation.Item href="#activity">Activity</SideNavigation.Item>
      </SideNavigation.Group>
    </SideNavigation>
  </section>

  <p>Flat `@lostgradient/cinder/tab` default importable: {typeof Tab === 'function'}</p>
</main>
