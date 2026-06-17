<script lang="ts">
  import { Button } from '../../../components/src/index.ts';

  type Props = {
    readmeHtml: string;
    firstComponent: string;
    onBrowseComponent: (componentName: string) => void | Promise<void>;
  };

  let { readmeHtml, firstComponent, onBrowseComponent }: Props = $props();

  function isPlainLeftClick(event: MouseEvent): boolean {
    if (event.button !== 0) return false;
    return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
  }

  function handleBrowseClick(event: MouseEvent): void {
    if (firstComponent === '' || !isPlainLeftClick(event)) return;
    event.preventDefault();
    void onBrowseComponent(firstComponent);
  }
</script>

<section class="landing-page" aria-labelledby="landing-title">
  <div class="landing-page__hero">
    <p class="landing-page__eyebrow">Cinder Playground</p>
    <h1 id="landing-title">Svelte 5 components for product interfaces</h1>
    <p>
      Browse runnable examples, inspect component contracts, and use the README as the starting
      point for installing and shipping Cinder.
    </p>
    {#if firstComponent !== ''}
      <Button
        href="/c/{firstComponent}"
        variant="primary"
        label="Browse components"
        onclick={handleBrowseClick}
      />
    {/if}
  </div>

  <article class="landing-page__readme" aria-label="Cinder README">
    {@html readmeHtml}
  </article>
</section>

<style>
  .landing-page {
    width: 100%;
    min-height: 100%;
    overflow-y: auto;
    background: var(--cinder-bg);
  }

  .landing-page__hero,
  .landing-page__readme {
    width: min(100% - 2rem, 920px);
    margin-inline: auto;
  }

  .landing-page__hero {
    display: grid;
    gap: var(--cinder-space-4);
    padding-block: clamp(var(--cinder-space-8), 8vw, var(--cinder-space-16)) var(--cinder-space-8);
  }

  .landing-page__eyebrow {
    color: var(--cinder-text-muted);
    font-size: var(--cinder-text-sm);
    font-weight: var(--cinder-font-weight-medium);
    text-transform: uppercase;
  }

  .landing-page__hero h1 {
    max-width: 14ch;
    color: var(--cinder-text);
    font-size: clamp(2.25rem, 6vw, 4.75rem);
    line-height: 0.95;
  }

  .landing-page__hero p:not(.landing-page__eyebrow) {
    max-width: 42rem;
    color: var(--cinder-text-muted);
    font-size: var(--cinder-text-lg);
    line-height: var(--cinder-leading-relaxed);
  }

  .landing-page__readme {
    padding-block: 0 var(--cinder-space-12);
    color: var(--cinder-text);
  }

  .landing-page__readme :global(h1) {
    display: none;
  }

  .landing-page__readme :global(h2) {
    margin-block: var(--cinder-space-8) var(--cinder-space-3);
    padding-block-start: var(--cinder-space-6);
    border-top: 1px solid var(--cinder-border);
    color: var(--cinder-text);
    font-size: var(--cinder-text-2xl);
    line-height: var(--cinder-leading-tight);
  }

  .landing-page__readme :global(h3) {
    margin-block: var(--cinder-space-6) var(--cinder-space-2);
    color: var(--cinder-text);
    font-size: var(--cinder-text-xl);
  }

  .landing-page__readme :global(p),
  .landing-page__readme :global(li) {
    color: var(--cinder-text-muted);
    line-height: var(--cinder-leading-relaxed);
  }

  .landing-page__readme :global(p),
  .landing-page__readme :global(ul),
  .landing-page__readme :global(ol),
  .landing-page__readme :global(pre),
  .landing-page__readme :global(table) {
    margin-block: var(--cinder-space-4);
  }

  .landing-page__readme :global(ul),
  .landing-page__readme :global(ol) {
    padding-inline-start: var(--cinder-space-6);
  }

  .landing-page__readme :global(a) {
    color: var(--cinder-accent-text);
    text-underline-offset: 0.2em;
  }

  .landing-page__readme :global(code) {
    border-radius: var(--cinder-radius-sm);
    background: var(--cinder-surface-inset);
    color: var(--cinder-text);
    font-size: 0.92em;
  }

  .landing-page__readme :global(:not(pre) > code) {
    padding: 0.1rem 0.3rem;
  }

  .landing-page__readme :global(pre) {
    overflow-x: auto;
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-md);
    background: var(--cinder-surface);
    padding: var(--cinder-space-4);
  }

  .landing-page__readme :global(table) {
    width: 100%;
    border-collapse: collapse;
    display: block;
    overflow-x: auto;
  }

  .landing-page__readme :global(th),
  .landing-page__readme :global(td) {
    border-bottom: 1px solid var(--cinder-border);
    padding: var(--cinder-space-2) var(--cinder-space-3);
    text-align: start;
    white-space: nowrap;
  }

  .landing-page__readme :global(th) {
    color: var(--cinder-text);
    font-weight: var(--cinder-font-weight-semibold);
  }

  @media (max-width: 720px) {
    .landing-page__hero,
    .landing-page__readme {
      width: min(100% - 1rem, 920px);
    }
  }
</style>
