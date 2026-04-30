<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  export type DropdownLabelProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
    class?: string;
    children?: Snippet;
  };
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';

  let { class: customClassName, children, ...rest }: DropdownLabelProps = $props();
</script>

<div class={classNames('cinder-dropdown-label', customClassName)} {...rest}>
  {#if children}
    {@render children()}
  {/if}
</div>
