<script lang="ts" module>
  /**
   * @cinder
   * @category layout
   * @status stable
   * @purpose Page-level heading with named title, description, breadcrumb, and action regions.
   * @tag page
   * @tag heading
   * @tag layout
   * @useWhen Rendering a route-level heading that needs consistent spacing and border treatment across pages.
   * @useWhen Pairing page context and supporting copy with optional right-aligned controls.
   * @avoidWhen Rendering section-scoped headings within page content — use section-heading.
   * @avoidWhen Building complex hero layouts with rich copy and media — compose container (see its hero-section example).
   * @related section-heading, container
   */
  export type { PageHeaderHeadingLevel, PageHeaderProps } from './page-header.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import type { PageHeaderProps } from './page-header.types.ts';

  let {
    title,
    headingLevel = 1,
    description,
    breadcrumbs,
    actions,
    class: className,
    ...rest
  }: PageHeaderProps = $props();

  // Clamp to 1–6 so an out-of-range value from an untyped caller (JS, schema-driven usage)
  // never builds <h0>/<hNaN>. Matches Card's heading clamp.
  const resolvedHeadingLevel = $derived(
    Number.isFinite(Math.trunc(Number(headingLevel)))
      ? Math.min(6, Math.max(1, Math.trunc(Number(headingLevel))))
      : 1,
  );
  const titleTag = $derived(`h${resolvedHeadingLevel}` as const);
</script>

<div class={classNames('cinder-page-header', className)} {...rest}>
  {#if breadcrumbs}
    <div class="cinder-page-header__breadcrumbs">
      {@render breadcrumbs()}
    </div>
  {/if}

  <div class="cinder-page-header__row">
    <div class="cinder-page-header__heading-group">
      <svelte:element this={titleTag} class="cinder-page-header__title">
        {#if typeof title === 'string'}
          {title}
        {:else}
          {@render title()}
        {/if}
      </svelte:element>
      {#if description}
        <p class="cinder-page-header__description">
          {#if typeof description === 'string'}
            {description}
          {:else}
            {@render description()}
          {/if}
        </p>
      {/if}
    </div>

    {#if actions}
      <div class="cinder-page-header__actions">
        {@render actions()}
      </div>
    {/if}
  </div>
</div>
