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
    <h1 id="landing-title">cinder</h1>
    <p>
      Components for product interfaces. Browse runnable examples, inspect component contracts, and
      use the README as the starting point for installing and shipping Cinder.
    </p>
    {#if firstComponent !== ''}
      <div class="landing-page__actions">
        <Button
          href={`/c/${firstComponent}`}
          variant="primary"
          label="Browse components"
          onclick={handleBrowseClick}
        />
      </div>
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
    width: min(100% - 2rem, var(--cinder-content-width));
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
    font-weight: var(--cinder-font-medium);
    text-transform: uppercase;
  }

  .landing-page__hero h1 {
    color: var(--cinder-text);
    font-size: 8rem;
    letter-spacing: 0;
    line-height: 0.95;
  }

  .landing-page__hero p:not(.landing-page__eyebrow) {
    max-width: 42rem;
    color: var(--cinder-text-muted);
    font-size: var(--cinder-text-lg);
    line-height: var(--cinder-leading-relaxed);
  }

  .landing-page__actions {
    display: flex;
    align-items: center;
  }

  .landing-page__actions :global(.cinder-button) {
    width: max-content;
  }

  .landing-page__readme {
    --surface-inset: var(--cinder-surface-inset);
    --text: var(--cinder-text);
    --syntax-comment: var(--cinder-text-subtle);
    --syntax-string: light-dark(oklch(38% 0.12 150), oklch(82% 0.12 150));
    --syntax-keyword: light-dark(oklch(48% 0.19 285), oklch(76% 0.14 285));
    --syntax-function: light-dark(oklch(42% 0.13 250), oklch(78% 0.11 250));
    --syntax-variable: light-dark(oklch(36% 0.07 245), oklch(88% 0.04 245));
    --syntax-type: light-dark(oklch(42% 0.13 210), oklch(78% 0.12 210));
    --syntax-number: light-dark(oklch(45% 0.16 45), oklch(82% 0.12 60));
    --syntax-operator: var(--cinder-text-muted);
    --syntax-constant: light-dark(oklch(45% 0.17 25), oklch(80% 0.13 30));
    --syntax-property: light-dark(oklch(40% 0.13 230), oklch(78% 0.11 230));
    --syntax-tag: light-dark(oklch(45% 0.18 330), oklch(78% 0.14 330));
    --syntax-attribute: light-dark(oklch(43% 0.14 260), oklch(80% 0.11 260));
    --syntax-regex: light-dark(oklch(43% 0.15 120), oklch(80% 0.12 120));
    --syntax-inserted: light-dark(oklch(42% 0.14 145), oklch(78% 0.13 145));
    --syntax-deleted: light-dark(oklch(47% 0.18 25), oklch(78% 0.14 25));

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
    background: var(--cinder-surface-inset);
    padding: var(--cinder-space-4);
  }

  .landing-page__readme :global(pre code) {
    background: transparent;
    color: inherit;
  }

  .landing-page__readme :global(table) {
    width: 100%;
    border-collapse: collapse;
    display: table;
  }

  .landing-page__readme :global(th),
  .landing-page__readme :global(td) {
    border-bottom: 1px solid var(--cinder-border);
    padding: var(--cinder-space-2) var(--cinder-space-3);
    text-align: start;
    vertical-align: top;
  }

  .landing-page__readme :global(th:first-child),
  .landing-page__readme :global(td:first-child) {
    white-space: nowrap;
  }

  .landing-page__readme :global(th) {
    color: var(--cinder-text);
    font-weight: var(--cinder-font-semibold);
  }

  @media (min-width: 1200px) {
    .landing-page__hero h1 {
      font-size: 12rem;
    }
  }

  @media (max-width: 720px) {
    .landing-page__hero,
    .landing-page__readme {
      width: min(100% - 1rem, var(--cinder-content-width));
    }

    .landing-page__hero h1 {
      font-size: 4.5rem;
    }
  }
</style>
