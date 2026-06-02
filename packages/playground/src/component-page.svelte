<!-- dev-only playground scaffold; window.__CINDER_EXAMPLES__ is injected server-side -->
<script lang="ts">
  import { mount, unmount } from 'svelte';
  import { Accordion } from 'cinder/accordion';
  import { AccordionItem } from 'cinder/accordion-item';
  import { Badge } from 'cinder/badge';
  import { Button } from 'cinder/button';
  import { Callout } from 'cinder/callout';
  import { Card } from 'cinder/card';
  import { CodeBlock } from 'cinder/code-block';
  import { Skeleton } from 'cinder/skeleton';
  import { Table } from 'cinder/table';
  import {
    formatErrorForClipboard,
    toMountErrorDetail,
    type MountErrorDetail,
    type SourceErrorDetail,
  } from './example-error.ts';
  import {
    fetchComponentManifest,
    splitUnionType,
    toPropReferenceRows,
    type PropReferenceRow,
  } from './manifest-reference.ts';

  type CinderExampleDescriptor = { scenario: string; title: string; description?: string };
  type CinderWindow = Window &
    typeof globalThis & { __CINDER_EXAMPLES__?: CinderExampleDescriptor[] };

  // The server injects window.__CINDER_EXAMPLES__ before the bundle script tag.
  // Fall back to an empty array so the component doesn't crash if the global is missing.
  function readExamples(): CinderExampleDescriptor[] {
    if (typeof window === 'undefined') return [];
    const raw = (window as CinderWindow).__CINDER_EXAMPLES__;
    return Array.isArray(raw) ? raw : [];
  }

  const examples: CinderExampleDescriptor[] = readExamples();

  // Extract the component name from the current URL path: /page/<name>
  const componentName: string =
    window.location.pathname.replace(/^\/page\//, '').split('/')[0] ?? '';

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

  // --- Props / API reference panel ---------------------------------------
  // The component name is fixed for the lifetime of this page (it comes from
  // the URL once), so the manifest is fetched exactly once at init rather than
  // through a reactive effect. Three pieces of $state drive the panel: the
  // normalized rows, a loading flag, and an error message.
  let propRows: PropReferenceRow[] = $state([]);
  let propsLoading = $state(true);
  let propsError: string | null = $state(null);

  // The skeleton placeholder rows give the table a stable shape while the
  // request is in flight.
  const skeletonRowCount = 5;

  // Fetch the props manifest once. componentName is non-reactive, so this effect
  // runs exactly once. A one-shot async fetch whose result lands in $state is
  // exactly what $effect is for — the cancellation flag prevents writing to
  // state after the component is torn down mid-flight (e.g. fast navigation in
  // tests), which a floating async IIFE could not guard against.
  $effect(() => {
    if (componentName === '') {
      propsLoading = false;
      return;
    }
    let cancelled = false;
    fetchComponentManifest(componentName)
      .then((manifest) => {
        if (!cancelled) propRows = toPropReferenceRows(manifest);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          propsError = error instanceof Error ? error.message : 'Failed to load props.';
        }
      })
      .finally(() => {
        if (!cancelled) propsLoading = false;
      });
    return () => {
      cancelled = true;
    };
  });
</script>

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
      <Card {title} {...description !== undefined ? { description } : {}}>
        <div class="example-preview" id="example-mount-{scenario}"></div>

        {#if mountError !== undefined}
          <div class="example-error">
            <Callout variant="danger" title="This example failed to render">
              <p class="example-error__message">{mountError.message}</p>
              {#if mountError.stack !== undefined}
                <pre class="example-error__stack" aria-label="Stack trace">{mountError.stack}</pre>
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
                      <code>{sourceError?.url ?? `/example-src/${componentName}/${scenario}`}</code>
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
              <!-- No explicit highlighter: CodeBlock's bundled default is
                   dual-theme (github-light / github-dark) and swaps on the
                   iframe's [data-cinder-theme] signal, so source stays readable
                   in dark mode. -->
              <CodeBlock code={source} language="svelte" copyable />
            {/if}
          </AccordionItem>
        </Accordion>
      </Card>
    {/if}
  {/each}
</div>

<!-- Props / API reference. Rendered inline and always-expanded: the props
       table is the reference users come here for, so it sits open as a plain
       titled section rather than buried inside a collapsed Card→Accordion. The
       wrapper <section> is owned by this file so its scoped selectors apply. -->
<!-- Heading level is h3 to match the example Card titles (cinder Card renders
     its title as <h3>), keeping the iframe document's heading outline ordered
     rather than inverting to a higher level after the example cards. -->
<section class="props-section" aria-labelledby="props-heading">
  <h3 id="props-heading" class="props-heading">API reference</h3>
  {#if propsLoading}
    <div class="props-skeleton" aria-hidden="true">
      {#each Array.from({ length: skeletonRowCount }, (_, index) => index) as row (row)}
        <Skeleton height="1.5rem" radius="var(--cinder-radius-sm)" />
      {/each}
    </div>
  {:else if propsError !== null}
    <p class="props-error">Could not load props: {propsError}</p>
  {:else if propRows.length === 0}
    <p class="props-empty">This component has no documented props.</p>
  {:else}
    <!-- tabindex="0" makes the scrollable region keyboard-accessible (axe
         scrollable-region-focusable / WCAG 2.1.1) — at narrow widths the wide
         props table can overflow horizontally and must be reachable by keyboard. -->
    <div class="props-table-scroll" tabindex="0">
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
                  <span class="props-required-marker" aria-hidden="true">*</span>
                {/if}
              </Table.Cell>
              <Table.Cell>
                <!-- Render a union type as one member per line (split at the
                     top-level ` | ` only) so long unions read as a clean list
                     instead of wrapping mid-token. Members after the first carry
                     a leading `|` so the union reading stays clear; a non-union
                     type is a single line with no separator. -->
                {@const typeMembers = splitUnionType(prop.type)}
                <code class="props-type" class:props-type--union={typeMembers.length > 1}>
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
                  <Badge variant="danger" size="xs">Required</Badge>
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

<style>
  .example-list {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-8);
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
    margin-top: var(--cinder-space-8);
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

  .props-required-marker {
    margin-inline-start: var(--cinder-space-1);
    color: var(--cinder-color-danger-fg);
    font-weight: var(--cinder-font-semibold);
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
</style>
