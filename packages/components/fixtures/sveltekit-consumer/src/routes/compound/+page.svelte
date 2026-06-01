<script lang="ts">
  // Compound namespace exports — exercises the new Tabs.List / Table.Body /
  // Dropdown.Trigger style API from three resolution paths against the packed
  // cinder tarball (not in-repo source):
  //   1. Root barrel:           `import { Tabs } from 'cinder'`
  //   2. Parent subpath default: `import Table from 'cinder/table'`
  //   3. Parent subpath named:   `import { Dropdown } from 'cinder/dropdown'`
  //
  // Every parent family added in this PR is rendered below so the SSR compile
  // path resolves each namespace property against the packed `.d.ts`. If the
  // intersection cast in a parent barrel ever fails to survive declaration
  // emission, `<Parent.Leaf>` will fail to type-check or render here.
  //
  // A flat leaf subpath is also imported to prove the additive contract: flat
  // exports still resolve alongside the namespace API.
  import { Accordion, Feed, GridList, SideNavigation, StatGroup, Tabs, Tree } from 'cinder';
  import Tab from 'cinder/tab';
  import { Dropdown } from 'cinder/dropdown';
  import Table from 'cinder/table';

  let active = $state('overview');
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
      <Feed.Event variant="minimal" datetime="2026-05-24T00:00:00Z">
        {#snippet timestamp()}Just now{/snippet}
        {#snippet content()}
          <p style="margin: 0;">Opened the pull request.</p>
        {/snippet}
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

  <p>Flat `cinder/tab` default importable: {typeof Tab === 'function'}</p>
</main>
