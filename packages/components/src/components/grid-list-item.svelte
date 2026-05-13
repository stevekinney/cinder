<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLAnchorAttributes, HTMLAttributes } from 'svelte/elements';

  type GridListItemBase = Omit<HTMLAttributes<HTMLLIElement>, 'title'> & {
    class?: string;
    /** Optional image region (avatar, thumbnail). */
    image?: Snippet;
    /** Primary label. Provides the accessible name for the stretched link when `href` is set. */
    title?: Snippet;
    /** Secondary description. */
    subtitle?: Snippet;
    /** Tertiary metadata (badges, supplementary text). */
    meta?: Snippet;
    /**
     * Action buttons. This wrapper is lifted above the stretched-link overlay
     * via `position: relative; z-index: 1` so buttons remain clickable.
     */
    actions?: Snippet;
  };

  /** Non-linkified item — no stretched-link overlay. */
  type GridListItemStatic = GridListItemBase & {
    href?: never;
    target?: never;
    rel?: never;
  };

  /**
   * Linkified item — `title` becomes a stretched link covering the entire card
   * via a pseudo-element overlay. Only `actions` (and descendants marked with
   * `data-cinder-stretched-link-escape`) remain pointer-operable above the overlay.
   *
   * If `title` is absent, no anchor is rendered even when `href` is set.
   */
  type GridListItemLinked = GridListItemBase & {
    href: string;
    /**
     * When `target` matches `"_blank"` (case-insensitive), the component
     * automatically composes `rel="noopener noreferrer"` with any
     * consumer-supplied `rel` tokens to prevent reverse-tabnapping.
     */
    target?: HTMLAnchorAttributes['target'];
    rel?: HTMLAnchorAttributes['rel'];
  };

  export type GridListItemProps = GridListItemStatic | GridListItemLinked;
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';

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
