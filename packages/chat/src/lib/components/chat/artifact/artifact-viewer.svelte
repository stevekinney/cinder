<script lang="ts" module>
  /**
   * Wrap SVG content in a minimal HTML document for sandboxed iframe rendering.
   * This is the safe approach: the SVG runs in a sandboxed origin rather than
   * the page's origin, so JavaScript (even if injected) cannot access the DOM
   * or credentials of the parent page.
   */
  function wrapSvgInHtml(svg: string): string {
    return `<!DOCTYPE html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;">${svg}</body></html>`;
  }
</script>

<script lang="ts">
  import type { ArtifactViewerProps } from './artifact-viewer.types.ts';

  let { type, content, language, title, mermaidRenderer }: ArtifactViewerProps = $props();

  const svgDocument = $derived(type === 'svg' ? wrapSvgInHtml(content) : '');
</script>

{#if type === 'html'}
  <iframe
    class="artifact-viewer artifact-viewer-html"
    srcdoc={content}
    sandbox=""
    title={title ?? 'HTML artifact'}
    aria-label={title ?? 'HTML artifact'}
  ></iframe>
{:else if type === 'svg'}
  <iframe
    class="artifact-viewer artifact-viewer-svg"
    srcdoc={svgDocument}
    sandbox=""
    title={title ?? 'SVG artifact'}
    aria-label={title ?? 'SVG artifact'}
  ></iframe>
{:else if type === 'code'}
  <div class="artifact-viewer artifact-viewer-code">
    <pre class="artifact-code-block" data-language={language}><code>{content}</code></pre>
  </div>
{:else if type === 'mermaid'}
  <div class="artifact-viewer artifact-viewer-mermaid">
    {#if mermaidRenderer}
      {@render mermaidRenderer(content, 'mermaid')}
    {:else}
      <pre class="artifact-code-block" data-language="mermaid"><code>{content}</code></pre>
      <p class="artifact-mermaid-note" aria-live="polite">
        No Mermaid renderer was provided. Showing diagram source.
      </p>
    {/if}
  </div>
{/if}

<style>
  .artifact-viewer {
    width: 100%;
    height: 100%;
    display: block;
  }

  /* HTML iframe */
  .artifact-viewer-html {
    border: none;
    min-height: 200px;
  }

  /* SVG sandboxed iframe */
  .artifact-viewer-svg {
    border: none;
    min-height: 200px;
  }

  /* Code and Mermaid */
  .artifact-viewer-code,
  .artifact-viewer-mermaid {
    height: auto;
    padding: var(--cinder-space-4);
  }

  .artifact-code-block {
    margin: 0;
    padding: var(--cinder-space-4);
    background: var(--cinder-surface-raised);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-md);
    overflow-x: auto;
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-sm);
    line-height: var(--leading-relaxed);
    color: var(--cinder-text);
    white-space: pre;
  }

  .artifact-code-block code {
    font-family: inherit;
    font-size: inherit;
    background: none;
    padding: 0;
  }

  .artifact-mermaid-note {
    margin-top: var(--cinder-space-3);
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-muted);
    font-style: italic;
  }
</style>
