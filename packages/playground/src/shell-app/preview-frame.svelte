<script lang="ts">
  import { getPreviewStore } from './preview-store.svelte.ts';
  import { buildIframeSrc, createPreviewMessage, type PreviewMessage } from './routing.ts';

  type Props = {
    componentName: string;
  };

  let { componentName }: Props = $props();

  const store = getPreviewStore();

  let iframeEl = $state<HTMLIFrameElement | null>(null);

  let src = $derived(buildIframeSrc(componentName));

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

  function syncTheme(): void {
    const message = createPreviewMessage('cinder:set-theme', store.theme);
    if (message !== null) postToFrame(message);
  }

  function syncBackground(): void {
    const message = createPreviewMessage('cinder:set-background', store.background);
    if (message !== null) postToFrame(message);
  }

  // Reactive: theme/background changes push to the iframe immediately.
  $effect(() => {
    syncTheme();
  });
  $effect(() => {
    syncBackground();
  });

  function handleLoad(): void {
    // Replay the current theme + background after a fresh iframe load. The
    // iframe's inline pre-paint script already reads localStorage for theme,
    // but background is session-only and lives in the shell — we need to
    // sync it after each navigation/reload.
    syncTheme();
    syncBackground();
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
</script>

<div class="preview-host">
  {#if componentName}
    <div class="preview-frame-wrapper" style={wrapperStyle}>
      <iframe bind:this={iframeEl} {src} title="{componentName} preview" data-cinder-preview
      ></iframe>
    </div>
  {:else}
    <div class="placeholder">
      <p>Select a component from the sidebar to preview it.</p>
    </div>
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

  .placeholder {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--cinder-text-subtle);
  }

  .placeholder p {
    font-size: 16px;
    margin: 0;
  }
</style>
