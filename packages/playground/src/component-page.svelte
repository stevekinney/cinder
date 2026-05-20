<!-- dev-only playground scaffold; window.__CINDER_EXAMPLES__ is injected server-side -->
<script lang="ts">
  import { mount, unmount } from 'svelte';
  import Accordion from '../../components/src/components/accordion/index.ts';
  import AccordionItem from '../../components/src/components/accordion-item/index.ts';
  import Card from '../../components/src/components/card/index.ts';
  import CodeBlock from '../../components/src/components/code-block/index.ts';

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
    loadingSource[scenario] = true;
    try {
      const response = await fetch(`/example-src/${componentName}/${scenario}`);
      fetchedSource[scenario] = response.ok ? await response.text() : null;
    } catch {
      fetchedSource[scenario] = null;
    } finally {
      loadingSource[scenario] = false;
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
    let cancelled = false;

    const registry =
      ((window as unknown as Record<string, unknown>)['__CINDER_SCENARIOS__'] as
        | Record<string, unknown>
        | undefined) ?? {};

    for (const { scenario } of examples) {
      const containerId = `example-mount-${scenario}`;

      // Defer to a microtask so the DOM element rendered by the template is
      // guaranteed to exist before we try to mount into it.
      queueMicrotask(() => {
        if (cancelled) return;
        const container = document.getElementById(containerId);
        if (!container) return;

        const Component = registry[scenario];
        if (typeof Component !== 'function') {
          console.error(`[cinder playground] no registered component for scenario "${scenario}"`);
          return;
        }

        try {
          const app = mount(Component as Parameters<typeof mount>[0], { target: container });
          localApps.push(app);
        } catch (error) {
          console.error(`[cinder playground] failed to mount example "${scenario}":`, error);
        }
      });
    }

    return () => {
      cancelled = true;
      for (const app of localApps) {
        try {
          unmount(app);
        } catch {
          // Suppress — best-effort cleanup only.
        }
      }
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
    {#if accordionEntry}
      <Card {title} {...description !== undefined ? { description } : {}}>
        <div class="example-preview" id="example-mount-{scenario}"></div>
        <Accordion bind:expandedIds={accordionEntry.expandedIds}>
          <AccordionItem id="source" title="View source">
            {#if loadingSource[scenario]}
              <p class="source-loading">Loading…</p>
            {:else if source === null}
              <p class="source-error">Could not load source.</p>
            {:else if source !== undefined}
              <CodeBlock code={source} language="svelte" copyable />
            {/if}
          </AccordionItem>
        </Accordion>
      </Card>
    {/if}
  {/each}
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
</style>
