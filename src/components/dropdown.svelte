<script lang="ts" module>
  import type { Snippet } from 'svelte';

  export type DropdownPlacement = 'bottom-start' | 'bottom-end';

  export type DropdownProps = {
    open: boolean;
    placement?: DropdownPlacement;
    class?: string;
    trigger: Snippet;
    children: Snippet;
  };
</script>

<script lang="ts">
  import { cn } from '../utilities/class-names.ts';

  let {
    open = $bindable(false),
    placement = 'bottom-start',
    class: className,
    trigger,
    children,
  }: DropdownProps = $props();

  // Detect full Popover API support (client-side only).
  // We check for `showPopover` (the JS method), not just the `popover` attribute —
  // happy-dom stubs the attribute but does not implement showPopover/hidePopover,
  // so this correctly evaluates to false in the test environment while remaining
  // true in browsers with complete Popover API support.
  const supportsPopover =
    typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;

  const menuId = `cinder-dropdown-menu-${Math.random().toString(36).slice(2, 9)}`;

  let rootElement: HTMLDivElement | undefined = $state();
  let menuElement: HTMLDivElement | undefined = $state();

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && open) {
      open = false;
    }
  }

  function handleOutsideClick(event: MouseEvent) {
    if (rootElement && !rootElement.contains(event.target as Node)) {
      open = false;
    }
  }

  // Popover API path: imperatively show/hide via JS methods so we avoid
  // putting `popovertarget` on a non-button element (which is invalid HTML and
  // would fail type-checking). The `toggle` event on the popover element fires
  // when the browser changes popover state (including light-dismiss) so we can
  // sync `open` back.
  $effect(() => {
    if (!supportsPopover || !menuElement) return;
    const menu = menuElement as HTMLElement & {
      showPopover?: () => void;
      hidePopover?: () => void;
    };
    if (open) {
      menu.showPopover?.();
    } else {
      menu.hidePopover?.();
    }
  });

  function handlePopoverToggle(event: Event) {
    // ToggleEvent is available in browsers that support the Popover API.
    const toggleEvent = event as ToggleEvent;
    open = toggleEvent.newState === 'open';
  }

  // Non-popover path: listen for outside clicks while the menu is open.
  $effect(() => {
    if (supportsPopover || !open) return;
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  });
</script>

<div
  bind:this={rootElement}
  class={cn('cinder-dropdown', className)}
  data-cinder-placement={placement}
  onkeydown={handleKeydown}
>
  <div class="cinder-dropdown__trigger">
    {@render trigger()}
  </div>

  {#if supportsPopover}
    <!--
      Popover API path: the menu is always in the DOM but shown/hidden by the browser.
      `ontoggle` syncs browser-driven state changes (light-dismiss, Escape) back to `open`.
      Children are not rendered here — a future phase will inject items via a separate
      mechanism once this popover path is exercised in a real browser integration test.
    -->
    <div
      bind:this={menuElement}
      id={menuId}
      class="cinder-dropdown__menu"
      popover="auto"
      role="menu"
      data-cinder-placement={placement}
      ontoggle={handlePopoverToggle}
    ></div>
  {:else if open}
    <div id={menuId} class="cinder-dropdown__menu" role="menu" data-cinder-placement={placement}>
      {@render children()}
    </div>
  {/if}
</div>
