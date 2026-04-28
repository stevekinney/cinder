<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  export type NavigationBarProps = HTMLAttributes<HTMLElement> & {
    class?: string;
    brand?: Snippet;
    items: Snippet;
    actions?: Snippet;
  };
</script>

<script lang="ts">
  import { cn } from '../utilities/class-names.ts';

  let { class: className, brand, items, actions, ...rest }: NavigationBarProps = $props();
</script>

<nav class={cn('cinder-navigation-bar', className)} aria-label="Main navigation" {...rest}>
  {#if brand}
    <div class="cinder-navigation-bar__brand">
      {@render brand()}
    </div>
  {/if}

  <div class="cinder-navigation-bar__items">
    {@render items()}
  </div>

  {#if actions}
    <div class="cinder-navigation-bar__actions">
      {@render actions()}
    </div>
  {/if}
</nav>
