<script lang="ts" module>
  export type { BreadcrumbItem, BreadcrumbsProps } from './breadcrumbs.types.ts';
</script>

<script lang="ts">
  import { cn } from '../../utilities/class-names.ts';
  import type { BreadcrumbsProps } from './breadcrumbs.types.ts';

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
