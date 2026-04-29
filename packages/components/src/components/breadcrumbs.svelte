<script lang="ts" module>
  import type { Snippet } from 'svelte';

  /**
   * One breadcrumb entry. The current page entry omits `href` so it renders
   * as plain text with `aria-current="page"`.
   */
  export type BreadcrumbItem = {
    /** Visible label for the entry. */
    label: string;
    /** Link target. Omit for the current page (last entry). */
    href?: string;
  };

  export type BreadcrumbsProps = {
    /** Ordered list of breadcrumb entries from root to current page. */
    items: BreadcrumbItem[];
    /** Custom separator between entries. Defaults to "/". */
    separator?: Snippet | string;
    /** Accessible name for the nav landmark. Defaults to "Breadcrumb". */
    label?: string;
    /** Additional class names merged with `.cinder-breadcrumbs`. */
    class?: string;
  };
</script>

<script lang="ts">
  import { cn } from '../utilities/class-names.ts';

  let {
    items,
    separator = '/',
    label = 'Breadcrumb',
    class: className,
  }: BreadcrumbsProps = $props();
</script>

<nav class={cn('cinder-breadcrumbs', className)} aria-label={label}>
  <ol class="cinder-breadcrumbs__list">
    {#each items as item, index (index)}
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
