<!-- dev-only playground scaffold; window.__CINDER_EXAMPLES__ is injected server-side -->
<script lang="ts">
  import { mount, unmount } from 'svelte';
  import { Accordion } from '@lostgradient/cinder/accordion';
  import { AccordionItem } from '@lostgradient/cinder/accordion-item';
  import { Badge } from '@lostgradient/cinder/badge';
  import { Button } from '@lostgradient/cinder/button';
  import { Callout } from '@lostgradient/cinder/callout';
  import { Card } from '@lostgradient/cinder/card';
  import { CodeBlock } from '@lostgradient/cinder/code-block';
  import { Skeleton } from '@lostgradient/cinder/skeleton';
  import { Table } from '@lostgradient/cinder/table';
  import { Tab } from '@lostgradient/cinder/tab';
  import { TabList } from '@lostgradient/cinder/tab-list';
  import { TabPanel } from '@lostgradient/cinder/tab-panel';
  import { Tabs } from '@lostgradient/cinder/tabs';
  import { splitReadmeHtml } from './split-readme-html.ts';
  import {
    formatErrorForClipboard,
    toMountErrorDetail,
    type MountErrorDetail,
    type SourceErrorDetail,
  } from './example-error.ts';
  import {
    fetchComponentDocumentation,
    schemaPropertyNames,
    schemaRequiredPropertyNames,
    variablesList,
  } from './component-documentation-reference.ts';
  import type {
    ComponentDocumentationPayload,
    JsonValue,
  } from './component-documentation-types.ts';
  import { splitUnionType, toPropReferenceRows } from './manifest-reference.ts';

  type CinderExampleDescriptor = {
    scenario: string;
    title: string;
    description?: string;
    featured?: boolean;
  };
  type CinderWindow = Window &
    typeof globalThis & { __CINDER_EXAMPLES__?: CinderExampleDescriptor[] };
  type DocumentationTabId = 'overview' | 'examples' | 'raw-artifacts';
  type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
  type ConstraintRuleSummary = {
    id: string;
    severity: string | undefined;
    description: string;
    kind: string | undefined;
  };
  type ConstraintExampleSummary = {
    title: string;
    code: string;
    violates: string | undefined;
  };

  const documentationTabs: { id: DocumentationTabId; label: string }[] = [
    { id: 'overview', label: 'Documentation' },
    { id: 'examples', label: 'Examples' },
    { id: 'raw-artifacts', label: 'Raw Artifacts' },
  ];
  const documentationTabSearchParam = 'tab';

  // The server injects window.__CINDER_EXAMPLES__ before the bundle script tag.
  // Fall back to an empty array so the component doesn't crash if the global is missing.
  function readExamples(): CinderExampleDescriptor[] {
    if (typeof window === 'undefined') return [];
    const raw = (window as CinderWindow).__CINDER_EXAMPLES__;
    return Array.isArray(raw) ? raw : [];
  }

  const examples: CinderExampleDescriptor[] = readExamples();
  const explicitlyFeaturedExamples = examples.filter((example) => example.featured === true);
  const overviewFeaturedExamples =
    explicitlyFeaturedExamples.length > 0
      ? explicitlyFeaturedExamples
      : examples.slice(0, Math.min(2, examples.length));
  const overviewFeaturedScenarioIds = new Set(
    overviewFeaturedExamples.map((example) => example.scenario),
  );
  const overviewLinkedExamples = examples.filter(
    (example) => !overviewFeaturedScenarioIds.has(example.scenario),
  );

  // Extract the component name from the current URL path: /page/<name>
  const componentName: string =
    window.location.pathname.replace(/^\/page\//, '').split('/')[0] ?? '';

  function isDocumentationTabId(value: string | null): value is DocumentationTabId {
    return value !== null && documentationTabs.some((tab) => tab.id === value);
  }

  function parentSearchParams(): URLSearchParams | null {
    try {
      if (window.parent === window) return null;
      if (window.parent.location.origin !== window.location.origin) return null;
      return new URL(window.parent.location.href).searchParams;
    } catch {
      return null;
    }
  }

  function initialDocumentationTab(): DocumentationTabId {
    const searchParams = new URLSearchParams(window.location.search);
    const requestedTab =
      searchParams.get(documentationTabSearchParam) ??
      parentSearchParams()?.get(documentationTabSearchParam) ??
      null;
    if (isDocumentationTabId(requestedTab)) return requestedTab;
    return 'examples';
  }

  let activeTab: DocumentationTabId = $state(initialDocumentationTab());

  function isSnapshotMode(): boolean {
    return new URLSearchParams(window.location.search).get('snapshot') === '1';
  }

  function hrefWithDocumentationTab(href: string, tab: DocumentationTabId): string {
    const url = new URL(href);
    url.searchParams.set(documentationTabSearchParam, tab);
    return `${url.pathname}${url.search}${url.hash}`;
  }

  function synchronizeDocumentationTabUrl(tab: DocumentationTabId): void {
    if (isSnapshotMode()) return;

    history.replaceState(history.state, '', hrefWithDocumentationTab(window.location.href, tab));

    try {
      if (window.parent === window) return;
      if (window.parent.location.origin !== window.location.origin) return;
      window.parent.history.replaceState(
        window.parent.history.state,
        '',
        hrefWithDocumentationTab(window.parent.location.href, tab),
      );
    } catch {
      // Direct /page routes and locked-down embeds still have their own iframe URL.
    }
  }

  function selectExampleFromOverview(event: MouseEvent, scenario?: string): void {
    event.preventDefault();
    selectTab('examples');
    if (scenario === undefined) return;
    requestAnimationFrame(() => {
      document.getElementById(`example-card-${scenario}`)?.scrollIntoView({
        block: 'start',
        behavior: 'smooth',
      });
    });
  }

  // Track which scenarios have had their source fetched so we only
  // hit /example-src once per scenario regardless of how many times the user
  // opens and closes the accordion.
  const fetchedSource: Record<string, string | null> = $state({});
  const loadingSource: Record<string, boolean> = $state({});

  // Per-scenario error surfaces. `mountErrors` captures failures thrown by the
  // imperative `mount()` below — `<svelte:boundary>` can't catch those because
  // the examples are mounted into bare <div>s via an $effect, not declaratively,
  // so the try/catch around mount() is the only place the error is observable.
  // `sourceErrors` captures the detail (requested URL + HTTP status / exception)
  // behind a failed "View source" fetch so the Retry button has something to
  // explain and re-run.
  const mountErrors: Record<string, MountErrorDetail | undefined> = $state({});
  const sourceErrors: Record<string, SourceErrorDetail | undefined> = $state({});

  // Per-scenario accordion expansion state — each entry is a reactive object
  // with a typed `ids` field so property access never returns undefined
  // (noUncheckedIndexedAccess widens plain index signatures, but a typed tuple
  // of objects with known property names is unambiguous).
  const accordionState = $state(
    examples.map(({ scenario }) => ({ scenario, expandedIds: [] as string[] })),
  );

  function getAccordionEntry(
    scenario: string,
  ): { scenario: string; expandedIds: string[] } | undefined {
    return accordionState.find((entry) => entry.scenario === scenario);
  }

  async function fetchSource(scenario: string): Promise<void> {
    const url = `/example-src/${componentName}/${scenario}`;
    loadingSource[scenario] = true;
    // Clear any prior failure so a Retry starts from a clean slate.
    sourceErrors[scenario] = undefined;
    try {
      const response = await fetch(url);
      if (response.ok) {
        fetchedSource[scenario] = await response.text();
      } else {
        fetchedSource[scenario] = null;
        sourceErrors[scenario] = {
          url,
          detail: `${response.status} ${response.statusText}`.trim(),
        };
      }
    } catch (error) {
      fetchedSource[scenario] = null;
      sourceErrors[scenario] = {
        url,
        detail: error instanceof Error ? error.message : String(error),
      };
    } finally {
      loadingSource[scenario] = false;
    }
  }

  /**
   * Copy an error detail to the clipboard. Guarded so the button is a no-op
   * (rather than a thrown TypeError) in browsers / contexts where the async
   * Clipboard API is unavailable.
   */
  async function copyError(detail: MountErrorDetail): Promise<void> {
    if (typeof navigator === 'undefined' || navigator.clipboard === undefined) return;
    try {
      await navigator.clipboard.writeText(formatErrorForClipboard(detail));
    } catch {
      // Clipboard write can reject (permissions, insecure context). Swallow —
      // copying an error message is a convenience, never load-bearing.
    }
  }

  // Fire the lazy fetch exactly once per scenario on first accordion expansion.
  $effect(() => {
    for (const entry of accordionState) {
      if (
        entry.expandedIds.includes('source') &&
        fetchedSource[entry.scenario] === undefined &&
        !loadingSource[entry.scenario]
      ) {
        void fetchSource(entry.scenario);
      }
    }
  });

  // Mount each example into its target. The page-bundle server route bundles
  // every scenario for this component together with this page, sharing one
  // Svelte runtime, and exposes the components on window.__CINDER_SCENARIOS__.
  $effect(() => {
    // Depend on activeTab so the effect reruns when the Examples panel mounts
    // (e.g. if the user loads with ?tab=overview, the containers don't exist
    // on first run — re-tracking means we retry once Examples becomes active).
    if (activeTab !== 'examples') return;

    // Per-run local collection so the cleanup only unmounts this run's mounts.
    // Svelte 5 disposal is unmount(component), not component.destroy().
    const localApps: ReturnType<typeof mount>[] = [];

    const registry =
      ((window as unknown as Record<string, unknown>)['__CINDER_SCENARIOS__'] as
        | Record<string, unknown>
        | undefined) ?? {};

    // Svelte 5 effects run after the DOM is patched, so every
    // `example-mount-<scenario>` container the template renders already exists
    // here. Mount synchronously into the same `localApps` the cleanup closes
    // over — no microtask deferral, so a re-run's cleanup can never race a
    // still-pending mount into a stale collection.
    for (const { scenario } of examples) {
      const container = document.getElementById(`example-mount-${scenario}`);
      if (!container) continue;

      const Component = registry[scenario];
      if (typeof Component !== 'function') {
        console.error(`[cinder playground] no registered component for scenario "${scenario}"`);
        continue;
      }

      try {
        const app = mount(Component as Parameters<typeof mount>[0], { target: container });
        localApps.push(app);
        // A previous failed run may have left an error surface; clear it now
        // that this scenario mounted cleanly.
        mountErrors[scenario] = undefined;
      } catch (error) {
        console.error(`[cinder playground] failed to mount example "${scenario}":`, error);
        // Surface the failure in the UI instead of leaving a silent blank slot.
        mountErrors[scenario] = toMountErrorDetail(error);
      }
    }

    return () => {
      for (const app of localApps) {
        try {
          unmount(app);
        } catch {
          // Suppress — best-effort cleanup only.
        }
      }
    };
  });

  // --- Component documentation payload -----------------------------------
  // The component name is fixed for the lifetime of this page (it comes from
  // the URL once), so the canonical documentation payload is fetched exactly
  // once at init and then normalized locally for each tab.
  let documentation = $state<ComponentDocumentationPayload | null>(null);
  let documentationLoading = $state(true);
  let documentationError: string | null = $state(null);

  // The skeleton placeholder rows give the table a stable shape while the
  // request is in flight.
  const skeletonRowCount = 5;
  const propRows = $derived(
    documentation === null ? [] : toPropReferenceRows(documentation.propsManifest),
  );
  const schemaProperties = $derived(
    documentation === null ? [] : schemaPropertyNames(documentation.schema),
  );
  const schemaRequiredProperties = $derived(
    new Set(documentation === null ? [] : schemaRequiredPropertyNames(documentation.schema)),
  );
  const cssVariables = $derived(
    documentation === null ? [] : variablesList(documentation.variables),
  );
  const constraintRules = $derived(
    documentation === null ? [] : constraintRuleSummaries(documentation.constraints),
  );
  const validConstraintExamples = $derived(
    documentation === null ? [] : constraintExampleSummaries(documentation.constraints, 'valid'),
  );
  const invalidConstraintExamples = $derived(
    documentation === null ? [] : constraintExampleSummaries(documentation.constraints, 'invalid'),
  );

  function isRecord(value: JsonValue | undefined): value is Record<string, JsonValue> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  function stringProperty(value: Record<string, JsonValue>, key: string): string | undefined {
    const property = value[key];
    return typeof property === 'string' ? property : undefined;
  }

  function constraintRuleSummaries(value: JsonValue | null): ConstraintRuleSummary[] {
    if (!isRecord(value)) return [];
    const rules = value['rules'];
    if (!Array.isArray(rules)) return [];
    return rules.flatMap((rule) => {
      if (!isRecord(rule)) return [];
      const id = stringProperty(rule, 'id');
      const description = stringProperty(rule, 'description');
      if (id === undefined || description === undefined) return [];
      return [
        {
          id,
          description,
          severity: stringProperty(rule, 'severity'),
          kind: stringProperty(rule, 'kind'),
        },
      ];
    });
  }

  function constraintExampleSummaries(
    value: JsonValue | null,
    kind: 'valid' | 'invalid',
  ): ConstraintExampleSummary[] {
    if (!isRecord(value)) return [];
    const examples = value['examples'];
    if (!isRecord(examples)) return [];
    const entries = examples[kind];
    if (!Array.isArray(entries)) return [];
    return entries.flatMap((entry) => {
      if (!isRecord(entry)) return [];
      const title = stringProperty(entry, 'title');
      const code = stringProperty(entry, 'code');
      if (title === undefined || code === undefined) return [];
      return [{ title, code, violates: stringProperty(entry, 'violates') }];
    });
  }

  function jsonBlock(value: JsonValue | null): string {
    return JSON.stringify(value, null, 2);
  }

  function propsTypeClass(typeMembers: readonly string[]): string {
    return typeMembers.length > 1 ? 'props-type props-type--union' : 'props-type';
  }

  function selectTab(tab: DocumentationTabId): void {
    activeTab = tab;
  }

  function statusBadgeVariant(status: string): BadgeVariant {
    switch (status) {
      case 'stable':
        return 'success';
      case 'beta':
        return 'info';
      case 'alpha':
        return 'warning';
      case 'domain-suite':
        return 'neutral';
      default:
        return 'neutral';
    }
  }

  $effect(() => {
    synchronizeDocumentationTabUrl(activeTab);
  });

  $effect(() => {
    function syncFromLocation(): void {
      const requestedTab =
        parentSearchParams()?.get(documentationTabSearchParam) ??
        new URLSearchParams(window.location.search).get(documentationTabSearchParam);
      if (isDocumentationTabId(requestedTab)) activeTab = requestedTab;
    }

    window.addEventListener('popstate', syncFromLocation);
    try {
      if (window.parent !== window && window.parent.location.origin === window.location.origin) {
        window.parent.addEventListener('popstate', syncFromLocation);
        return () => {
          window.removeEventListener('popstate', syncFromLocation);
          window.parent.removeEventListener('popstate', syncFromLocation);
        };
      }
    } catch {
      // Cross-origin parents are ignored; direct /page routes still listen above.
    }

    return () => {
      window.removeEventListener('popstate', syncFromLocation);
    };
  });

  // Fetch the documentation payload once. componentName is non-reactive, so
  // this effect runs exactly once. The cancellation flag prevents writing to
  // state after the component is torn down mid-flight.
  $effect(() => {
    if (componentName === '') {
      documentationLoading = false;
      return;
    }
    let cancelled = false;
    fetchComponentDocumentation(componentName)
      .then((payload) => {
        if (!cancelled) documentation = payload;
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          documentationError =
            error instanceof Error ? error.message : 'Failed to load documentation.';
        }
      })
      .finally(() => {
        if (!cancelled) documentationLoading = false;
      });
    return () => {
      cancelled = true;
    };
  });
</script>

<div class="documentation-page">
  <Tabs bind:value={activeTab} class="documentation-tabs-root">
    <TabList label="Component documentation" class="documentation-tabs">
      {#each documentationTabs as tab (tab.id)}
        <Tab value={tab.id}>{tab.label}</Tab>
      {/each}
    </TabList>

    <TabPanel value="overview" class="documentation-panel documentation-panel--overview">
      {#if documentationLoading}
        <div class="documentation-skeleton" aria-hidden="true">
          {#each Array.from({ length: skeletonRowCount }, (_, index) => index) as row (row)}
            <Skeleton height="1.5rem" radius="var(--cinder-radius-sm)" />
          {/each}
        </div>
      {:else if documentationError !== null}
        <Callout variant="danger" title="Could not load documentation">
          <p class="documentation-error">{documentationError}</p>
        </Callout>
      {:else if documentation !== null}
        <section class="overview-hero" aria-labelledby="overview-title">
          <div class="overview-hero-main">
            <h1 id="overview-title">{documentation.component.name}</h1>
            <p class="overview-purpose">{documentation.component.purpose}</p>
            <p class="overview-import">
              <span>Import</span>
              <code>{documentation.component.importSpecifier}</code>
            </p>
          </div>
          <dl class="metadata-list" aria-label="Component metadata">
            <div>
              <dt>Status</dt>
              <dd>
                <Badge variant={statusBadgeVariant(documentation.component.status)} size="sm">
                  {documentation.component.status}
                </Badge>
                {#if documentation.component.statusDescription !== ''}
                  <span>{documentation.component.statusDescription}</span>
                {/if}
              </dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>
                <strong>{documentation.component.categoryLabel}</strong>
                {#if documentation.component.categoryDescription !== ''}
                  <span>{documentation.component.categoryDescription}</span>
                {/if}
              </dd>
            </div>
            {#if documentation.component.tags.length > 0}
              <div>
                <dt>Tags</dt>
                <dd class="badge-list">
                  {#each documentation.component.tags as tag (tag)}
                    <Badge variant="neutral" size="xs">{tag}</Badge>
                  {/each}
                </dd>
              </div>
            {/if}
          </dl>
        </section>

        {#if overviewFeaturedExamples.length > 0}
          <section class="overview-section" aria-labelledby="featured-examples-heading">
            <div class="section-heading-row">
              <h2 id="featured-examples-heading">
                {explicitlyFeaturedExamples.length > 0 ? 'Featured Examples' : 'Start Here'}
              </h2>
              <a href="?tab=examples" onclick={(event) => selectExampleFromOverview(event)}>
                View all examples
              </a>
            </div>
            <div class="featured-example-grid">
              {#each overviewFeaturedExamples as example (example.scenario)}
                <a
                  class="featured-example-card"
                  href="?tab=examples#example-card-{example.scenario}"
                  onclick={(event) => selectExampleFromOverview(event, example.scenario)}
                >
                  <span>{example.title}</span>
                  {#if example.description !== undefined}
                    <small>{example.description}</small>
                  {/if}
                </a>
              {/each}
            </div>
            {#if overviewLinkedExamples.length > 0}
              <div class="example-link-list" aria-label="More examples">
                {#each overviewLinkedExamples as example (example.scenario)}
                  <a
                    href="?tab=examples#example-card-{example.scenario}"
                    onclick={(event) => selectExampleFromOverview(event, example.scenario)}
                  >
                    {example.title}
                  </a>
                {/each}
              </div>
            {/if}
          </section>
        {/if}

        <section class="overview-section" aria-label="{documentation.component.name} README">
          <div class="readme-content">
            {#each splitReadmeHtml(documentation.readme.html) as segment, i (i)}
              {#if segment.type === 'html'}
                {@html segment.content}
              {:else}
                {@const block = documentation.readme.codeBlocks[segment.index]}
                {#if block !== undefined}
                  <CodeBlock code={block.value} language={block.language ?? 'plaintext'} copyable />
                {:else}
                  <div class="readme-pre-fallback">{@html segment.fallbackHtml}</div>
                {/if}
              {/if}
            {/each}
          </div>
        </section>

        <div class="guidance-grid">
          <section class="guidance-section" aria-labelledby="use-when-heading">
            <h2 id="use-when-heading">Use When</h2>
            <ul>
              {#each documentation.component.useWhen as item (item)}
                <li>{item}</li>
              {/each}
            </ul>
          </section>
          <section class="guidance-section" aria-labelledby="avoid-when-heading">
            <h2 id="avoid-when-heading">Avoid When</h2>
            <ul>
              {#each documentation.component.avoidWhen as item (item)}
                <li>{item}</li>
              {/each}
            </ul>
          </section>
          {#if documentation.component.related.length > 0}
            <section class="guidance-section" aria-labelledby="related-heading">
              <h2 id="related-heading">Related</h2>
              <div class="related-links">
                {#each documentation.component.related as related (related)}
                  <a href="/c/{related}" target="_top">{related}</a>
                {/each}
              </div>
            </section>
          {/if}
        </div>

        <section class="overview-section props-section" aria-labelledby="props-heading">
          <h2 id="props-heading" class="props-heading">API</h2>
          <section class="schema-section" aria-labelledby="schema-heading">
            <h3 id="schema-heading">JSON Schema</h3>
            <div class="schema-summary">
              <div>
                <span>Properties</span>
                <strong>{schemaProperties.length}</strong>
              </div>
              <div>
                <span>Required</span>
                <strong>{schemaRequiredProperties.size}</strong>
              </div>
            </div>
            {#if schemaProperties.length > 0}
              <ul class="schema-property-list">
                {#each schemaProperties as property (property)}
                  <li>
                    <code>{property}</code>
                    {#if schemaRequiredProperties.has(property)}
                      <Badge variant="danger" size="xs">required</Badge>
                    {/if}
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="props-empty">The generated schema has no properties.</p>
            {/if}
          </section>

          {#if propRows.length === 0}
            <p class="props-empty">This component has no documented props.</p>
          {:else}
            <!-- tabindex="0" makes the scrollable region keyboard-accessible (axe
                 scrollable-region-focusable / WCAG 2.1.1) when the props table
                 overflows horizontally on narrow viewports. -->
            <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
            <div
              class="props-table-scroll"
              role="region"
              aria-labelledby="props-heading"
              tabindex="0"
            >
              <Table caption={`Props for ${componentName}`} density="condensed">
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell scope="col">Name</Table.HeaderCell>
                    <Table.HeaderCell scope="col">Type</Table.HeaderCell>
                    <Table.HeaderCell scope="col">Default</Table.HeaderCell>
                    <Table.HeaderCell scope="col" align="center">Required</Table.HeaderCell>
                    <Table.HeaderCell scope="col" align="center">Bindable</Table.HeaderCell>
                    <Table.HeaderCell scope="col">Description</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {#each propRows as prop (prop.name)}
                    <Table.Row>
                      <Table.Cell>
                        <code class="props-name">{prop.name}</code>
                        {#if prop.required}
                          <span class="props-required-gem" aria-hidden="true"></span>
                        {/if}
                      </Table.Cell>
                      <Table.Cell>
                        {@const typeMembers = splitUnionType(prop.type)}
                        <code class={propsTypeClass(typeMembers)}>
                          {#each typeMembers as member, index (index)}
                            <span class="props-type__member">
                              {#if index > 0}<span class="props-type__sep" aria-hidden="true"
                                  >|
                                </span>{/if}<span class="props-type__value">{member}</span>
                            </span>
                          {/each}
                        </code>
                      </Table.Cell>
                      <Table.Cell>
                        {#if prop.defaultValue !== undefined}
                          <code class="props-default">{prop.defaultValue}</code>
                        {:else}
                          <span class="props-dash" aria-hidden="true">—</span>
                        {/if}
                      </Table.Cell>
                      <Table.Cell align="center">
                        {#if prop.required}
                          <span class="props-required-gem" aria-hidden="true"></span>
                          <span class="props-visually-hidden">Required</span>
                        {:else}
                          <span class="props-dash" aria-hidden="true">—</span>
                        {/if}
                      </Table.Cell>
                      <Table.Cell align="center">
                        {#if prop.bindable}
                          <Badge variant="info" size="xs">bind:</Badge>
                        {:else}
                          <span class="props-dash" aria-hidden="true">—</span>
                        {/if}
                      </Table.Cell>
                      <Table.Cell>
                        {#if prop.description !== undefined}
                          <span class="props-description">{prop.description}</span>
                        {:else}
                          <span class="props-dash" aria-hidden="true">—</span>
                        {/if}
                      </Table.Cell>
                    </Table.Row>
                  {/each}
                </Table.Body>
              </Table>
            </div>
          {/if}
        </section>

        <section class="overview-section" aria-labelledby="styling-heading">
          <h2 id="styling-heading">Styling</h2>
          {#if cssVariables.length === 0}
            <p class="empty-state">This component does not declare local CSS variables.</p>
          {:else}
            <ul class="variable-list">
              {#each cssVariables as variable (variable)}
                <li><code>{variable}</code></li>
              {/each}
            </ul>
          {/if}
        </section>

        <section class="overview-section" aria-labelledby="constraints-heading">
          <h2 id="constraints-heading">Constraints</h2>
          {#if documentation.constraints === null}
            <p class="empty-state">No generated constraints are declared for this component.</p>
          {:else}
            {@const constraintsSummary = isRecord(documentation.constraints)
              ? stringProperty(documentation.constraints, 'summary')
              : undefined}
            {#if constraintsSummary !== undefined}
              <p class="constraint-summary">{constraintsSummary}</p>
            {/if}
            {#if constraintRules.length > 0}
              <ol class="constraint-rules">
                {#each constraintRules as rule (rule.id)}
                  <li>
                    <div class="constraint-rule-header">
                      <code>{rule.id}</code>
                      {#if rule.severity !== undefined}
                        <Badge variant={rule.severity === 'error' ? 'danger' : 'warning'} size="xs">
                          {rule.severity}
                        </Badge>
                      {/if}
                      {#if rule.kind !== undefined}
                        <Badge variant="neutral" size="xs">{rule.kind}</Badge>
                      {/if}
                    </div>
                    <p>{rule.description}</p>
                  </li>
                {/each}
              </ol>
            {:else}
              <p class="empty-state">The constraints artifact has no readable rules.</p>
            {/if}

            <div class="constraint-example-grid">
              <section aria-labelledby="valid-constraint-examples-heading">
                <h3 id="valid-constraint-examples-heading">Valid Examples</h3>
                {#if validConstraintExamples.length === 0}
                  <p class="empty-state">No valid examples are listed.</p>
                {:else}
                  {#each validConstraintExamples as example (example.title)}
                    <div class="constraint-example">
                      <h4>{example.title}</h4>
                      <CodeBlock code={example.code} language="svelte" copyable />
                    </div>
                  {/each}
                {/if}
              </section>
              <section aria-labelledby="invalid-constraint-examples-heading">
                <h3 id="invalid-constraint-examples-heading">Invalid Examples</h3>
                {#if invalidConstraintExamples.length === 0}
                  <p class="empty-state">No invalid examples are listed.</p>
                {:else}
                  {#each invalidConstraintExamples as example (example.title)}
                    <div class="constraint-example">
                      <h4>{example.title}</h4>
                      {#if example.violates !== undefined}
                        <p class="violates-label">Violates <code>{example.violates}</code></p>
                      {/if}
                      <CodeBlock code={example.code} language="svelte" copyable />
                    </div>
                  {/each}
                {/if}
              </section>
            </div>
          {/if}
        </section>
      {/if}
    </TabPanel>
    <TabPanel value="examples" class="documentation-panel">
      <h2>Examples</h2>
      <div class="example-list">
        {#if examples.length === 0}
          <p class="no-examples">No examples found for <code>{componentName}</code>.</p>
        {/if}

        {#each examples as { scenario, title, description } (scenario)}
          {@const accordionEntry = getAccordionEntry(scenario)}
          {@const source = fetchedSource[scenario]}
          {@const mountError = mountErrors[scenario]}
          {@const sourceError = sourceErrors[scenario]}
          {#if accordionEntry}
            <section id="example-card-{scenario}" class="example-card-anchor">
              <Card {title} {...description !== undefined ? { description } : {}}>
                <div class="example-preview" id="example-mount-{scenario}"></div>

                {#if mountError !== undefined}
                  <div class="example-error">
                    <Callout variant="danger" title="This example failed to render">
                      <p class="example-error__message">{mountError.message}</p>
                      {#if mountError.stack !== undefined}
                        <pre
                          class="example-error__stack"
                          aria-label="Stack trace">{mountError.stack}</pre>
                      {/if}
                      <div class="example-error__actions">
                        <Button
                          size="sm"
                          variant="secondary"
                          aria-label="Copy error for {title}"
                          onclick={() => copyError(mountError)}
                        >
                          Copy error
                        </Button>
                      </div>
                    </Callout>
                  </div>
                {/if}

                <Accordion bind:expandedIds={accordionEntry.expandedIds}>
                  <AccordionItem id="source" title="View source">
                    {#if loadingSource[scenario]}
                      <p class="source-loading">Loading…</p>
                    {:else if source === null}
                      <div class="example-error">
                        <Callout variant="danger" title="Could not load source">
                          <dl class="example-error__detail">
                            <dt>Requested</dt>
                            <dd>
                              <code>
                                {sourceError?.url ?? `/example-src/${componentName}/${scenario}`}
                              </code>
                            </dd>
                            <dt>Reason</dt>
                            <dd>{sourceError?.detail ?? 'Unknown error'}</dd>
                          </dl>
                          <div class="example-error__actions">
                            <Button
                              size="sm"
                              variant="secondary"
                              aria-label="Retry loading source for {title}"
                              onclick={() => fetchSource(scenario)}
                            >
                              Retry
                            </Button>
                          </div>
                        </Callout>
                      </div>
                    {:else if source !== undefined}
                      <CodeBlock code={source} language="svelte" copyable />
                    {/if}
                  </AccordionItem>
                </Accordion>
              </Card>
            </section>
          {/if}
        {/each}
      </div>
    </TabPanel>
    <TabPanel value="raw-artifacts" class="documentation-panel">
      <h2>Raw Artifacts</h2>
      {#if documentationLoading}
        <div class="documentation-skeleton" aria-hidden="true">
          {#each Array.from({ length: skeletonRowCount }, (_, index) => index) as row (row)}
            <Skeleton height="1.5rem" radius="var(--cinder-radius-sm)" />
          {/each}
        </div>
      {:else if documentationError !== null}
        <p class="props-error">Could not load documentation: {documentationError}</p>
      {:else if documentation !== null}
        <div class="raw-artifact-grid">
          <section class="raw-artifact-panel" aria-labelledby="manifest-entry-heading">
            <h3 id="manifest-entry-heading">Manifest Entry</h3>
            <CodeBlock
              code={jsonBlock(documentation.rawArtifacts.manifestEntry)}
              language="json"
              copyable
            />
          </section>
          <section class="raw-artifact-panel" aria-labelledby="schema-artifact-heading">
            <h3 id="schema-artifact-heading">Schema</h3>
            <CodeBlock
              code={jsonBlock(documentation.rawArtifacts.schema)}
              language="json"
              copyable
            />
          </section>
          <section class="raw-artifact-panel" aria-labelledby="variables-artifact-heading">
            <h3 id="variables-artifact-heading">Variables</h3>
            <CodeBlock
              code={jsonBlock(documentation.rawArtifacts.variables)}
              language="json"
              copyable
            />
          </section>
          <section class="raw-artifact-panel" aria-labelledby="constraints-artifact-heading">
            <h3 id="constraints-artifact-heading">Constraints</h3>
            <CodeBlock
              code={jsonBlock(documentation.rawArtifacts.constraints)}
              language="json"
              copyable
            />
          </section>
          <section class="raw-artifact-panel" aria-labelledby="examples-artifact-heading">
            <h3 id="examples-artifact-heading">Examples</h3>
            <CodeBlock
              code={jsonBlock(documentation.rawArtifacts.examples)}
              language="json"
              copyable
            />
          </section>
        </div>
      {/if}
    </TabPanel>
  </Tabs>
</div>

<style>
  .documentation-page {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-6);
    /* Pull to the body edges to cover the body's responsive padding, then
       restore the same gutter as the page's own padding so content is inset
       identically. This keeps body { background: --cinder-bg } intact for
       the theme-parity tests while the visible surface is --cinder-surface-raised. */
    margin: calc(-1 * clamp(var(--cinder-space-1), 2.5vw, var(--cinder-space-6)));
    padding: clamp(var(--cinder-space-1), 2.5vw, var(--cinder-space-6));
    min-height: 100vh;
    background: var(--cinder-surface-raised);
  }

  :global(.documentation-tabs-root) {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-6);
    min-height: 100%;
  }

  :global(.documentation-tabs) {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-2);
    overflow-x: auto;
    border-block-end: 1px solid var(--cinder-border);
    padding-block-end: var(--cinder-space-2);
  }

  :global(.documentation-panel) {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-6);
    min-width: 0;
    background: var(--cinder-surface-raised);
  }

  :global(.documentation-panel h2),
  :global(.documentation-panel h3),
  :global(.documentation-panel h4) {
    color: var(--cinder-text);
    font-weight: var(--cinder-font-semibold);
    margin: 0;
  }

  :global(.documentation-panel h2) {
    font-size: var(--cinder-text-xl);
  }

  :global(.documentation-panel h3) {
    font-size: var(--cinder-text-lg);
  }

  :global(.documentation-panel h4) {
    font-size: var(--cinder-text-base);
  }

  .documentation-skeleton {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-3);
  }

  .documentation-error {
    margin: 0;
  }

  .overview-hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(15rem, 22rem);
    gap: var(--cinder-space-8);
    align-items: start;
    padding-block-end: var(--cinder-space-6);
    border-block-end: 1px solid var(--cinder-border);
  }

  .overview-hero-main {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-4);
    min-width: 0;
  }

  .overview-hero h1 {
    margin: 0;
    color: var(--cinder-text);
    font-size: var(--cinder-text-2xl);
    font-weight: var(--cinder-font-semibold);
    line-height: var(--cinder-leading-tight);
  }

  .overview-purpose {
    margin: 0;
    color: var(--cinder-text-muted);
    font-size: var(--cinder-text-base);
    line-height: var(--cinder-leading-relaxed);
  }

  .overview-import {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--cinder-space-2);
    margin: 0;
    color: var(--cinder-text-subtle);
    font-size: var(--cinder-text-sm);
  }

  .overview-import span {
    font-weight: var(--cinder-font-medium);
  }

  .overview-import code {
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-sm);
    background: var(--cinder-surface-inset);
    color: var(--cinder-text);
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-sm);
    padding: var(--cinder-space-1) var(--cinder-space-2);
  }

  .overview-section {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-4);
    min-width: 0;
  }

  .section-heading-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--cinder-space-4);
  }

  .section-heading-row a,
  .example-link-list a,
  .featured-example-card,
  .related-links a {
    border-radius: var(--cinder-radius-sm);
    color: var(--cinder-link, var(--cinder-accent));
    text-decoration: none;
  }

  .section-heading-row a:hover,
  .example-link-list a:hover,
  .featured-example-card:hover,
  .related-links a:hover {
    text-decoration: underline;
  }

  .section-heading-row a:focus-visible,
  .example-link-list a:focus-visible,
  .featured-example-card:focus-visible,
  .related-links a:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: var(--_cinder-focus-ring-shadow);
  }

  .featured-example-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: var(--cinder-space-3);
  }

  .featured-example-card {
    border: 1px solid var(--cinder-border);
    background: var(--cinder-surface-raised);
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-2);
    padding: var(--cinder-space-4);
  }

  .featured-example-card span {
    color: var(--cinder-text);
    font-weight: var(--cinder-font-semibold);
  }

  .featured-example-card small {
    color: var(--cinder-text-muted);
    font-size: var(--cinder-text-sm);
    line-height: var(--cinder-leading-relaxed);
  }

  .example-link-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--cinder-space-2) var(--cinder-space-4);
    font-size: var(--cinder-text-sm);
  }

  .readme-content {
    color: var(--cinder-text);
    line-height: var(--cinder-leading-relaxed);
  }

  .readme-content :global(*) {
    max-width: 100%;
  }

  .readme-content :global(h1),
  .readme-content :global(h2),
  .readme-content :global(h3) {
    color: var(--cinder-text);
    font-weight: var(--cinder-font-semibold);
    line-height: var(--cinder-leading-tight);
    margin: var(--cinder-space-6) 0 var(--cinder-space-3);
  }

  .readme-content :global(h1:first-child),
  .readme-content :global(h2:first-child),
  .readme-content :global(h3:first-child) {
    margin-top: 0;
  }

  .readme-content :global(h1:first-child) {
    display: none;
  }

  .readme-content :global(h1) {
    font-size: var(--cinder-text-xl);
  }

  .readme-content :global(h2) {
    font-size: var(--cinder-text-lg);
  }

  .readme-content :global(h3) {
    font-size: var(--cinder-text-base);
  }

  .readme-content :global(p),
  .readme-content :global(ul),
  .readme-content :global(ol),
  .readme-content :global(table) {
    margin: 0 0 var(--cinder-space-4);
  }

  /* CodeBlock and its fallback get the same bottom-margin as prose elements
   * so code-to-paragraph transitions don't collapse. The fallback wrapper also
   * provides an overflow-x scroll container for wide pre blocks. */
  .readme-content :global(.cinder-code-block),
  .readme-pre-fallback {
    margin-block-end: var(--cinder-space-4);
  }

  .readme-pre-fallback {
    overflow-x: auto;
  }

  .readme-content :global(code) {
    font-family: var(--cinder-font-mono);
    font-size: 0.95em;
  }

  .readme-content :global(table) {
    overflow-x: auto;
  }

  .metadata-list {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-5);
    margin: 0;
  }

  .metadata-list div {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-2);
  }

  .metadata-list dt {
    color: var(--cinder-text-subtle);
    font-size: var(--cinder-text-xs);
    font-weight: var(--cinder-font-semibold);
    letter-spacing: 0;
    text-transform: uppercase;
  }

  .metadata-list dd {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--cinder-space-2);
    margin: 0;
    color: var(--cinder-text-muted);
    font-size: var(--cinder-text-sm);
    line-height: var(--cinder-leading-relaxed);
  }

  .metadata-list code,
  .related-links a,
  .variable-list code,
  .violates-label code {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-sm);
  }

  .badge-list,
  .related-links {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--cinder-space-2);
  }

  .guidance-grid,
  .constraint-example-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: var(--cinder-space-6);
  }

  .guidance-section,
  .schema-section,
  .raw-artifact-panel,
  .constraint-example {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-3);
    min-width: 0;
  }

  .guidance-section ul,
  .constraint-rules,
  .variable-list,
  .schema-property-list {
    margin: 0;
    padding-inline-start: var(--cinder-space-5);
  }

  .guidance-section li,
  .constraint-rules li,
  .variable-list li,
  .schema-property-list li {
    margin-block: var(--cinder-space-2);
    color: var(--cinder-text-muted);
  }

  .schema-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    gap: var(--cinder-space-3);
  }

  .schema-summary div {
    border-block-start: 1px solid var(--cinder-border);
    display: flex;
    justify-content: space-between;
    gap: var(--cinder-space-3);
    padding-block-start: var(--cinder-space-3);
  }

  .schema-summary span {
    color: var(--cinder-text-subtle);
    font-size: var(--cinder-text-sm);
  }

  .schema-summary strong {
    color: var(--cinder-text);
    font-size: var(--cinder-text-lg);
  }

  .schema-property-list {
    column-width: 12rem;
  }

  .schema-property-list li {
    break-inside: avoid;
  }

  .empty-state,
  .constraint-summary,
  .violates-label {
    margin: 0;
    color: var(--cinder-text-muted);
    font-size: var(--cinder-text-sm);
  }

  .constraint-rules {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-4);
  }

  .constraint-rule-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--cinder-space-2);
  }

  .constraint-rules p {
    margin: var(--cinder-space-2) 0 0;
  }

  .raw-artifact-grid {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-6);
  }

  .example-list {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-8);
  }

  .example-card-anchor {
    scroll-margin-block-start: var(--cinder-space-6);
  }

  .no-examples {
    color: var(--cinder-text-muted);
    font-style: italic;
    margin: 0;
  }

  .example-preview {
    /* Scale the inner preview gutter with the viewport so components aren't
       boxed into a sliver on narrow screens — matches the iframe body's
       responsive gutter. Floors at space-2 (8px) on phones; the body gutter is
       already near-zero there, so the component gets almost the full width. */
    padding: clamp(var(--cinder-space-2), 2vw, var(--cinder-space-6));
    min-height: 4rem;
    display: block;
    overflow: visible;
  }

  /* Scoped to .example-preview descendants so the helper can't leak into
     unrelated pages even though the inner selector is :global. */
  .example-preview :global(.example-preview-row) {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--cinder-space-4);
  }

  /* Column counterpart to -row: stacks example variants vertically. Same
     scoping rationale (:global inner selector, .example-preview anchor) so the
     helper stays confined to the preview surface. */
  .example-preview :global(.example-preview-column) {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--cinder-space-4);
  }

  .source-loading {
    margin: 0;
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text-subtle);
    font-style: italic;
  }

  /* --- Example error surfaces ------------------------------------------- */
  .example-error {
    padding: 0 var(--cinder-space-6) var(--cinder-space-6);
  }

  .example-error__message {
    margin: 0;
    font-weight: var(--cinder-font-medium);
  }

  .example-error__stack {
    margin: var(--cinder-space-3) 0 0;
    padding: var(--cinder-space-3);
    border-radius: var(--cinder-radius-sm);
    background: var(--cinder-surface-inset);
    color: var(--cinder-text-subtle);
    font-size: var(--cinder-text-xs);
    line-height: 1.5;
    white-space: pre-wrap;
    overflow-x: auto;
    max-height: 16rem;
  }

  .example-error__detail {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--cinder-space-1) var(--cinder-space-4);
    margin: 0;
    font-size: var(--cinder-text-sm);
  }

  .example-error__detail dt {
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-text-subtle);
  }

  .example-error__detail dd {
    margin: 0;
    word-break: break-word;
  }

  .example-error__actions {
    display: flex;
    gap: var(--cinder-space-2);
    margin-top: var(--cinder-space-4);
  }

  /* --- Props / API reference panel ------------------------------------- */
  .props-section {
    /* Establish a query container so the table responds to ITS OWN width (the
       preview pane), not the viewport — the iframe is resized by the toolbar
       independently of the device. */
    container: props-section / inline-size;
  }

  .props-heading {
    margin: 0 0 var(--cinder-space-4);
    font-size: var(--cinder-text-lg);
    font-weight: var(--cinder-font-semibold);
    color: var(--cinder-text);
  }

  /* The <h3> is the only visible heading. The <Table caption> stays in the DOM
     so the table keeps an accessible name, but is visually hidden to avoid a
     second, redundant "Props for <component>" heading. */
  .props-section :global(.cinder-table__caption) {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .props-skeleton {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-3);
    padding: var(--cinder-space-2) 0;
  }

  /* Wide container: a normal horizontally-scrollable table. */
  .props-table-scroll {
    overflow-x: auto;
    border-radius: var(--cinder-radius-sm);
  }

  .props-table-scroll:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: inset 0 0 0 var(--cinder-ring-width) var(--cinder-ring-color);
  }

  @media (forced-colors: active) {
    .props-table-scroll:focus-visible {
      outline: var(--cinder-ring-width) solid ButtonText;
      outline-offset: calc(var(--cinder-ring-width) * -1);
    }
  }

  .props-error,
  .props-empty {
    margin: 0;
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text-subtle);
    font-style: italic;
  }

  .props-name,
  .props-type,
  .props-default {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-sm);
  }

  .props-name {
    font-weight: var(--cinder-font-medium);
  }

  /* Union type: one member per line, no mid-token wrapping. Each member stays
     intact; the separator pipe is decorative (real `|` punctuation is read by
     screen readers from the cell text, so the visual one is aria-hidden). */
  .props-type {
    display: inline-flex;
    flex-direction: column;
    gap: var(--cinder-space-0-5, 0.125rem);
    align-items: flex-start;
  }

  .props-type__member {
    white-space: nowrap;
  }

  /* Hang the leading `|` of continuation lines in a small gutter so the member
     values line up vertically under each other. */
  .props-type--union .props-type__member {
    padding-inline-start: 1ch;
  }

  .props-type__sep {
    margin-inline-start: -1ch;
    color: var(--cinder-text-subtle);
  }

  /* Required indicator — the same 6px red gem cinder renders for required form
     fields (.cinder-form-field__required). Used both as the Name-column marker
     (where the leading margin separates it from the prop name) and in the
     centered Required column. It's decorative (aria-hidden); the "Required"
     meaning is carried by adjacent visually-hidden text / the column header. */
  .props-required-gem {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--cinder-danger);
    flex-shrink: 0;
    vertical-align: middle;
  }

  /* Only the Name-column gem trails the prop name and needs separating space;
     the centered Required column shows the gem alone, so no leading margin. */
  .props-name + .props-required-gem {
    margin-inline-start: var(--cinder-space-1);
  }

  /* Standard visually-hidden helper: keeps the "Required" label in the
     accessibility tree while only the gem is shown visually. */
  .props-visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .props-description {
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text-muted);
  }

  .props-dash {
    color: var(--cinder-text-subtle);
  }

  /*
   * Narrow container (a constrained preview pane): a 6-column table can't fit,
   * so stack each row into a labelled card. The column order is fixed (Name,
   * Type, Default, Required, Bindable, Description), so each cell's header label
   * is injected by nth-child via ::before — no per-cell attribute or change to
   * the cinder Table component is needed. Table semantics (and the SR-only
   * caption) stay intact; only `display` changes.
   */
  @container props-section (max-width: 34rem) {
    .props-table-scroll {
      overflow-x: visible;
    }

    .props-section :global(.cinder-table) {
      display: block;
      inline-size: 100%;
    }

    .props-section :global(.cinder-table thead) {
      /* Column headers are reproduced as per-cell ::before labels below, so the
         visual header row is hidden (kept in the a11y tree). */
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
    }

    .props-section :global(.cinder-table tbody),
    .props-section :global(.cinder-table tr) {
      display: block;
    }

    .props-section :global(.cinder-table tr) {
      padding-block: var(--cinder-space-3);
      border-block-end: 1px solid var(--cinder-border);
    }

    .props-section :global(.cinder-table td) {
      display: grid;
      grid-template-columns: minmax(4.5rem, max-content) 1fr;
      gap: var(--cinder-space-3);
      padding-block: var(--cinder-space-1);
      border: none;
      /* Reset the centered alignment from the Required/Bindable columns. */
      text-align: start;
    }

    .props-section :global(.cinder-table td)::before {
      font-weight: var(--cinder-font-medium);
      color: var(--cinder-text-subtle);
    }

    .props-section :global(.cinder-table td:nth-child(1))::before {
      content: 'Name';
    }
    .props-section :global(.cinder-table td:nth-child(2))::before {
      content: 'Type';
    }
    .props-section :global(.cinder-table td:nth-child(3))::before {
      content: 'Default';
    }
    .props-section :global(.cinder-table td:nth-child(4))::before {
      content: 'Required';
    }
    .props-section :global(.cinder-table td:nth-child(5))::before {
      content: 'Bindable';
    }
    .props-section :global(.cinder-table td:nth-child(6))::before {
      content: 'Description';
    }
  }

  @media (max-width: 46rem) {
    .overview-hero {
      grid-template-columns: 1fr;
      gap: var(--cinder-space-6);
    }

    .documentation-tab {
      padding-inline: var(--cinder-space-3);
    }
  }
</style>
