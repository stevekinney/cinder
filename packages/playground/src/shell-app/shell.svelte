<script lang="ts">
  import { createEventSource } from './event-source.svelte.ts';
  import PreviewFrame from './preview-frame.svelte';
  import {
    applyThemeToDocument,
    PreviewStore,
    readPersistedTheme,
    setPreviewStore,
  } from './preview-store.svelte.ts';
  import { buildShellHref, parseComponentFromPath, readToolbarStateFromSearch } from './routing.ts';
  import Sidebar from './sidebar.svelte';
  import TopBar from './top-bar.svelte';

  type Props = {
    initialComponent: string;
    components: string[];
  };

  let { initialComponent, components }: Props = $props();

  // Seed the toolbar from the URL (shareable, survives reload). When the URL
  // is silent about theme, fall back to the localStorage preference so the
  // next visit honors the user's last choice.
  const initialSearch =
    typeof window === 'undefined'
      ? new URLSearchParams()
      : new URL(window.location.href).searchParams;
  const initialUrlState = readToolbarStateFromSearch(initialSearch);
  const initialTheme = initialUrlState.theme ?? readPersistedTheme();
  const store = new PreviewStore(initialComponent, {
    ...initialUrlState,
    theme: initialTheme,
  });
  setPreviewStore(store);

  // Apply the persisted theme to the shell's root document on first paint.
  // The inline pre-paint script in render-shell.ts already did this before
  // the bundle loaded, but reapplying here keeps the state machine simple
  // (the inline script is a perf optimization, not a correctness gate).
  if (typeof document !== 'undefined') applyThemeToDocument(document, store.theme);

  function selectComponent(name: string): void {
    if (name === store.currentComponent) return;
    store.currentComponent = name;
    // Preserve the current query string (e.g. ?focus=1) and hash when
    // navigating between components.
    const { search, hash } = window.location;
    history.pushState({}, '', `${buildShellHref(name)}${search}${hash}`);
  }

  function handlePopState(): void {
    const parsed = parseComponentFromPath(window.location.pathname);
    if (parsed !== null) store.currentComponent = parsed;
    store.syncFromUrl();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && store.isFocusMode) {
      store.isFocusMode = false;
    }
  }

  // The dev server exposes a server-sent-events stream at `/events` for live
  // reload. In SSR (no window), keep the URL null so the EventSource is never
  // constructed.
  const streamUrl = typeof window === 'undefined' ? null : '/events';

  function handleReloadEvent(): void {
    const iframe = document.querySelector<HTMLIFrameElement>('iframe[data-cinder-preview]');
    iframe?.contentWindow?.location.reload();
  }

  function handleShellReloadEvent(): void {
    window.location.reload();
  }
</script>

<svelte:window onpopstate={handlePopState} onkeydown={handleKeydown} />

<!--
  Layout overview
  ───────────────
  The top bar is fixed and spans the full viewport width. It owns the
  --cinder-top-bar-height custom property (52px). Both the sidebar and
  the main content area push their top edge down by that amount so nothing
  slides behind the bar.

  Focus mode hides both the top bar and the sidebar so the preview fills
  the entire viewport (Escape restores the layout).
-->
<div
  class="shell"
  class:focus-mode={store.isFocusMode}
  {@attach createEventSource(() => streamUrl, {
    events: { reload: handleReloadEvent, 'shell-reload': handleShellReloadEvent },
  })}
>
  <TopBar />
  <Sidebar {components} currentComponent={store.currentComponent} onSelect={selectComponent} />
  <main>
    <PreviewFrame componentName={store.currentComponent} />
  </main>
</div>

<style>
  /*
   * --cinder-top-bar-height is declared on the .top-bar element inside
   * TopBar. Inherit it here for layout math. If the value ever changes we
   * only need to update the token in one place (top-bar.svelte).
   */
  .shell {
    /* Provide a fallback so the shell still lays out correctly if the
       TopBar custom property hasn't resolved yet. */
    --cinder-top-bar-height: 52px;

    display: flex;
    height: 100vh;
    font-family: var(--cinder-font-sans);
    font-size: var(--cinder-text-base);
    background: var(--cinder-bg);
    color: var(--cinder-text);
  }

  main {
    /*
     * The sidebar is physically anchored at left: 0 with a fixed width of
     * 220px. Push main content past both the sidebar and the fixed top bar.
     * Physical margin-left keeps in sync with the sidebar's physical left
     * anchor — do not convert to logical margin-inline-start.
     */
    /* stylelint-disable-next-line csstools/use-logical */
    margin-left: 220px;
    margin-top: var(--cinder-top-bar-height);
    flex: 1;
    height: calc(100vh - var(--cinder-top-bar-height));
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  /* Focus mode: collapse both the fixed top bar and the sidebar */
  .shell.focus-mode :global(header.top-bar) {
    display: none;
  }

  .shell.focus-mode :global(nav[aria-label='Components']) {
    display: none;
  }

  .shell.focus-mode main {
    /* stylelint-disable-next-line csstools/use-logical */
    margin-left: 0;
    margin-top: 0;
    height: 100vh;
  }
</style>
