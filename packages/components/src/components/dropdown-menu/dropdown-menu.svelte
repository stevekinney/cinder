<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status stable
   * @purpose Popover-backed menu surface that hosts dropdown-item rows and owns arrow-key, Home, End, and Escape navigation.
   * @tag overlay
   * @tag menu
   * @useWhen Rendering the floating panel that holds a dropdown's menu items.
   * @useWhen Composing a dropdown's body from dropdown-item, dropdown-label, and dropdown-separator children.
   * @avoidWhen Used outside a dropdown context — it requires the dropdown provider and will throw otherwise.
   * @avoidWhen Showing arbitrary non-menu content — use popover.
   * @related dropdown, dropdown-trigger, dropdown-item, dropdown-label, dropdown-separator
   */
  export type { DropdownMenuProps } from './dropdown-menu.types.ts';
</script>

<script lang="ts">
  import type { DropdownMenuProps } from './dropdown-menu.types.ts';
  import { tick } from 'svelte';

  import { createAnchoredOverlay } from '../../_internal/anchored-overlay.svelte.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import {
    getDropdownContext,
    getDropdownRegister,
    getDropdownSetOpen,
  } from '../dropdown/dropdown.context.ts';
  import { createPortalAttachment } from '../portal/index.ts';

  let { class: customClassName, children, ...rest }: DropdownMenuProps = $props();

  const context = getDropdownContext();
  const registerMenu = getDropdownRegister();
  const setOpen = getDropdownSetOpen();

  let menuElement = $state<HTMLDivElement | null>(null);
  let focusedFallbackOpen = false;
  const anchoredFallback = createAnchoredOverlay({
    open: () => context.isOpen && !context.supportsPopover && Boolean(context.anchorElement),
    anchor: () => context.anchorElement,
    panel: () => menuElement,
    placement: () => context.fallbackPlacement ?? 'bottom-end',
    offset: () => 4,
    widthMode: () => context.widthMode ?? 'menu',
  });
  const fallbackPortalAttachment = createPortalAttachment({
    target: () => (typeof document === 'undefined' ? null : document.body),
    source: () => context.anchorElement,
    inheritAttributes: true,
    disabled: () => context.supportsPopover,
  });

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
    if (context.initialFocus === 'none') return;
    focusedFallbackOpen = true;
    void tick().then(() => focusMenuItem(context.initialFocus === 'last' ? -1 : 0));
  });

  function getOwnedMenuItems(): HTMLElement[] {
    if (!menuElement) return [];

    return Array.from(
      menuElement.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([data-disabled]), [role="menuitemradio"]:not([data-disabled])',
      ),
    ).filter((item) => item.closest('[role="menu"]') === menuElement);
  }

  function focusMenuItem(index: number): void {
    const items = getOwnedMenuItems();
    if (!items.length) {
      menuElement?.focus();
      return;
    }

    const resolvedIndex = index < 0 ? items.length - 1 : index;
    const item = items.at(resolvedIndex);
    item?.focus();
  }

  function handleKeydown(event: KeyboardEvent): void {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest('[role="menu"]') !== menuElement) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      context.focusTrigger();
      return;
    }

    const itemsArray = getOwnedMenuItems();
    if (!itemsArray.length) return;
    const currentIndex = itemsArray.findIndex((item) => item === document.activeElement);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      focusMenuItem(currentIndex < itemsArray.length - 1 ? currentIndex + 1 : 0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      focusMenuItem(currentIndex > 0 ? currentIndex - 1 : itemsArray.length - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      event.stopPropagation();
      focusMenuItem(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      event.stopPropagation();
      focusMenuItem(itemsArray.length - 1);
    }
  }

  function handleToggle(event: ToggleEvent): void {
    const isOpenNow = event.newState === 'open';
    setOpen(isOpenNow);

    if (isOpenNow) {
      if (context.initialFocus === 'none') return;
      void tick().then(() => focusMenuItem(context.initialFocus === 'last' ? -1 : 0));
    }
  }
</script>

{#if context.supportsPopover || context.isOpen}
  <div
    bind:this={menuElement}
    id={context.menuId}
    popover={context.supportsPopover ? 'auto' : undefined}
    class={classNames('cinder-_floating-surface', 'cinder-dropdown-menu', customClassName)}
    style={context.supportsPopover
      ? `position-anchor: --${context.menuId};`
      : context.anchorElement
        ? anchoredFallback.positionStyle
        : undefined}
    role="menu"
    aria-orientation="vertical"
    data-cinder-position-ready={!context.supportsPopover && context.anchorElement
      ? anchoredFallback.positionReady
      : undefined}
    tabindex={-1}
    onkeydown={handleKeydown}
    ontoggle={context.supportsPopover ? handleToggle : undefined}
    {@attach fallbackPortalAttachment}
    {...rest}
  >
    {#if children}
      {@render children()}
    {/if}
  </div>
{/if}
