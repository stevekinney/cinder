<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  export type DropdownMenuProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
    class?: string;
    children?: Snippet;
  };
</script>

<script lang="ts">
  import { getContext, hasContext, tick } from 'svelte';

  import { classNames } from '../utilities/class-names.ts';
  import {
    DROPDOWN_CONTEXT,
    DROPDOWN_REGISTER,
    DROPDOWN_SET_OPEN,
    type DropdownContext,
  } from './dropdown.svelte';

  if (!hasContext(DROPDOWN_CONTEXT)) {
    throw new Error('DropdownMenu must be used within a Dropdown.');
  }

  let { class: customClassName, children, ...rest }: DropdownMenuProps = $props();

  const context = getContext<DropdownContext>(DROPDOWN_CONTEXT);
  const registerMenu = getContext<(element: HTMLElement | null) => void>(DROPDOWN_REGISTER);
  const setOpen = getContext<(open: boolean) => void>(DROPDOWN_SET_OPEN);

  let menuElement = $state<HTMLDivElement | null>(null);
  let focusedFallbackOpen = false;

  $effect(() => {
    registerMenu(menuElement);
    return () => registerMenu(null);
  });

  $effect(() => {
    if (context.supportsPopover || !context.isOpen) {
      focusedFallbackOpen = false;
      return;
    }
    if (focusedFallbackOpen) return;
    focusedFallbackOpen = true;
    void tick().then(() => focusMenuItem(0));
  });

  function focusMenuItem(index: number): void {
    const items = menuElement?.querySelectorAll<HTMLElement>(
      '[role="menuitem"]:not([data-disabled])',
    );
    const item = items?.item(index);
    item?.focus();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      context.focusTrigger();
      return;
    }

    const items = menuElement?.querySelectorAll<HTMLElement>(
      '[role="menuitem"]:not([data-disabled])',
    );
    if (!items?.length) return;

    const itemsArray = Array.from(items);
    const currentIndex = itemsArray.findIndex((item) => item === document.activeElement);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusMenuItem(currentIndex < itemsArray.length - 1 ? currentIndex + 1 : 0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusMenuItem(currentIndex > 0 ? currentIndex - 1 : itemsArray.length - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusMenuItem(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusMenuItem(itemsArray.length - 1);
    }
  }

  function handleToggle(event: ToggleEvent): void {
    const isOpenNow = event.newState === 'open';
    setOpen(isOpenNow);

    if (isOpenNow) {
      void tick().then(() => focusMenuItem(0));
    }
  }
</script>

{#if context.supportsPopover || context.isOpen}
  <div
    bind:this={menuElement}
    id={context.menuId}
    popover={context.supportsPopover ? 'auto' : undefined}
    class={classNames('cinder-dropdown-menu', customClassName)}
    style={context.supportsPopover ? `position-anchor: --${context.menuId};` : undefined}
    role="menu"
    aria-orientation="vertical"
    tabindex={-1}
    onkeydown={handleKeydown}
    ontoggle={context.supportsPopover ? handleToggle : undefined}
    {...rest}
  >
    {#if children}
      {@render children()}
    {/if}
  </div>
{/if}
