<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  export const DROPDOWN_CONTEXT = Symbol('cinder-dropdown');
  export const DROPDOWN_REGISTER = Symbol('cinder-dropdown-register');
  export const DROPDOWN_SET_OPEN = Symbol('cinder-dropdown-set-open');

  export type DropdownPlacement = 'bottom-start' | 'bottom-end';

  export type DropdownContext = {
    get menuId(): string;
    get isOpen(): boolean;
    close: () => void;
  };

  type DropdownBaseProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
    id?: string;
    class?: string;
  };

  type LegacyDropdownProps = DropdownBaseProps & {
    open?: boolean;
    placement?: DropdownPlacement;
    trigger: Snippet;
    children: Snippet;
  };

  type CompoundDropdownProps = DropdownBaseProps & {
    id: string;
    children?: Snippet;
    trigger?: never;
    open?: never;
    placement?: never;
  };

  export type DropdownProps = LegacyDropdownProps | CompoundDropdownProps;
</script>

<script lang="ts">
  import { setContext } from 'svelte';

  import { classNames } from '../utilities/class-names.ts';
  import { useId } from '../utilities/use-id.ts';

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
  let compoundOpen = $state(false);

  // Popover API detection is deferred to after mount so the server and client
  // produce identical initial markup (both start with the fallback {#if open}
  // branch). Once the component mounts on the client, we upgrade to popover if
  // the browser supports it. This avoids a hydration mismatch.
  let supportsPopover = $state(false);

  const menuId = useId('cinder-dropdown-menu');

  let rootElement: HTMLDivElement | undefined = $state();
  let menuElement: HTMLDivElement | undefined = $state();
  let triggerWrapper: HTMLDivElement | undefined = $state();

  const compoundMenuId = $derived(`${id}-menu`);
  const usesLegacySnippetApi = $derived(Boolean(trigger));

  function closeCompoundMenu(): void {
    compoundMenuElement?.hidePopover();
    compoundOpen = false;
  }

  function registerCompoundMenu(element: HTMLElement | null): void {
    compoundMenuElement = element;
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
    close: closeCompoundMenu,
  });
  setContext<(element: HTMLElement | null) => void>(DROPDOWN_REGISTER, registerCompoundMenu);
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
  {id}
  class={classNames('cinder-dropdown', customClassName)}
  data-cinder-placement={placement}
  onkeydown={handleKeydown}
  {...rest}
>
  {#if usesLegacySnippetApi}
    <!--
      The legacy trigger wrapper intercepts clicks to toggle open, and wires ARIA attributes
      onto the first focusable element inside the snippet.
    -->
    <div class="cinder-dropdown__trigger" bind:this={triggerWrapper} onclick={() => (open = !open)}>
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
