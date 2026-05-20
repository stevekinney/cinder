<script lang="ts" module>
  export type { DropdownTriggerProps } from './dropdown-trigger.types.ts';
</script>

<script lang="ts">
  import type { DropdownTriggerProps } from './dropdown-trigger.types.ts';
  import { getContext, hasContext } from 'svelte';

  import { classNames } from '../../utilities/class-names.ts';
  import {
    DROPDOWN_CONTEXT,
    DROPDOWN_REGISTER_TRIGGER,
    DROPDOWN_SET_OPEN,
  } from '../dropdown/dropdown.context.ts';
  import type { DropdownContext } from '../dropdown/dropdown.types.ts';

  if (!hasContext(DROPDOWN_CONTEXT)) {
    throw new Error('DropdownTrigger must be used within a Dropdown.');
  }

  let {
    class: customClassName,
    showCaret = true,
    children,
    onclick,
    ...rest
  }: DropdownTriggerProps = $props();

  const context = getContext<DropdownContext>(DROPDOWN_CONTEXT);
  const registerTrigger =
    getContext<(element: HTMLElement | null) => void>(DROPDOWN_REGISTER_TRIGGER);
  const setOpen = getContext<(open: boolean) => void>(DROPDOWN_SET_OPEN);

  let triggerElement = $state<HTMLButtonElement | null>(null);

  $effect(() => {
    registerTrigger(triggerElement);
    return () => registerTrigger(null);
  });

  type DropdownTriggerClickHandler = (
    event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement },
  ) => void;

  function handleClick(
    event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement },
  ): void {
    if (typeof onclick === 'function') {
      (onclick as DropdownTriggerClickHandler)(event);
    }
    if (!event.defaultPrevented && !context.supportsPopover) {
      setOpen(!context.isOpen);
    }
  }
</script>

<button
  bind:this={triggerElement}
  type="button"
  class={classNames('cinder-dropdown-trigger', customClassName)}
  style={`anchor-name: --${context.menuId};`}
  aria-haspopup="menu"
  aria-expanded={context.isOpen}
  popovertarget={context.supportsPopover ? context.menuId : undefined}
  onclick={handleClick}
  {...rest}
>
  {#if children}
    {@render children()}
  {/if}
  {#if showCaret}
    <span class="cinder-dropdown-trigger__caret" aria-hidden="true"></span>
  {/if}
</button>
