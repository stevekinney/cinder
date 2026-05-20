<script lang="ts" module>
  export type { GridListItemProps } from './grid-list-item.types.ts';
</script>

<script lang="ts">
  import type { GridListItemProps } from './grid-list-item.types.ts';
  import { classNames } from '../../utilities/class-names.ts';

  let {
    href,
    target,
    rel,
    class: className,
    image,
    title,
    subtitle,
    meta,
    actions,
    ...rest
  }: GridListItemProps = $props();

  /**
   * Compose `rel` for the stretched-link anchor.
   * When target matches "_blank" (case-insensitive), merge "noopener" and
   * "noreferrer" into whatever the consumer supplied, deduplicating tokens.
   */
  const composedRel = $derived.by(() => {
    const isBlank = target?.toLowerCase() === '_blank';
    if (!isBlank) return rel;
    const tokens = new Set((rel ?? '').split(/\s+/).filter(Boolean));
    tokens.add('noopener');
    tokens.add('noreferrer');
    return [...tokens].join(' ');
  });
</script>

<li {...rest} class={classNames('cinder-grid-list__item', className)}>
  {#if image}
    <div class="cinder-grid-list__image">
      {@render image()}
    </div>
  {/if}
  {#if title}
    <div class="cinder-grid-list__title">
      {#if href !== undefined}
        <a class="cinder-grid-list__link" {href} {target} rel={composedRel}>
          {@render title()}
        </a>
      {:else}
        {@render title()}
      {/if}
    </div>
  {/if}
  {#if subtitle}
    <div class="cinder-grid-list__subtitle">
      {@render subtitle()}
    </div>
  {/if}
  {#if meta}
    <div class="cinder-grid-list__meta">
      {@render meta()}
    </div>
  {/if}
  {#if actions}
    <div class="cinder-grid-list__actions">
      {@render actions()}
    </div>
  {/if}
</li>
