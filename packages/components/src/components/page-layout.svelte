<script lang="ts" module>
  import type { Snippet } from 'svelte';

  /**
   * Title input. A plain TypeScript union narrowed via `typeof title === 'string'`.
   *
   * - `string`: page-layout renders `<h1 class="cinder-page-layout-title">` itself.
   * - `Snippet`: the snippet fully owns the heading element. Consumers MUST render
   *   an `<h1>` inside the snippet.
   */
  export type PageLayoutTitle = string | Snippet;

  export type PageLayoutProps = {
    /** Page title. String renders inside `.cinder-page-layout-title` <h1>; Snippet owns its own heading. */
    title: PageLayoutTitle;
    /** Additional class names merged onto the root element. */
    class?: string;
    /** Optional breadcrumb row rendered above the title row. */
    breadcrumbs?: Snippet;
    /** Optional avatar rendered inline-start of the title. */
    avatar?: Snippet;
    /** Optional metadata rendered beneath the title. Intended for a `<dl>` of role/date/location. */
    meta?: Snippet;
    /** Optional action cluster rendered at the flex-end of the title row. */
    actions?: Snippet;
    /** Main page content. */
    children: Snippet;
  };
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';

  let {
    title,
    class: className,
    breadcrumbs,
    avatar,
    meta,
    actions,
    children,
  }: PageLayoutProps = $props();
</script>

<div class={classNames('cinder-page-layout', className)}>
  <header class="cinder-page-layout-header">
    {#if breadcrumbs}
      <div class="cinder-page-layout-breadcrumbs">
        {@render breadcrumbs()}
      </div>
    {/if}

    <div class="cinder-page-layout-header-row">
      {#if avatar}
        <div class="cinder-page-layout-avatar">
          {@render avatar()}
        </div>
      {/if}

      <div class="cinder-page-layout-title-column">
        {#if typeof title === 'string'}
          <h1 class="cinder-page-layout-title">{title}</h1>
        {:else}
          {@render title()}
        {/if}

        {#if meta}
          <div class="cinder-page-layout-meta">
            {@render meta()}
          </div>
        {/if}
      </div>

      {#if actions}
        <div class="cinder-page-layout-actions">
          {@render actions()}
        </div>
      {/if}
    </div>
  </header>

  <div class="cinder-page-layout-content">
    {@render children()}
  </div>
</div>
