<script lang="ts" module>
  export {
    DROPDOWN_CONTEXT,
    DROPDOWN_REGISTER,
    DROPDOWN_REGISTER_TRIGGER,
    DROPDOWN_SET_OPEN,
  } from './dropdown.context.ts';
  export type { DropdownContext, DropdownPlacement, DropdownProps } from './dropdown.types.ts';
</script>

<script lang="ts">
  import { setContext } from 'svelte';

  import { classNames } from '../../utilities/class-names.ts';
  import {
    DROPDOWN_CONTEXT,
    DROPDOWN_REGISTER,
    DROPDOWN_REGISTER_TRIGGER,
    DROPDOWN_SET_OPEN,
  } from './dropdown.context.ts';
  import type { DropdownContext, DropdownProps } from './dropdown.types.ts';
  import { useId } from '../../utilities/use-id.ts';

  let {
    id = useId('cinder-dropdown'),
    open = $bindable(false),
    placement = 'bottom-start',
    class: customClassName,
    trigger,
    children,
    ...rest
  }: DropdownProps = $props();

  let compoundMenuElement = $state<HTMLElement | null>(null);
  let compoundTriggerElement = $state<HTMLElement | null>(null);
  let compoundOpen = $state(false);

  // Popover + CSS Anchor Positioning detection is deferred to after mount so
  // the server and client produce identical initial markup (both start with the
  // fallback {#if open} branch). Popover alone is not enough: without anchor()
  // support, top-layer menus cannot stay positioned relative to the trigger.
  let supportsPopover = $state(false);

  // useId() returns identifiers like `cinder-dropdown-menu-1` — always a
  // valid CSS ident, so it can be safely interpolated into the inline
  // `anchor-name`/`position-anchor` styles below without sanitization.
  const menuId = useId('cinder-dropdown-menu');

  let rootElement: HTMLDivElement | undefined = $state();
  let menuElement: HTMLDivElement | undefined = $state();
  let triggerWrapper: HTMLDivElement | undefined = $state();

  const compoundMenuId = $derived(`${id}-menu`);
  const usesLegacySnippetApi = $derived(Boolean(trigger));

  function closeCompoundMenu(): void {
    // Optional-chain the method too: when CSS Anchor Positioning is missing,
    // the menu renders without `popover="auto"` (see dropdown-menu.svelte),
    // and calling hidePopover() on a non-popover element throws
    // InvalidStateError — which would prevent compoundOpen from flipping
    // to false and leave the menu stuck open.
    compoundMenuElement?.hidePopover?.();
    compoundOpen = false;
  }

  function registerCompoundMenu(element: HTMLElement | null): void {
    compoundMenuElement = element;
  }

  function registerCompoundTrigger(element: HTMLElement | null): void {
    compoundTriggerElement = element;
  }

  function focusCompoundTrigger(): void {
    compoundTriggerElement?.focus();
  }

  function setCompoundOpen(nextOpen: boolean): void {
    compoundOpen = nextOpen;
  }

  setContext<DropdownContext>(DROPDOWN_CONTEXT, {
    get menuId() {
      return compoundMenuId;
    },
    get isOpen() {
      return compoundOpen;
    },
    get supportsPopover() {
      return supportsPopover;
    },
    close: closeCompoundMenu,
    focusTrigger: focusCompoundTrigger,
  });
  setContext<(element: HTMLElement | null) => void>(DROPDOWN_REGISTER, registerCompoundMenu);
  setContext<(element: HTMLElement | null) => void>(
    DROPDOWN_REGISTER_TRIGGER,
    registerCompoundTrigger,
  );
  setContext<(nextOpen: boolean) => void>(DROPDOWN_SET_OPEN, setCompoundOpen);

  // Keep aria-expanded on the trigger element in sync with open state.
  $effect(() => {
    if (!usesLegacySnippetApi) return;
    const btn = triggerWrapper?.querySelector<HTMLElement>(
      'button, a, [tabindex]:not([tabindex="-1"]), input, select',
    );
    if (!btn) return;
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-controls', menuId);
    return () => {
      btn.removeAttribute('aria-haspopup');
      btn.removeAttribute('aria-expanded');
      btn.removeAttribute('aria-controls');
    };
  });

  $effect(() => {
    // Runs only on the client after mount — safe to check browser APIs.
    supportsPopover =
      typeof HTMLElement !== 'undefined' &&
      'showPopover' in HTMLElement.prototype &&
      typeof CSS !== 'undefined' &&
      typeof CSS.supports === 'function' &&
      CSS.supports('anchor-name: --x') &&
      CSS.supports('position-anchor: --x') &&
      CSS.supports('top: anchor(bottom)');
  });

  function handleKeydown(event: KeyboardEvent) {
    // The inner DropdownMenu's keydown handler closes the menu and calls
    // preventDefault. When defaultPrevented is true, the menu already
    // handled this keystroke — skip to avoid a second close+focus pass.
    // Svelte 5 delegates onkeydown to the document, so the child handler
    // runs first when the event path traverses the menu element.
    if (event.defaultPrevented) return;

    if (event.key === 'Escape' && open) {
      open = false;
    } else if (event.key === 'Escape' && compoundOpen) {
      // Compound fallback path: focus was outside the menu (e.g. on the
      // trigger), so the menu's onkeydown never fired. Close from here.
      closeCompoundMenu();
      focusCompoundTrigger();
    }
  }

  function handleOutsideClick(event: MouseEvent) {
    if (rootElement && !rootElement.contains(event.target as Node)) {
      open = false;
      compoundOpen = false;
    }
  }

  // Popover API path: imperatively show/hide after the feature is detected.
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
    const toggleEvent = event as ToggleEvent;
    open = toggleEvent.newState === 'open';
  }

  // Non-popover path: listen for outside clicks while the menu is open.
  $effect(() => {
    if (supportsPopover || (!open && !compoundOpen)) return;
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  });
</script>

<div
  bind:this={rootElement}
  {id}
  class={classNames('cinder-dropdown', customClassName)}
  data-cinder-placement={placement}
  onkeydown={handleKeydown}
  {...rest}
>
  {#if usesLegacySnippetApi}
    <!--
      The legacy trigger wrapper intercepts clicks to toggle open, and wires ARIA attributes
      onto the first focusable element inside the snippet. The anchor-name on the trigger
      and position-anchor on the menu hand off positioning to CSS Anchor Positioning,
      so the menu lands beside the trigger even after the popover API promotes the menu
      into the top layer (where percent-based offsets would otherwise resolve against the viewport).
    -->
    <div
      class="cinder-dropdown__trigger"
      bind:this={triggerWrapper}
      style={`anchor-name: --${menuId};`}
      onclick={() => (open = !open)}
    >
      {#if trigger}
        {@render trigger()}
      {/if}
    </div>

    {#if supportsPopover}
      <div
        bind:this={menuElement}
        id={menuId}
        class="cinder-dropdown__menu"
        popover="auto"
        role="menu"
        data-cinder-placement={placement}
        style={`position-anchor: --${menuId};`}
        ontoggle={handlePopoverToggle}
      >
        {#if children}
          {@render children()}
        {/if}
      </div>
    {:else if open}
      <div id={menuId} class="cinder-dropdown__menu" role="menu" data-cinder-placement={placement}>
        {#if children}
          {@render children()}
        {/if}
      </div>
    {/if}
  {:else if children}
    {@render children()}
  {/if}
</div>
