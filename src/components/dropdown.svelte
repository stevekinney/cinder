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

  // Popover API detection is deferred to after mount so the server and client
  // produce identical initial markup (both start with the fallback {#if open}
  // branch). Once the component mounts on the client, we upgrade to popover if
  // the browser supports it. This avoids a hydration mismatch.
  let supportsPopover = $state(false);

  const menuId = `cinder-dropdown-menu-${Math.random().toString(36).slice(2, 9)}`;

  let rootElement: HTMLDivElement | undefined = $state();
  let menuElement: HTMLDivElement | undefined = $state();
  let triggerWrapper: HTMLDivElement | undefined = $state();

  // Keep aria-expanded on the trigger element in sync with open state.
  $effect(() => {
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
    supportsPopover = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;
  });

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
  <!--
    The trigger wrapper wires aria-haspopup, aria-expanded, and aria-controls onto the
    first focusable element inside the trigger snippet. Consumers must provide exactly one
    focusable trigger element inside the trigger snippet (typically a <button>).
  -->
  <div class="cinder-dropdown__trigger" bind:this={triggerWrapper}>
    {@render trigger()}
  </div>

  {#if supportsPopover}
    <!--
      Popover API path: menu is in the DOM and driven via showPopover()/hidePopover().
      ontoggle syncs browser-driven state changes (light-dismiss, Escape) back to `open`.
    -->
    <div
      bind:this={menuElement}
      id={menuId}
      class="cinder-dropdown__menu"
      popover="auto"
      role="menu"
      data-cinder-placement={placement}
      ontoggle={handlePopoverToggle}
    >
      {@render children()}
    </div>
  {:else if open}
    <div id={menuId} class="cinder-dropdown__menu" role="menu" data-cinder-placement={placement}>
      {@render children()}
    </div>
  {/if}
</div>
