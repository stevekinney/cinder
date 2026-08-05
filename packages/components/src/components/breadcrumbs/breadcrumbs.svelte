<script lang="ts" module>
  /**
   * @cinder
   * @category navigation
   * @status stable
   * @purpose Hierarchical wayfinding trail showing the ancestor path of the current page with the final entry marked as aria-current.
   * @tag navigation
   * @tag wayfinding
   * @useWhen Surfacing where the user sits inside a deep, nested hierarchy.
   * @useWhen Letting the user jump back to any ancestor view in one click.
   * @avoidWhen Switching between sibling sections at the same level — use navigation-bar or tabs.
   * @avoidWhen Showing an ordered task progression — use steps instead.
   * @related navigation-bar, side-navigation, steps
   */
  export type { BreadcrumbItem, BreadcrumbsProps } from './breadcrumbs.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import type { BreadcrumbsProps } from './breadcrumbs.types.ts';

  let {
    items,
    separator = '/',
    label = 'Breadcrumb',
    class: className,
  }: BreadcrumbsProps = $props();
</script>

<nav class={classNames('cinder-breadcrumbs', className)} aria-label={label}>
  <ol class="cinder-breadcrumbs__list">
    <!--
      Key precedence: `href` (the actual link target) when present, since it's the
      closest thing to a stable identity a breadcrumb has. `href` is omitted only
      for the current-page entry per BreadcrumbItem's doc comment, so the
      `${item.label}-${index}` fallback covers that one case per render; it also
      guards against a consumer building a list with more than one href-less
      entry (unsupported, but the fallback still avoids a duplicate key).
    -->
    {#each items as item, index (item.href ?? `${item.label}-${index}`)}
      {@const isLast = index === items.length - 1}
      <li class="cinder-breadcrumbs__item">
        {#if isLast}
          <!-- Current page: rendered as plain text, not a link. -->
          <span aria-current="page" class="cinder-breadcrumbs__current">{item.label}</span>
        {:else}
          <a class="cinder-breadcrumbs__link" href={item.href}>{item.label}</a>
          <span class="cinder-breadcrumbs__separator" aria-hidden="true">
            {#if typeof separator === 'string'}
              {separator}
            {:else}
              {@render separator()}
            {/if}
          </span>
        {/if}
      </li>
    {/each}
  </ol>
</nav>
