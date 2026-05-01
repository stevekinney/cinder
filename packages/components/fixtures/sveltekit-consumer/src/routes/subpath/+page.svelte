<script lang="ts">
  // Subpath imports — exercises individual component exports
  import AccordionItem from 'cinder/accordion-item';
  import Accordion from 'cinder/accordion';
  import Alert from 'cinder/alert';
  import Badge from 'cinder/badge';
  import Button from 'cinder/button';
  import Card from 'cinder/card';
  import DataList from 'cinder/data-list';
  import Dropdown from 'cinder/dropdown';
  import EmptyState from 'cinder/empty-state';
  import Input from 'cinder/input';
  import Modal from 'cinder/modal';
  import NavigationBar from 'cinder/navigation-bar';
  import NavigationItem from 'cinder/navigation-item';
  import PageLayout from 'cinder/page-layout';
  import Pagination from 'cinder/pagination';
  import Select from 'cinder/select';
  import Skeleton from 'cinder/skeleton';
  import Spinner from 'cinder/spinner';
  import Textarea from 'cinder/textarea';
  import Toggle from 'cinder/toggle';
  import Tooltip from 'cinder/tooltip';

  let currentPage = $state(1);
  let inputValue = $state('');
  let textareaValue = $state('');
  let selectValue = $state('option-a');
  let togglePressed = $state(false);
  let modalOpen = $state(false);
  let dropdownOpen = $state(false);
  let expandedIds = $state<string[]>([]);
</script>

<main>
  <h1>cinder sveltekit consumer fixture — subpath imports</h1>

  <section aria-label="Alert">
    <Alert variant="success">
      {#snippet children()}Success alert{/snippet}
    </Alert>
  </section>

  <section aria-label="Badge">
    <Badge variant="info">
      {#snippet children()}info{/snippet}
    </Badge>
  </section>

  <section aria-label="Button">
    <Button label="subpath button" variant="secondary" />
  </section>

  <section aria-label="Card with header">
    <Card>
      {#snippet header()}<h2>Card header</h2>{/snippet}
      {#snippet children()}<p>card via subpath</p>{/snippet}
    </Card>
  </section>

  <section aria-label="DataList">
    <DataList items={[1, 2, 3]}>
      {#snippet children(item)}<li>{item}</li>{/snippet}
    </DataList>
  </section>

  <section aria-label="Dropdown">
    <Dropdown bind:open={dropdownOpen}>
      {#snippet trigger()}<button type="button">dropdown trigger</button>{/snippet}
      {#snippet children()}<div role="menu"><p>menu</p></div>{/snippet}
    </Dropdown>
  </section>

  <section aria-label="EmptyState">
    <EmptyState title="No results" />
  </section>

  <section aria-label="Input">
    <Input id="subpath-input" bind:value={inputValue} label="Name" />
  </section>

  <section aria-label="Modal trigger">
    <button type="button" onclick={() => (modalOpen = true)}>Open modal</button>
    <Modal bind:open={modalOpen} title="Subpath modal">
      {#snippet children()}<p>modal via subpath</p>{/snippet}
    </Modal>
  </section>

  <section aria-label="NavigationBar">
    <NavigationBar>
      {#snippet items()}<NavigationItem href="/subpath" active={true}>Subpath</NavigationItem
        >{/snippet}
    </NavigationBar>
  </section>

  <section aria-label="PageLayout">
    <PageLayout title="Subpath page">
      {#snippet children()}<p>subpath content</p>{/snippet}
    </PageLayout>
  </section>

  <section aria-label="Pagination">
    <Pagination bind:currentPage totalPages={5} />
  </section>

  <section aria-label="Select">
    <Select
      id="subpath-select"
      bind:value={selectValue}
      options={[{ value: 'option-a', label: 'A' }]}
      label="Pick"
    />
  </section>

  <section aria-label="Skeleton">
    <Skeleton height="40px" />
  </section>

  <section aria-label="Spinner">
    <Spinner size="sm" label="Loading subpath..." />
  </section>

  <section aria-label="Textarea">
    <Textarea id="subpath-textarea" bind:value={textareaValue} label="Message" />
  </section>

  <section aria-label="Toggle">
    <Toggle id="subpath-toggle" bind:checked={togglePressed} label="Toggle via subpath" />
  </section>

  <section aria-label="Tooltip">
    <Tooltip text="Subpath tooltip" placement="bottom">
      {#snippet children()}<span>hover</span>{/snippet}
    </Tooltip>
  </section>

  <section aria-label="Accordion">
    <Accordion bind:expandedIds>
      {#snippet children()}
        <AccordionItem id="sp-1" title="Subpath accordion">
          {#snippet children()}<p>panel content</p>{/snippet}
        </AccordionItem>
      {/snippet}
    </Accordion>
  </section>
</main>
