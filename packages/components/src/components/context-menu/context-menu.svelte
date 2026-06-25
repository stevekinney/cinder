<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status stable
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
  import type { VirtualElement } from '@floating-ui/dom';
  import { createAnchoredOverlay } from '../../_internal/anchored-overlay.svelte.ts';
  import { getLocaleContext } from '../../_internal/locale-context.ts';
  import { captureFocus } from '../../_internal/overlay.ts';
  import { observeTextDirection, resolveTextDirection } from '../../_internal/text-direction.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { restoreFocusTo } from '../../utilities/focus.ts';
  import { createClickOutside } from '../../utilities/attachments.ts';
  import {
    setDropdownContext,
    setDropdownRegister,
    setDropdownRegisterTrigger,
    setDropdownSetOpen,
  } from '../dropdown/dropdown.context.ts';
  import { setContextMenuContext } from './context-menu.context.ts';

  let {
    open = $bindable(false),
    onopenchange,
    anchorPoint,
    disabled = false,
    longPressDelay = 500,
    children,
    class: className,
  }: ContextMenuProps = $props();

  const menuId = $props.id();
  let menuElement = $state<HTMLElement | null>(null);
  let triggerElement = $state<HTMLElement | null>(null);
  let capturedFocus: HTMLElement | null = null;
  let requestedX = $state(0);
  let requestedY = $state(0);
  let directionRevision = $state(0);
  let previouslyOpen = false;
  const localeContext = getLocaleContext();

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
    // DropdownMenu owns open→focus for this (non-popover) path: its $effect fires
    // when context.isOpen becomes true and focuses the first item because
    // context.initialFocus is 'first'. Focusing here too would be redundant work.
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

  const virtualReference: VirtualElement | null = $derived(
    open ? makeVirtualReference(anchorPoint?.x ?? requestedX, anchorPoint?.y ?? requestedY) : null,
  );
  const resolvedDirection = $derived.by(() => {
    directionRevision;
    return resolveTextDirection(triggerElement, localeContext?.direction);
  });

  $effect(() => {
    return observeTextDirection(triggerElement, () => {
      directionRevision += 1;
    });
  });

  const anchoredOverlay = createAnchoredOverlay({
    open: () => open,
    anchor: () => virtualReference,
    panel: () => menuElement,
    placement: () => (resolvedDirection === 'rtl' ? 'left-start' : 'right-start'),
    offset: () => 0,
    widthMode: () => 'menu',
  });

  const dismissOnOutsidePointerdown = $derived(
    createClickOutside({
      handler: close,
      enabled: () => open,
      eventType: 'pointerdown',
      capture: true,
      ignoreRefs: [() => menuElement ?? null, () => triggerElement ?? null],
    }),
  );

  setDropdownContext({
    get menuId() {
      return menuId;
    },
    get isOpen() {
      return open;
    },
    get supportsPopover() {
      return false;
    },
    get anchorElement() {
      return triggerElement;
    },
    get fallbackAnchorElement() {
      return null;
    },
    get initialFocus() {
      return 'first' as const;
    },
    close,
    focusTrigger,
  });
  setDropdownRegister(registerMenu);
  setDropdownRegisterTrigger(registerTrigger);
  setDropdownSetOpen(setOpen);
  setContextMenuContext({
    get disabled() {
      return disabled;
    },
    get isOpen() {
      return open;
    },
    get longPressDelay() {
      return longPressDelay;
    },
    get direction() {
      return resolvedDirection;
    },
    openAt,
    close,
  });

  $effect(() => {
    if (!open || !menuElement) return;
    const x = anchorPoint?.x ?? requestedX;
    const y = anchorPoint?.y ?? requestedY;
    const menu = menuElement;
    if (anchoredOverlay.positionStyle) {
      menu.setAttribute('style', anchoredOverlay.positionStyle);
    } else {
      menu.removeAttribute('style');
    }
    menu.setAttribute('data-cinder-position-ready', String(anchoredOverlay.positionReady));
    menu.setAttribute('data-cinder-requested-x', String(x));
    menu.setAttribute('data-cinder-requested-y', String(y));
    const ownsDirection = menu.dataset['cinderExplicitDirection'] !== 'true';
    if (ownsDirection && resolvedDirection) {
      menu.setAttribute('dir', resolvedDirection);
    }
    return () => {
      menu.removeAttribute('style');
      menu.removeAttribute('data-cinder-position-ready');
      if (ownsDirection) menu.removeAttribute('dir');
      menu.removeAttribute('data-cinder-requested-x');
      menu.removeAttribute('data-cinder-requested-y');
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

<div class={classNames('cinder-context-menu', className)} {@attach dismissOnOutsidePointerdown}>
  {@render children()}
</div>
