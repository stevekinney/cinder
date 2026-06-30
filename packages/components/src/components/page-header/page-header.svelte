<script lang="ts" module>
  /**
   * @cinder
   * @category layout
   * @status stable
   * @purpose Page-level heading row that pairs a required title with optional metadata and optional trailing actions.
   * @tag page
   * @tag heading
   * @tag layout
   * @useWhen Rendering a route-level heading that needs consistent spacing and border treatment across pages.
   * @useWhen Showing high-level page metadata (counts or state summaries) beside a title with optional right-aligned controls.
   * @avoidWhen Rendering section-scoped headings within page content — use section-heading.
   * @avoidWhen Building complex hero layouts with rich copy and media — use hero-section.
   * @related section-heading, hero-section
   */
  export type { PageHeaderProps } from './page-header.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import type { PageHeaderProps } from './page-header.types.ts';

  let { title, meta, class: className, children, ...rest }: PageHeaderProps = $props();
</script>

<div class={classNames('cinder-page-header', className)} {...rest}>
  <div class="cinder-page-header__heading-group">
    <h1 class="cinder-page-header__title">{title}</h1>
    {#if meta}
      <p class="cinder-page-header__meta">{meta}</p>
    {/if}
  </div>

  {#if children}
    <div class="cinder-page-header__actions">
      {@render children()}
    </div>
  {/if}
</div>
