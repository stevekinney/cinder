<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status beta
   * @purpose Right-click and long-press menu positioned at the user's pointer while reusing dropdown menu parts.
   * @tag overlay
   * @tag menu
   * @useWhen Providing contextual actions for a canvas, list row, file, or selected item.
   * @useWhen Opening a menu from a pointer location instead of a visible dropdown trigger.
   * @avoidWhen The menu should open from a button — use dropdown.
   * @avoidWhen Showing arbitrary rich content rather than menu actions — use popover.
   * @related dropdown, dropdown-menu, dropdown-item
   */
  export type { ContextMenuProps } from './context-menu.types.ts';
</script>

<script lang="ts">
  import type { ContextMenuProps } from './context-menu.types.ts';
  import { setContext, tick } from 'svelte';
  import { autoUpdate, computePosition, flip, shift } from '@floating-ui/dom';
  import type { VirtualElement } from '@floating-ui/dom';
  import { captureFocus } from '../../_internal/overlay.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { restoreFocusTo } from '../../utilities/focus.ts';
  import { useId } from '../../utilities/use-id.ts';
  import {
    DROPDOWN_CONTEXT,
    DROPDOWN_REGISTER,
    DROPDOWN_REGISTER_TRIGGER,
    DROPDOWN_SET_OPEN,
  } from '../dropdown/dropdown.context.ts';
  import type { DropdownContext } from '../dropdown/dropdown.types.ts';
  import { CONTEXT_MENU_CONTEXT, type ContextMenuContext } from './context-menu.context.ts';

  let {
    open = $bindable(false),
    onopenchange,
    anchorPoint,
    disabled = false,
    longPressDelay = 500,
    children,
    class: className,
  }: ContextMenuProps = $props();

  const menuId = useId('cinder-context-menu');
  let menuElement = $state<HTMLElement | null>(null);
  let triggerElement = $state<HTMLElement | null>(null);
  let capturedFocus: HTMLElement | null = null;
  let requestedX = $state(0);
  let requestedY = $state(0);
  let positionStyle = $state('');
  let previouslyOpen = false;

  function setOpen(nextOpen: boolean) {
    if (open === nextOpen) return;
    open = nextOpen;
    onopenchange?.(nextOpen);
  }

  function close() {
    setOpen(false);
  }

  function focusTrigger() {
    if (!restoreFocusTo(capturedFocus)) {
      restoreFocusTo(triggerElement);
    }
    capturedFocus = null;
  }

  function registerMenu(element: HTMLElement | null) {
    menuElement = element;
  }

  function registerTrigger(element: HTMLElement | null) {
    triggerElement = element;
  }

  function openAt(x: number, y: number) {
    requestedX = x;
    requestedY = y;
    if (!open) capturedFocus = captureFocus();
    setOpen(true);
    void tick().then(() => {
      const item = menuElement?.querySelector<HTMLElement>(
        '[role="menuitem"]:not([data-disabled])',
      );
      item?.focus();
    });
  }

  function makeVirtualReference(x: number, y: number): VirtualElement {
    return {
      getBoundingClientRect: () =>
        ({
          x,
          y,
          top: y,
          left: x,
          right: x,
          bottom: y,
          width: 0,
          height: 0,
        }) as DOMRect,
    };
  }

  function handleOutsidePointerdown(event: PointerEvent) {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (menuElement?.contains(target) || triggerElement?.contains(target)) return;
    close();
  }

  setContext<DropdownContext>(DROPDOWN_CONTEXT, {
    get menuId() {
      return menuId;
    },
    get isOpen() {
      return open;
    },
    get supportsPopover() {
      return false;
    },
    get initialFocus() {
      return 'first' as const;
    },
    close,
    focusTrigger,
  });
  setContext<(element: HTMLElement | null) => void>(DROPDOWN_REGISTER, registerMenu);
  setContext<(element: HTMLElement | null) => void>(DROPDOWN_REGISTER_TRIGGER, registerTrigger);
  setContext<(nextOpen: boolean) => void>(DROPDOWN_SET_OPEN, setOpen);
  setContext<ContextMenuContext>(CONTEXT_MENU_CONTEXT, {
    get disabled() {
      return disabled;
    },
    get longPressDelay() {
      return longPressDelay;
    },
    openAt,
  });

  $effect(() => {
    if (!open || !menuElement) return;
    document.addEventListener('pointerdown', handleOutsidePointerdown, { capture: true });
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerdown, { capture: true });
    };
  });

  $effect(() => {
    if (!open || !menuElement) return;
    const menu = menuElement;
    const x = anchorPoint?.x ?? requestedX;
    const y = anchorPoint?.y ?? requestedY;
    let cancelled = false;
    const reference = makeVirtualReference(x, y);
    const stop = autoUpdate(reference, menu, async () => {
      const result = await computePosition(reference, menu, {
        placement: 'right-start',
        middleware: [flip(), shift({ padding: 8 })],
        strategy: 'fixed',
      });
      if (cancelled) return;
      positionStyle = `position: fixed; left: ${result.x}px; top: ${result.y}px;`;
      menu.setAttribute('style', positionStyle);
      menu.setAttribute('data-cinder-requested-x', String(x));
      menu.setAttribute('data-cinder-requested-y', String(y));
    });
    return () => {
      cancelled = true;
      stop();
      positionStyle = '';
    };
  });

  $effect(() => {
    if (open) {
      previouslyOpen = true;
      return;
    }
    if (!previouslyOpen) return;
    previouslyOpen = false;
    focusTrigger();
  });
</script>

<div class={classNames('cinder-context-menu', className)}>
  {@render children()}
</div>
