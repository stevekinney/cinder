<script lang="ts">
  // Compound namespace exports — exercises the new Tabs.List / Table.Body /
  // Dropdown.Trigger style API from three resolution paths:
  //   1. Root barrel:           `import { Tabs } from 'cinder'`
  //   2. Parent subpath default: `import Table from 'cinder/table'`
  //   3. Parent subpath named:   `import { Dropdown } from 'cinder/dropdown'`
  //
  // It also imports a flat leaf subpath (`cinder/tab`) to prove the additive
  // contract: flat exports still resolve alongside the namespace API.
  import { Accordion, Tabs } from 'cinder';
  import Tab from 'cinder/tab';
  import { Dropdown } from 'cinder/dropdown';
  import Table from 'cinder/table';

  // Sanity-check the namespace properties exist at runtime so the SSR
  // render path exercises every leaf reference. If any property became
  // `undefined` (for example, because the generated `.d.ts` lost the
  // intersection type), Svelte's element tag would error during render.
  const tabsHasList = typeof Tabs.List === 'function';
  const tableHasBody = typeof Table.Body === 'function';
  const dropdownHasTrigger = typeof Dropdown.Trigger === 'function';
  const accordionHasItem = typeof Accordion.Item === 'function';
  const flatTabImport = typeof Tab === 'function';

  let active = $state('overview');
  let expandedIds = $state<string[]>([]);
</script>

<main>
  <h1>cinder sveltekit consumer fixture — compound namespace imports</h1>

  <p data-tabs-has-list={tabsHasList ? 'yes' : 'no'}>Tabs.List available: {tabsHasList}</p>
  <p data-table-has-body={tableHasBody ? 'yes' : 'no'}>Table.Body available: {tableHasBody}</p>
  <p data-dropdown-has-trigger={dropdownHasTrigger ? 'yes' : 'no'}>
    Dropdown.Trigger available: {dropdownHasTrigger}
  </p>
  <p data-accordion-has-item={accordionHasItem ? 'yes' : 'no'}>
    Accordion.Item available: {accordionHasItem}
  </p>
  <p data-flat-tab-import={flatTabImport ? 'yes' : 'no'}>
    Flat `cinder/tab` default importable: {flatTabImport}
  </p>

  <section aria-label="Namespaced Tabs">
    <Tabs bind:value={active}>
      <Tabs.List label="Project sections">
        <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
        <Tabs.Trigger value="activity">Activity</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Panel value="overview">Project overview.</Tabs.Panel>
      <Tabs.Panel value="activity">Recent activity.</Tabs.Panel>
    </Tabs>
  </section>

  <section aria-label="Namespaced Table">
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

  <section aria-label="Namespaced Dropdown">
    <Dropdown id="compound-dropdown">
      <Dropdown.Trigger>Actions</Dropdown.Trigger>
      <Dropdown.Menu>
        <Dropdown.Item>Edit</Dropdown.Item>
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
</main>
