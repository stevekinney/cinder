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
  import { shikiHighlighter } from 'cinder/highlighters/shiki';
  import {
    formatErrorForClipboard,
    toMountErrorDetail,
    type MountErrorDetail,
    type SourceErrorDetail,
  } from './example-error.ts';
  import {
    fetchComponentManifest,
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

  // A page-scoped `shikiHighlighter` instance passed to the "View source"
  // CodeBlock below so its Svelte source renders highlighted with the
  // playground's `github-light` theme (rather than CodeBlock's bundled
  // default dual-theme). Use the bundled adapter so this file matches the
  // documented consumer pattern (lazy `import('shiki')` on first highlight,
  // shared fallback contract, warn-once behavior) instead of pulling Shiki
  // into the playground entry chunk via a top-level `codeToHtml` import.
  const highlighter = shikiHighlighter({ theme: 'github-light' });

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
  // Collapsed by default; the panel sits below the examples and opens on demand.
  let propsExpandedIds: string[] = $state([]);

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
              <CodeBlock code={source} language="svelte" {highlighter} copyable />
            {/if}
          </AccordionItem>
        </Accordion>
      </Card>
    {/if}
  {/each}
</div>

<!-- Props / API reference. Mirrors the source-accordion visual language:
       a Card wrapping an Accordion whose single item holds the props table.
       The wrapper div is owned by this file so its margin selector stays
       scoped (a class forwarded onto <Card> reads as unused here). -->
<div class="props-section">
  <Card title="Props">
    <Accordion bind:expandedIds={propsExpandedIds}>
      <AccordionItem id="props" title="API reference">
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
          <div class="props-table-scroll">
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
                      <code class="props-type">{prop.type}</code>
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
      </AccordionItem>
    </Accordion>
  </Card>
</div>

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
    padding: var(--cinder-space-6);
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

  .source-loading,
  .source-error {
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
  }

  .props-skeleton {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-3);
    padding: var(--cinder-space-2) 0;
  }

  /* The props table has six columns; the Type and Description columns can hold
     long union strings. <Card> sets overflow: hidden, so give the table its own
     horizontal scroll container to avoid clipping at narrow preview widths. */
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
</style>
