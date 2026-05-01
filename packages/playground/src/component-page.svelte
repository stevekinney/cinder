<!-- dev-only playground scaffold; window.__CINDER_EXAMPLES__ is injected server-side -->
<script lang="ts">
  import { mount, unmount } from 'svelte';

  import { defaultForControl } from './controls.ts';
  import type { ComponentManifest, PropManifest } from './types.ts';

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

  // Manifest and controls state
  let manifest: ComponentManifest | null = $state(null);

  // Control values keyed by prop name. Populated from manifest on load.
  const controlValues: Record<string, unknown> = $state({});

  // Track changes for window.__CINDER_CONTROLS__ sync.
  const controlsKey: string = $derived(JSON.stringify(controlValues));

  // Fetch the manifest for this component on mount.
  $effect(() => {
    if (!componentName) return;
    fetch(`/api/manifest/${componentName}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: ComponentManifest | null) => {
        if (data === null) return;
        manifest = data;
        // Seed control values from manifest defaults.
        for (const prop of data.props) {
          if (prop.control.kind === 'snippet') continue;
          if (prop.control.kind === 'unknown') continue;
          const defaultValue =
            prop.defaultValue !== undefined ? prop.defaultValue : defaultForControl(prop.control);
          controlValues[prop.name] = defaultValue;
        }
        // Expose to the mounted example bundles.
        (window as unknown as Record<string, unknown>)['__CINDER_CONTROLS__'] = controlValues;
      })
      .catch(() => {
        // Manifest fetch failed — controls panel will be empty. Not fatal.
      });
  });

  // Sync __CINDER_CONTROLS__ and notify mounted wrapper bundles on every control change.
  // Wrappers listen to 'cinder:controls-updated' and re-read props reactively — no remount needed.
  $effect(() => {
    void controlsKey; // subscribe to changes
    (window as unknown as Record<string, unknown>)['__CINDER_CONTROLS__'] = controlValues;
    window.dispatchEvent(new CustomEvent('cinder:controls-updated'));
  });

  // Controllable props — exclude snippets and unknown kinds for rendering.
  const controllableProps: PropManifest[] = $derived.by(() => {
    if (manifest === null) return [];
    return manifest.props.filter(
      (prop: PropManifest) => prop.control.kind !== 'snippet' && prop.control.kind !== 'unknown',
    );
  });

  // Try-it is shown whenever there's anything to control. The wrapper-generator
  // synthesises filler defaults for required snippets and unknown-typed props
  // (e.g. accordion's `children`, button's `label`) so the preview still
  // renders even when those props can't be exposed in the controls panel.
  const showTryIt: boolean = $derived(controllableProps.length > 0);

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

  // Mount the controls-driven "Try it" wrapper. The wrapper is bundled into
  // the same page bundle as this component (exposed on
  // `window.__CINDER_TRY_IT__`) so it shares a Svelte runtime with the host
  // — a separate dynamically-imported bundle would hit `effect_orphan` when
  // its component-init effects ran in a different runtime tree.
  //
  // The wrapper listens for `cinder:controls-updated` and re-reads
  // `window.__CINDER_CONTROLS__`, so the panel below the preview drives this
  // single live instance.
  $effect(() => {
    if (!showTryIt) return;

    let cancelled = false;
    let mounted: ReturnType<typeof mount> | null = null;

    queueMicrotask(() => {
      if (cancelled) return;
      const Wrapper = (window as unknown as Record<string, unknown>)['__CINDER_TRY_IT__'];
      if (typeof Wrapper !== 'function') return;

      const target = document.getElementById('try-it-mount');
      if (!target) return;

      try {
        mounted = mount(Wrapper as Parameters<typeof mount>[0], { target });
      } catch (error) {
        console.error(
          `[cinder playground] failed to mount Try-it wrapper for "${componentName}":`,
          error,
        );
      }
    });

    return () => {
      cancelled = true;
      if (mounted !== null) {
        try {
          unmount(mounted);
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

  {#if showTryIt}
    <section class="example-card example-card--try-it">
      <header class="example-card-header">
        <h2 class="example-title">Try it</h2>
        <p class="example-description">
          Adjust the controls to see how each prop changes the rendered component.
        </p>
      </header>

      <div class="example-layout">
        <div class="example-preview" id="try-it-mount"></div>

        <div class="controls-panel">
          {#each controllableProps as prop (prop.name)}
            <div class={['control-row', prop.control.kind === 'boolean' && 'control-row--inline']}>
              <label class="control-label" for="control-tryit-{prop.name}">
                {prop.name}
              </label>

              {#if prop.control.kind === 'boolean'}
                <input
                  id="control-tryit-{prop.name}"
                  class="control-checkbox"
                  type="checkbox"
                  checked={Boolean(controlValues[prop.name])}
                  onchange={(event) => {
                    controlValues[prop.name] = (event.currentTarget as HTMLInputElement).checked;
                  }}
                />
              {:else if prop.control.kind === 'number'}
                <input
                  id="control-tryit-{prop.name}"
                  class="control-input"
                  type="number"
                  value={Number(controlValues[prop.name] ?? 0)}
                  oninput={(event) => {
                    controlValues[prop.name] = Number(
                      (event.currentTarget as HTMLInputElement).value,
                    );
                  }}
                />
              {:else if prop.control.kind === 'text'}
                <input
                  id="control-tryit-{prop.name}"
                  class="control-input"
                  type="text"
                  value={String(controlValues[prop.name] ?? '')}
                  oninput={(event) => {
                    controlValues[prop.name] = (event.currentTarget as HTMLInputElement).value;
                  }}
                />
              {:else if prop.control.kind === 'select'}
                <select
                  id="control-tryit-{prop.name}"
                  class="control-input"
                  value={String(controlValues[prop.name] ?? '')}
                  onchange={(event) => {
                    controlValues[prop.name] = (event.currentTarget as HTMLSelectElement).value;
                  }}
                >
                  {#each prop.control.options as option (option)}
                    <option value={option}>{option}</option>
                  {/each}
                </select>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </section>
  {/if}

  {#each examples as { scenario, title, description } (scenario)}
    <section class="example-card">
      <header class="example-card-header">
        <h2 class="example-title">{title}</h2>
        {#if description}
          <p class="example-description">{description}</p>
        {/if}
      </header>

      <div class="example-layout">
        <div class="example-preview" id="example-mount-{scenario}"></div>
      </div>

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

  .example-layout {
    display: block;
  }

  /* When the layout includes a controls panel ("Try it" card), switch to a
     two-column grid so the panel sits beside the preview. Static scenarios
     without controls render as a single column. */
  .example-layout:has(.controls-panel) {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--cinder-space-4);
  }

  .example-preview {
    padding: var(--cinder-space-6);
    min-height: 4rem;
    display: block;
  }

  /* Scoped to .example-preview descendants so the helper can't leak into
     unrelated pages even though the inner selector is :global. */
  .example-preview :global(.example-preview-row) {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--cinder-space-4);
  }

  .controls-panel {
    width: 220px;
    min-width: 180px;
    border-left: 1px solid var(--cinder-border-muted);
    padding: var(--cinder-space-4);
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-3);
  }

  .control-row {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-1);
  }

  /* Boolean controls put the label and checkbox on the same row — a small
     checkbox on the right of a normal-cased label reads like a real form
     control, not a stretched-empty-square. */
  .control-row--inline {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: var(--cinder-space-2);
  }

  .control-label {
    font-size: var(--cinder-text-xs);
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-text-subtle);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .control-row--inline .control-label {
    text-transform: none;
    letter-spacing: 0;
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text);
  }

  .control-input {
    font-size: var(--cinder-text-sm);
    padding: var(--cinder-space-1) var(--cinder-space-2);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-sm);
    background: var(--cinder-surface);
    color: var(--cinder-text);
    width: 100%;
  }

  /* Checkbox sized like a normal form control rather than stretched to fill. */
  .control-checkbox {
    width: 1rem;
    height: 1rem;
    margin: 0;
    cursor: pointer;
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
