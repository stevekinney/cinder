<script lang="ts">
  import { onMount } from 'svelte';

  import { getPreviewStore } from './preview-store.svelte.ts';
  import { buildIframeSrc, createPreviewMessage } from './routing.ts';

  type Props = {
    componentName: string;
  };

  let { componentName }: Props = $props();

  const store = getPreviewStore();

  let iframeEl = $state<HTMLIFrameElement | null>(null);

  let src = $derived(buildIframeSrc(componentName));

  /**
   * Send a validated message to the iframe with an explicit target origin.
   * Never uses '*' — the message goes only to the page we control.
   */
  function postToFrame(type: 'cinder:set-theme' | 'cinder:set-background', value: string): void {
    const win = iframeEl?.contentWindow;
    if (!win) return;
    let message;
    if (type === 'cinder:set-theme') {
      message = createPreviewMessage(type, value as 'light' | 'dark' | 'system');
    } else {
      message = createPreviewMessage(type, value as 'surface' | 'inverse' | 'checker');
    }
    if (message === null) return;
    win.postMessage(message, window.location.origin);
  }

  // Reactive: theme/background changes push to the iframe immediately.
  $effect(() => {
    postToFrame('cinder:set-theme', store.theme);
  });
  $effect(() => {
    postToFrame('cinder:set-background', store.background);
  });

  function handleLoad(): void {
    // Replay the current theme + background after a fresh iframe load. The
    // iframe's inline pre-paint script already reads localStorage for theme,
    // but background is session-only and lives in the shell — we need to
    // sync it after each navigation/reload.
    postToFrame('cinder:set-theme', store.theme);
    postToFrame('cinder:set-background', store.background);
  }

  onMount(() => {
    if (iframeEl) iframeEl.addEventListener('load', handleLoad);
    return () => {
      iframeEl?.removeEventListener('load', handleLoad);
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
    overflow: auto;
    background: #f5f5f5;
  }

  .preview-frame-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  iframe {
    flex: 1;
    width: 100%;
    border: none;
    background: #fff;
    display: block;
  }

  .placeholder {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #888;
  }

  .placeholder p {
    font-size: 16px;
    margin: 0;
  }
</style>
