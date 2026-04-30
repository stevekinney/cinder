<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  export type DropdownTriggerProps = Omit<HTMLButtonAttributes, 'class'> & {
    class?: string;
    children?: Snippet;
  };
</script>

<script lang="ts">
  import { getContext, hasContext } from 'svelte';

  import { classNames } from '../utilities/class-names.ts';
  import { DROPDOWN_CONTEXT, type DropdownContext } from './dropdown.svelte';

  if (!hasContext(DROPDOWN_CONTEXT)) {
    throw new Error('DropdownTrigger must be used within a Dropdown.');
  }

  let { class: customClassName, children, ...rest }: DropdownTriggerProps = $props();

  const context = getContext<DropdownContext>(DROPDOWN_CONTEXT);
</script>

<button
  type="button"
  class={classNames('cinder-dropdown-trigger', customClassName)}
  style={`anchor-name: --${context.menuId};`}
  aria-haspopup="menu"
  aria-expanded={context.isOpen}
  popovertarget={context.menuId}
  {...rest}
>
  {#if children}
    {@render children()}
  {/if}
</button>
