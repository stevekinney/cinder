<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Button-shaped trigger that opens a dropdown menu, optionally rendering a trailing disclosure caret.
   * @tag form
   * @tag trigger
   * @useWhen Opening a dropdown-menu from a button styled to match cinder's form controls.
   * @useWhen Pairing with dropdown to expose a custom menu from a labelled affordance.
   * @avoidWhen Triggering a discrete action with no menu — use button instead.
   * @related dropdown, dropdown-menu
   */
  export type { DropdownTriggerProps } from './dropdown-trigger.types.ts';
</script>

<script lang="ts">
  import type { DropdownTriggerProps } from './dropdown-trigger.types.ts';

  import { classNames } from '../../utilities/class-names.ts';
  import {
    getDropdownContext,
    getDropdownRegisterTrigger,
    getDropdownSetOpen,
  } from '../dropdown/dropdown.context.ts';

  let {
    class: customClassName,
    showCaret = true,
    children,
    onclick,
    ...rest
  }: DropdownTriggerProps = $props();

  const context = getDropdownContext();
  const registerTrigger = getDropdownRegisterTrigger();
  const setOpen = getDropdownSetOpen();

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
  aria-controls={context.menuId}
  popovertarget={context.supportsPopover ? context.menuId : undefined}
  onclick={handleClick}
  {...rest}
>
  {#if children}
    {@render children()}
  {/if}
  {#if showCaret}
    <svg
      class="cinder-dropdown-trigger__caret"
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M6 8l4 4 4-4" />
    </svg>
  {/if}
</button>
