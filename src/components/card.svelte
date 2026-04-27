<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  type CardBase = HTMLAttributes<HTMLDivElement> & { class?: string };

  /** Card with a custom header snippet — full control over header content. */
  type CardWithHeader = CardBase & {
    header: Snippet;
    children: Snippet;
    footer?: Snippet;
    title?: never;
    description?: never;
  };

  /** Card with a title/description string API — simpler for standard cards. */
  type CardWithTitle = CardBase & {
    title: string;
    description?: string;
    children: Snippet;
    footer?: Snippet;
    header?: never;
  };

  export type CardProps = CardWithHeader | CardWithTitle;
</script>

<script lang="ts">
  import { cn } from '../utilities/class-names.ts';

  let {
    class: className,
    children,
    header,
    title,
    description,
    footer,
    ...rest
  }: CardProps = $props();
</script>

<div class={cn('cinder-card', className)} {...rest}>
  {#if header}
    <div class="cinder-card__header">
      {@render header()}
    </div>
  {:else if title}
    <div class="cinder-card__header">
      <h3 class="cinder-card__title">{title}</h3>
      {#if description}
        <p class="cinder-card__description">{description}</p>
      {/if}
    </div>
  {/if}

  <div class="cinder-card__body">
    {@render children()}
  </div>

  {#if footer}
    <div class="cinder-card__footer">
      {@render footer()}
    </div>
  {/if}
</div>
