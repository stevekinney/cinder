<script lang="ts">
  import type { PreviewView } from './markdown-editor-preview.svelte.ts';

  let { id, view }: { id: string; view: PreviewView } = $props();

  let regionElement = $state<HTMLElement | null>(null);

  const heading = $derived(
    view.status === 'loading'
      ? 'Loading preview'
      : view.filled || !view.template
        ? 'Preview'
        : 'Unfilled template preview',
  );

  /** Move focus to the region, for a user-triggered switch to preview. */
  export function focus(): void {
    regionElement?.focus();
  }
</script>

<!-- Server rendering and the first hydration pass both render the loading
     state; the sanitized HTML replaces it after client mount. -->
<section
  bind:this={regionElement}
  id={`${id}-preview`}
  class="markdown-editor-preview"
  aria-labelledby={`${id}-preview-label`}
  aria-busy={view.status === 'loading' || undefined}
  tabindex="-1"
>
  <p id={`${id}-preview-label`} class="markdown-editor-preview-label">{heading}</p>
  {#if view.status === 'loading'}
    <div class="markdown-editor-preview-loading" inert></div>
  {:else}
    <div class="cinder-markdown-content markdown-editor-preview-content">
      {@html view.html}
    </div>
  {/if}
</section>

<style>
  .markdown-editor-preview {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--cinder-space-2);
    min-height: var(--editor-min-height, 200px);
    padding: var(--cinder-space-5);
    overflow: auto;
    outline: none;
  }

  .markdown-editor-preview:focus-visible {
    box-shadow: inset 0 0 0 var(--cinder-ring-width) var(--cinder-ring-color);
  }

  @media (forced-colors: active) {
    .markdown-editor-preview:focus-visible {
      outline: var(--cinder-ring-width) solid ButtonText;
      outline-offset: calc(var(--cinder-ring-width) * -1);
    }
  }

  .markdown-editor-preview-label {
    margin: 0;
    color: var(--cinder-text-muted);
    font-size: var(--cinder-text-sm);
  }

  .markdown-editor-preview-loading {
    flex: 1;
  }
</style>
