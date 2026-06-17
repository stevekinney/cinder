<script lang="ts" module>
  /**
   * Imperative handle a parent obtains via `bind:this`, so a live-reload event
   * reloads the iframe *through* this component (which re-arms the loading
   * overlay) rather than poking `iframe.contentWindow.location.reload()`
   * directly — a direct reload keeps the same `src`, so the overlay would never
   * show during hot reload.
   */
  export type PreviewFrameHandle = { reload(): void };
</script>

<script lang="ts">
  // Import the two components from their per-component modules rather than the
  // monolithic `components/src/index.ts` barrel: the barrel re-exports every
  // component (including review-editor, which pulls in the commentary
  // subpaths), and dragging that whole graph into this leaf both bloats the
  // bundle and makes the component impossible to mount in a `--conditions
  // browser` test. These narrow paths bring in only what we render.
  import { EmptyState } from '../../../components/src/components/empty-state/index.ts';
  import { Spinner } from '../../../components/src/components/spinner/index.ts';
  import { getPreviewStore, type ThemeChoice } from './preview-store.svelte.ts';
  import type { ColorTokenOverrides } from './color-token-registry.ts';
  import { buildIframeSrc, createPreviewMessage, type PreviewMessage } from './routing.ts';

  type Props = {
    componentName: string;
  };

  let { componentName }: Props = $props();

  const store = getPreviewStore();

  let iframeEl = $state<HTMLIFrameElement | null>(null);
  let lastSyncedTheme: ThemeChoice | null = null;

  let src = $derived(buildIframeSrc(componentName));

  // The src whose document has finished painting, set in `handleLoad`. Loading
  // is then a pure derivation: we're loading whenever the current `src` hasn't
  // been confirmed loaded yet. This is declarative — no `$effect` copying one
  // piece of state into another. On navigation `src` changes, `loadedSrc` lags
  // behind until the new document fires `load`, so the overlay covers the
  // blank white frame for the 1–5s gap with no manual re-arming.
  let loadedSrc = $state<string | null>(null);
  const loading = $derived(src !== loadedSrc);

  /**
   * Send a typed message to the iframe with an explicit target origin.
   * Never uses '*' — the message goes only to the page we control. The
   * message must come from `createPreviewMessage` so its shape and value
   * have already been validated against the protocol allowlist.
   */
  function postToFrame(message: PreviewMessage): void {
    const win = iframeEl?.contentWindow;
    if (!win) return;
    win.postMessage(message, window.location.origin);
  }

  function syncTheme(theme: ThemeChoice = store.theme): void {
    const message = createPreviewMessage('cinder:set-theme', theme);
    if (message !== null) postToFrame(message);
  }

  function syncColorTokenOverrides(theme: ThemeChoice, overrides: ColorTokenOverrides): void {
    const message = createPreviewMessage('cinder:set-color-token-overrides', {
      theme,
      overrides: { ...overrides } as Record<string, string>,
    });
    if (message !== null) postToFrame(message);
  }

  // Reactive: active-theme color-token changes push to the iframe immediately.
  // Theme messages only post when the resolved theme actually changes, avoiding
  // redundant postMessages during continuous color-picker drags while still
  // sending theme before overrides on a real theme change.
  $effect(() => {
    const theme = store.theme;
    const overrides = store.colorTokenOverrides[theme];
    if (lastSyncedTheme !== theme) {
      syncTheme(theme);
      lastSyncedTheme = theme;
    }
    syncColorTokenOverrides(theme, overrides);
  });

  function handleLoad(): void {
    // The new document has painted — mark this src loaded so `loading` derives
    // to false and the overlay lifts.
    loadedSrc = src;
    // Replay the current theme after a fresh iframe load. The iframe's inline
    // pre-paint script reads localStorage for theme, but a shell-driven choice
    // (e.g. light/dark toggled this session) must be re-pushed after each
    // navigation/reload.
    const theme = store.theme;
    syncTheme(theme);
    lastSyncedTheme = theme;
    syncColorTokenOverrides(theme, store.colorTokenOverrides[theme]);
  }

  /**
   * Reload the iframe's current document (used by SSE live reload). Clearing
   * `loadedSrc` re-arms the loading overlay even though `src` is unchanged, so
   * a hot reload shows the same feedback as a navigation; `handleLoad` clears it
   * again once the reloaded document paints.
   */
  export function reload(): void {
    const win = iframeEl?.contentWindow;
    if (!win) return;
    loadedSrc = null;
    win.location.reload();
  }

  // The iframe lives inside {#if componentName}, so its DOM element is
  // destroyed and recreated when the user selects their first component (or
  // any subsequent transition between placeholder and iframe). Use $effect
  // tracking iframeEl so the load listener re-attaches on every remount.
  $effect(() => {
    const element = iframeEl;
    if (element === null) return;
    element.addEventListener('load', handleLoad);
    return () => {
      element.removeEventListener('load', handleLoad);
    };
  });

  let wrapperStyle = $derived(
    store.previewWidth === null
      ? ''
      : `width: ${store.previewWidth}px; max-width: 100%; margin: 0 auto;`,
  );

  // Text for the persistent live region. It announces "Loading preview" while
  // the frame paints and "Preview ready" once it settles. The region itself
  // stays mounted at all times — a sibling of the iframe wrapper, never inside
  // the {#if loading} overlay — so the transition to "ready" is actually
  // announced. A live region that is removed from the DOM when loading clears
  // can never fire that update.
  let statusMessage = $derived(loading ? 'Loading preview' : 'Preview ready');
</script>

<div class="preview-host">
  {#if componentName}
    <!-- aria-busy mirrors `loading`: WCAG 4.1.3 signal that this region is
         temporarily unavailable. Keyboard/screen-reader users who land on the
         iframe area learn it is busy rather than silently unresponsive. -->
    <div class="preview-frame-wrapper" style={wrapperStyle} aria-busy={loading}>
      <iframe
        bind:this={iframeEl}
        {src}
        title="{componentName} preview"
        class={['preview-iframe', { 'is-loading': loading }]}
        data-cinder-preview
      ></iframe>
      {#if loading}
        <!-- Visual-only overlay. The Spinner renders its own role="status", so
             we hide it from assistive tech (aria-hidden) to avoid a second,
             competing announcement — the persistent live region (a sibling of
             this wrapper, below) owns the spoken status. -->
        <div
          class="preview-loading-overlay"
          data-testid="preview-loading-overlay"
          aria-hidden="true"
        >
          <Spinner label="Loading preview" />
        </div>
      {/if}
    </div>
    <!-- Persistent live region: always mounted, text swaps with `loading`.
         Because it never leaves the DOM, the "Preview ready" update actually
         announces when the frame settles.

         It lives OUTSIDE `.preview-frame-wrapper` (a sibling here at the
         `.preview-host` level) on purpose: the wrapper carries
         `aria-busy={loading}`, and per the ARIA spec some screen readers
         (notably NVDA + Firefox) suppress or defer announcing live-region
         updates nested inside an `aria-busy="true"` container. Hoisting the
         region out of that container guarantees the "Preview ready" update is
         spoken rather than silently dropped. -->
    <span class="sr-only" role="status" aria-live="polite" aria-atomic="true">{statusMessage}</span>
  {:else}
    <EmptyState
      title="No component selected"
      description="Select a component from the sidebar to preview it."
    />
  {/if}
</div>

<style>
  .preview-host {
    flex: 1;
    display: flex;
    flex-direction: column;
    /* Don't let the host scroll itself — the iframe owns its own scrolling.
       This also keeps the iframe's height stable when previewWidth narrows
       the wrapper. */
    overflow: hidden;
    background: var(--cinder-bg);
    min-height: 0;
  }

  .preview-frame-wrapper {
    /* Definite height seed for the column-direction parent so the iframe
       (flex: 1) inside us has a non-zero height to grow into. Without this,
       constraining width via inline style would let the wrapper collapse
       vertically in some browsers. */
    flex: 1 1 0;
    min-height: 0;
    height: 100%;
    display: flex;
    flex-direction: column;
    /* Positioning context for the absolutely-placed loading overlay. */
    position: relative;
  }

  iframe {
    flex: 1;
    width: 100%;
    height: 100%;
    border: none;
    background: var(--cinder-surface);
    display: block;
    min-height: 0;
  }

  .preview-loading-overlay {
    /* Cover the iframe exactly — no layout shift, the iframe keeps its box. */
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--cinder-surface);
    /* Sit above the iframe while it paints. */
    z-index: 1;
  }

  /* Visually-hidden but readable by assistive tech — same recipe as the live
     region in `top-bar.svelte`. Keeps the status announcement off-screen
     without removing it from the accessibility tree. */
  .sr-only {
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

  /* The iframe fades from the overlay-covered loading state to the painted
     document. Only animate when the user hasn't asked to reduce motion;
     otherwise the swap is instantaneous. */
  @media (prefers-reduced-motion: no-preference) {
    .preview-iframe {
      transition: opacity 0.2s ease;
    }

    .preview-iframe.is-loading {
      opacity: 0;
    }
  }
</style>
