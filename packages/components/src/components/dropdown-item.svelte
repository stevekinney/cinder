<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  export type DropdownItemVariant = 'default' | 'danger';

  export type DropdownItemProps = Omit<HTMLButtonAttributes, 'class'> & {
    variant?: DropdownItemVariant;
    inset?: boolean;
    closeOnSelect?: boolean;
    class?: string;
    children?: Snippet;
  };
</script>

<script lang="ts">
  import { getContext, hasContext } from 'svelte';

  import { classNames } from '../utilities/class-names.ts';
  import { DROPDOWN_CONTEXT, type DropdownContext } from './dropdown.svelte';

  if (!hasContext(DROPDOWN_CONTEXT)) {
    throw new Error('DropdownItem must be used within a Dropdown.');
  }

  let {
    variant = 'default',
    inset = false,
    disabled,
    closeOnSelect = true,
    class: customClassName,
    onclick,
    children,
    ...rest
  }: DropdownItemProps = $props();

  const context = getContext<DropdownContext>(DROPDOWN_CONTEXT);

  type DropdownItemClickHandler = (
    event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement },
  ) => void;

  function handleClick(
    event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement },
  ): void {
    if (disabled) return;
    if (typeof onclick === 'function') {
      (onclick as DropdownItemClickHandler)(event);
    }
    if (closeOnSelect) {
      context.close();
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (disabled) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (event.currentTarget instanceof HTMLButtonElement) {
        event.currentTarget.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    }
  }
</script>

<button
  type="button"
  role="menuitem"
  class={classNames(
    'cinder-dropdown-item',
    inset && 'cinder-dropdown-item--inset',
    customClassName,
  )}
  data-cinder-variant={variant}
  tabindex={disabled ? -1 : 0}
  data-disabled={disabled ? '' : undefined}
  aria-disabled={disabled ? 'true' : undefined}
  onclick={handleClick}
  onkeydown={handleKeydown}
  {...rest}
>
  {#if children}
    {@render children()}
  {/if}
</button>
