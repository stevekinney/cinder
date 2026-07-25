<script lang="ts">
  import type { ComponentDocumentationPayload } from '../component-documentation-types.ts';
  import { toPropReferenceRows } from '../manifest-reference.ts';
  import PreviewFrame, { type PreviewFrameHandle } from './preview-frame.svelte';

  type Props = {
    componentName: string;
    documentation: ComponentDocumentationPayload;
  };

  let { componentName, documentation }: Props = $props();
  let previewFrame = $state<PreviewFrameHandle | null>(null);

  const propRows = $derived(toPropReferenceRows(documentation.propsManifest));
  const importStatement = $derived(
    `import { ${documentation.component.exportName} } from '${documentation.component.importSpecifier}';`,
  );

  export function reloadPreview(): void {
    previewFrame?.reload();
  }
</script>

<article class="documentation" data-canonical-documentation>
  <header class="hero">
    <p class="eyebrow">{documentation.component.categoryLabel}</p>
    <h1>{documentation.component.name}</h1>
    <p class="purpose">{documentation.component.purpose}</p>
    <code>{importStatement}</code>
    <a class="full-documentation-link" href="/page/{componentName}">
      Open interactive documentation
    </a>
  </header>

  <section class="preview-section" aria-labelledby="preview-heading">
    <h2 id="preview-heading">Live preview</h2>
    <div class="preview">
      <PreviewFrame bind:this={previewFrame} {componentName} previewOnly />
    </div>
  </section>

  <section aria-labelledby="overview-heading">
    <h2 id="overview-heading">Overview</h2>
    <div class="readme-content cinder-markdown-content">{@html documentation.readme.html}</div>
  </section>

  {#if propRows.length > 0}
    <section aria-labelledby="props-heading">
      <h2 id="props-heading">Props</h2>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Type</th>
              <th scope="col">Default</th>
              <th scope="col">Description</th>
            </tr>
          </thead>
          <tbody>
            {#each propRows as row (row.name)}
              <tr>
                <th scope="row"><code>{row.name}</code></th>
                <td><code>{row.type}</code></td>
                <td><code>{row.defaultValue ?? '—'}</code></td>
                <td>{row.description}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/if}
</article>

<style>
  .documentation {
    width: min(100%, 1120px);
    margin: 0 auto;
    padding: var(--cinder-space-8);
  }

  .hero,
  section {
    margin-block-end: var(--cinder-space-10);
  }

  .eyebrow {
    color: var(--cinder-text-muted);
    font-size: var(--cinder-text-sm);
    font-weight: var(--cinder-font-semibold);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1 {
    margin-block: var(--cinder-space-2);
    font-size: clamp(2rem, 5vw, 4rem);
    line-height: 1;
  }

  h2 {
    margin-block-end: var(--cinder-space-4);
    font-size: var(--cinder-text-2xl);
  }

  .purpose {
    max-width: 70ch;
    margin-block-end: var(--cinder-space-4);
    color: var(--cinder-text-muted);
    font-size: var(--cinder-text-lg);
  }

  .hero > code {
    display: inline-block;
    padding: var(--cinder-space-2) var(--cinder-space-3);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-md);
    background: var(--cinder-surface);
  }

  .full-documentation-link {
    display: block;
    width: fit-content;
    margin-block-start: var(--cinder-space-4);
    color: var(--cinder-accent);
    font-weight: var(--cinder-font-semibold);
  }

  .preview {
    display: flex;
    height: 360px;
    overflow: hidden;
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-lg);
    background: var(--cinder-bg);
  }

  .readme-content {
    max-width: 80ch;
  }

  .table-scroll {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    text-align: start;
  }

  :global(.shell.focus-mode) .documentation {
    width: 100%;
    max-width: none;
    height: 100%;
    padding: 0;
  }

  :global(.shell.focus-mode) .documentation > :not(.preview-section) {
    display: none;
  }

  :global(.shell.focus-mode) .preview-section {
    display: flex;
    height: 100%;
    margin: 0;
    flex-direction: column;
  }

  :global(.shell.focus-mode) .preview-section > h2 {
    display: none;
  }

  :global(.shell.focus-mode) .preview {
    flex: 1;
    height: auto;
    border: 0;
    border-radius: 0;
  }

  th,
  td {
    padding: var(--cinder-space-3);
    border-block-end: 1px solid var(--cinder-border);
    vertical-align: top;
  }

  thead th {
    color: var(--cinder-text-muted);
    font-size: var(--cinder-text-sm);
  }

  @media (max-width: 720px) {
    .documentation {
      padding: var(--cinder-space-5);
    }
  }
</style>
