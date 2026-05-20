<script lang="ts" module>
  /**
   * @cinder
   * @category layout
   * @status stable
   * @purpose Opinionated page scaffold combining a breadcrumb row, title, optional avatar and metadata, primary actions, and a body slot.
   * @tag layout
   * @tag scaffold
   * @useWhen Standing up a record or detail page that needs the standard cinder header treatment.
   * @useWhen Keeping page titles, actions, and breadcrumbs visually consistent across an application.
   * @avoidWhen Building an unstructured marketing or landing page — compose surface and primitives directly.
   * @avoidWhen Rendering inside a sidebar or modal — its spacing assumes a full page width.
   * @related surface, sidebar
   */
  export type { PageLayoutProps, PageLayoutTitle } from './page-layout.types.ts';
</script>

<script lang="ts">
  import type { PageLayoutProps } from './page-layout.types.ts';
  import { classNames } from '../../utilities/class-names.ts';

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

  {#if breadcrumbs}
    <div class="cinder-page-layout-breadcrumbs">
      {@render breadcrumbs()}
    </div>
  {/if}

  <div class="cinder-page-layout-content">
    {@render children()}
  </div>
</div>
