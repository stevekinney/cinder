<script lang="ts">
  // Barrel imports — exercises the main cinder entry point
  import {
    AccordionItem,
    Accordion,
    Alert,
    Badge,
    Button,
    Card,
    DataList,
    Dropdown,
    EmptyState,
    Input,
    Modal,
    NavigationBar,
    NavigationItem,
    Pagination,
    Select,
    Skeleton,
    Spinner,
    Textarea,
    Toggle,
    Tooltip,
    useHistory,
  } from 'cinder';
  import '../app.css';

  let currentPage = $state(1);
  let inputValue = $state('');
  let textareaValue = $state('');
  // Select is generic over its option value union (#192); the bound value must
  // be one of the literal option values, not a widened `string`.
  let selectValue = $state<'option-a' | 'option-b'>('option-a');
  let togglePressed = $state(false);
  let modalOpen = $state(false);
  let dropdownOpen = $state(false);
  let expandedIds = $state<string[]>([]);
  const useHistoryExportIsFunction = typeof useHistory === 'function';
</script>

<main data-use-history-import={useHistoryExportIsFunction ? 'available' : 'missing'}>
  <h1>cinder sveltekit consumer fixture — barrel imports</h1>

  <section aria-label="Alert">
    <Alert variant="info">
      {#snippet children()}Info alert{/snippet}
    </Alert>
  </section>

  <section aria-label="Badge">
    <Badge variant="neutral">
      {#snippet children()}neutral{/snippet}
    </Badge>
  </section>

  <section aria-label="Button">
    <Button label="click me" />
  </section>

  <section aria-label="Card with title">
    <Card title="Card title" description="Card description">
      {#snippet children()}<p>card body</p>{/snippet}
    </Card>
  </section>

  <section aria-label="DataList">
    <DataList items={['a', 'b', 'c']}>
      {#snippet children(item)}<span>{item}</span>{/snippet}
    </DataList>
  </section>

  <section aria-label="Dropdown">
    <Dropdown bind:open={dropdownOpen}>
      {#snippet trigger()}<button type="button">Open dropdown</button>{/snippet}
      {#snippet children()}<div role="menu"><p>menu item</p></div>{/snippet}
    </Dropdown>
  </section>

  <section aria-label="EmptyState">
    <EmptyState title="Nothing here" description="Add some items" />
  </section>

  <section aria-label="Input">
    <Input id="fixture-input" bind:value={inputValue} label="Your name" />
  </section>

  <section aria-label="Modal trigger">
    <button type="button" onclick={() => (modalOpen = true)}>Open modal</button>
    <Modal bind:open={modalOpen} title="Hello modal">
      {#snippet children()}<p>modal body</p>{/snippet}
    </Modal>
  </section>

  <section aria-label="NavigationBar">
    <NavigationBar>
      {#snippet items({ variant })}<NavigationItem {variant} href="/">Home</NavigationItem
        >{/snippet}
    </NavigationBar>
  </section>

  <section aria-label="NavigationItem">
    <NavigationItem href="/" active={true}>
      {#snippet children()}Home{/snippet}
    </NavigationItem>
  </section>

  <section aria-label="Pagination">
    <Pagination bind:currentPage totalPages={10} />
  </section>

  <section aria-label="Select">
    <Select
      id="fixture-select"
      bind:value={selectValue}
      options={[
        { value: 'option-a', label: 'Option A' },
        { value: 'option-b', label: 'Option B' },
      ]}
      label="Choose one"
    />
  </section>

  <section aria-label="Skeleton">
    <Skeleton width="200px" height="20px" />
  </section>

  <section aria-label="Spinner">
    <Spinner size="md" />
  </section>

  <section aria-label="Textarea">
    <Textarea id="fixture-textarea" bind:value={textareaValue} label="Your message" />
  </section>

  <section aria-label="Toggle">
    <Toggle id="fixture-toggle" bind:checked={togglePressed} label="Enable feature" />
  </section>

  <section aria-label="Tooltip">
    <Tooltip text="Helpful info">
      {#snippet children()}<button type="button">hover me</button>{/snippet}
    </Tooltip>
  </section>

  <section aria-label="Accordion">
    <Accordion bind:expandedIds>
      {#snippet children()}
        <AccordionItem id="item-1" title="First item">
          {#snippet children()}<p>First panel</p>{/snippet}
        </AccordionItem>
        <AccordionItem id="item-2" title="Second item">
          {#snippet children()}<p>Second panel</p>{/snippet}
        </AccordionItem>
      {/snippet}
    </Accordion>
  </section>
</main>
