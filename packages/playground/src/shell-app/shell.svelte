<script lang="ts">
  import { onMount } from 'svelte';

  import PreviewFrame from './preview-frame.svelte';
  import {
    applyThemeToDocument,
    PreviewStore,
    readPersistedTheme,
    setPreviewStore,
  } from './preview-store.svelte.ts';
  import { buildShellHref, parseComponentFromPath } from './routing.ts';
  import Sidebar from './sidebar.svelte';
  import TopBar from './top-bar.svelte';

  type Props = {
    initialComponent: string;
    components: string[];
  };

  let { initialComponent, components }: Props = $props();

  const initialTheme = typeof window === 'undefined' ? 'system' : readPersistedTheme();
  const store = new PreviewStore(initialComponent, initialTheme);
  setPreviewStore(store);

  // Apply the persisted theme to the shell's root document on first paint.
  // The inline pre-paint script in render-shell.ts already did this before
  // the bundle loaded, but reapplying here keeps the state machine simple
  // (the inline script is a perf optimization, not a correctness gate).
  if (typeof document !== 'undefined') applyThemeToDocument(document, store.theme);

  let copiedFlash = $state<boolean>(false);

  function copyLink(): void {
    void navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        copiedFlash = true;
        setTimeout(() => {
          copiedFlash = false;
        }, 1500);
      })
      .catch((error: unknown) => {
        console.error('[cinder playground] copy failed:', error);
      });
  }

  function selectComponent(name: string): void {
    if (name === store.currentComponent) return;
    store.currentComponent = name;
    history.pushState({}, '', buildShellHref(name));
  }

  onMount(() => {
    function handlePopState(): void {
      const parsed = parseComponentFromPath(window.location.pathname);
      if (parsed !== null) store.currentComponent = parsed;
    }
    window.addEventListener('popstate', handlePopState);

    function handleEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape' && store.isFocusMode) {
        store.isFocusMode = false;
      }
    }
    window.addEventListener('keydown', handleEscape);

    const events = new EventSource('/events');
    events.addEventListener('reload', () => {
      const iframe = document.querySelector<HTMLIFrameElement>('iframe[data-cinder-preview]');
      iframe?.contentWindow?.location.reload();
    });
    events.addEventListener('shell-reload', () => {
      window.location.reload();
    });

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleEscape);
      events.close();
    };
  });
</script>

<div class="shell" class:focus-mode={store.isFocusMode}>
  <Sidebar {components} currentComponent={store.currentComponent} onSelect={selectComponent} />
  <main>
    <TopBar onCopyLink={copyLink} {copiedFlash} />
    <PreviewFrame componentName={store.currentComponent} />
  </main>
</div>

<style>
  .shell {
    display: flex;
    height: 100vh;
    font-family: var(--cinder-font-sans);
    font-size: var(--cinder-text-base);
    background: var(--cinder-bg);
    color: var(--cinder-text);
  }

  main {
    margin-inline-start: 220px;
    flex: 1;
    height: 100vh;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .shell.focus-mode :global(nav[aria-label='Components']) {
    display: none;
  }

  .shell.focus-mode :global(header.top-bar) {
    display: none;
  }

  .shell.focus-mode main {
    margin-inline-start: 0;
  }
</style>
