<!-- dev-only playground scaffold; window.__CINDER_EXAMPLES__ is injected server-side -->
<script lang="ts">
  import { mount, unmount } from 'svelte';

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

  // Track which <details> elements have had their source fetched so we only
  // hit /example-src once per scenario regardless of how many times the user
  // opens and closes the disclosure.
  const fetchedSource: Record<string, string | null> = $state({});
  const loadingSource: Record<string, boolean> = $state({});

  async function handleDetailsToggle(event: Event, scenario: string): Promise<void> {
    const details = event.currentTarget as HTMLDetailsElement;

    if (!details.open) return;
    if (fetchedSource[scenario] !== undefined) return;

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

  // Mount each example bundle into its target element. The server compiles each
  // .example.svelte into its own bundle at /bundle/<name>/<scenario>.js (separate
  // from the component-page bundle itself). We dynamically import them so the
  // component-page doesn't need to know the module graph at compile time.
  $effect(() => {
    // Per-run local collection so the cleanup only unmounts this run's mounts.
    // Svelte 5 disposal is unmount(component), not component.destroy().
    const localApps: ReturnType<typeof mount>[] = [];
    let cancelled = false;

    for (const { scenario } of examples) {
      const containerId = `example-mount-${scenario}`;

      // Use a microtask so the DOM element rendered by the template is
      // guaranteed to exist before we try to mount into it.
      queueMicrotask(async () => {
        if (cancelled) return;
        const container = document.getElementById(containerId);
        if (!container) return;

        try {
          const module = await import(`/bundle/${componentName}/${scenario}.js`);
          if (cancelled) return;
          const Component = module.default;
          if (typeof Component !== 'function') return;

          const app = mount(Component, { target: container });
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
    <section class="example-card">
      <header class="example-card-header">
        <h2 class="example-title">{title}</h2>
        {#if description}
          <p class="example-description">{description}</p>
        {/if}
      </header>

      <div class="example-preview" id="example-mount-{scenario}"></div>

      <details class="example-source" ontoggle={(event) => handleDetailsToggle(event, scenario)}>
        <summary class="example-source-toggle">View source</summary>

        <div class="example-source-body">
          {#if loadingSource[scenario]}
            <p class="source-loading">Loading…</p>
          {:else if fetchedSource[scenario] === null}
            <p class="source-error">Could not load source.</p>
          {:else if fetchedSource[scenario] !== undefined}
            <pre class="source-code"><code>{fetchedSource[scenario]}</code></pre>
          {/if}
        </div>
      </details>
    </section>
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

  .example-card {
    background-color: var(--cinder-surface);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-lg);
    overflow: hidden;
  }

  .example-card-header {
    padding: var(--cinder-space-4) var(--cinder-space-6);
    border-bottom: 1px solid var(--cinder-border-muted);
  }

  .example-title {
    margin: 0 0 var(--cinder-space-1) 0;
    font-size: var(--cinder-text-lg);
    font-weight: var(--cinder-font-semibold);
    line-height: var(--cinder-leading-snug);
    color: var(--cinder-text);
  }

  .example-description {
    margin: 0;
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text-muted);
    line-height: var(--cinder-leading-normal);
  }

  .example-preview {
    padding: var(--cinder-space-6);
    min-height: 4rem;
    display: flex;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: var(--cinder-space-4);
  }

  .example-source {
    border-top: 1px solid var(--cinder-border-muted);
  }

  .example-source-toggle {
    display: block;
    padding: var(--cinder-space-2) var(--cinder-space-6);
    font-size: var(--cinder-text-sm);
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-text-subtle);
    cursor: pointer;
    user-select: none;
    transition: color var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  .example-source-toggle:hover {
    color: var(--cinder-text);
  }

  .example-source-body {
    padding: 0 var(--cinder-space-6) var(--cinder-space-4);
  }

  .source-loading,
  .source-error {
    margin: 0;
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text-subtle);
    font-style: italic;
  }

  .source-code {
    margin: 0;
    padding: var(--cinder-space-4);
    background-color: var(--cinder-surface-inset);
    border: 1px solid var(--cinder-border-muted);
    border-radius: var(--cinder-radius-md);
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-xs);
    line-height: var(--cinder-leading-relaxed);
    color: var(--cinder-text);
    overflow-x: auto;
    white-space: pre;
    tab-size: 2;
  }
</style>
