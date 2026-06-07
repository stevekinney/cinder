<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status stable
   * @purpose Compose-only trigger region that opens a context-menu on right-click or touch long-press.
   * @tag overlay
   * @tag menu
   * @useWhen Wrapping the region that should own contextual actions inside ContextMenu.
   * @useWhen Pairing pointer-positioned menu behavior with dropdown menu items.
   * @avoidWhen Used outside context-menu — it requires the ContextMenu provider.
   * @avoidWhen Opening a normal click menu from a visible button — use dropdown-trigger.
   * @related context-menu, dropdown-trigger
   */
  export type { ContextMenuTriggerProps } from './context-menu-trigger.types.ts';
</script>

<script lang="ts">
  import type { ContextMenuTriggerProps } from './context-menu-trigger.types.ts';
  import { onDestroy } from 'svelte';
  import { classNames } from '../../utilities/class-names.ts';
  import { getDropdownRegisterTrigger } from '../dropdown/dropdown.context.ts';
  import { getContextMenuContext } from '../context-menu/context-menu.context.ts';

  const context = getContextMenuContext();

  let {
    class: className,
    children,
    oncontextmenu,
    onpointerdown,
    onpointerup,
    onpointercancel,
    onpointerleave,
    onpointermove,
    onkeydown,
    onclick,
    ...rest
  }: ContextMenuTriggerProps = $props();

  const registerTrigger = getDropdownRegisterTrigger();

  let triggerElement = $state<HTMLDivElement | null>(null);
  let longPressTimer: ReturnType<typeof setTimeout> | undefined;
  let startX = 0;
  let startY = 0;
  let suppressClick = false;
  let suppressNextContextmenu = false;

  type TriggerEvent<EventType extends Event> = EventType & {
    currentTarget: EventTarget & HTMLDivElement;
  };

  $effect(() => {
    registerTrigger(triggerElement);
    return () => registerTrigger(null);
  });

  onDestroy(clearLongPress);

  function clearLongPress() {
    clearTimeout(longPressTimer);
    longPressTimer = undefined;
  }

  function callTriggerHandler<EventType extends Event>(
    handler: ((event: TriggerEvent<EventType>) => void) | null | undefined,
    event: EventType,
  ) {
    handler?.(event as TriggerEvent<EventType>);
  }

  function handleContextmenu(event: MouseEvent) {
    if (context.disabled) {
      callTriggerHandler(oncontextmenu, event);
      return;
    }
    if (suppressNextContextmenu) {
      event.preventDefault();
      callTriggerHandler(oncontextmenu, event);
      return;
    }
    event.preventDefault();
    context.openAt(event.clientX, event.clientY);
    callTriggerHandler(oncontextmenu, event);
  }

  function handlePointerdown(event: PointerEvent) {
    if (context.disabled) {
      callTriggerHandler(onpointerdown, event);
      return;
    }
    if (event.pointerType !== 'touch') {
      suppressNextContextmenu = false;
      callTriggerHandler(onpointerdown, event);
      return;
    }
    suppressNextContextmenu = false;
    startX = event.clientX;
    startY = event.clientY;
    clearLongPress();
    longPressTimer = setTimeout(() => {
      suppressNextContextmenu = true;
      suppressClick = true;
      context.openAt(startX, startY);
    }, context.longPressDelay);
    callTriggerHandler(onpointerdown, event);
  }

  function handlePointermove(event: PointerEvent) {
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > 10) {
      clearLongPress();
    }
    callTriggerHandler(onpointermove, event);
  }

  function handleClick(event: MouseEvent) {
    if (!suppressClick) {
      callTriggerHandler(onclick, event);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    suppressClick = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (context.disabled) {
      callTriggerHandler(onkeydown, event);
      return;
    }
    if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) {
      callTriggerHandler(onkeydown, event);
      return;
    }
    event.preventDefault();
    const target = event.target instanceof HTMLElement ? event.target : triggerElement;
    const rect = target?.getBoundingClientRect() ?? triggerElement?.getBoundingClientRect();
    context.openAt(rect?.left ?? 0, rect?.bottom ?? 0);
    callTriggerHandler(onkeydown, event);
  }

  function handlePointerup(event: PointerEvent) {
    clearLongPress();
    callTriggerHandler(onpointerup, event);
  }

  function handlePointercancel(event: PointerEvent) {
    clearLongPress();
    callTriggerHandler(onpointercancel, event);
  }

  function handlePointerleave(event: PointerEvent) {
    clearLongPress();
    callTriggerHandler(onpointerleave, event);
  }
</script>

<div
  bind:this={triggerElement}
  class={classNames('cinder-context-menu-trigger', className)}
  aria-haspopup="menu"
  oncontextmenu={handleContextmenu}
  onpointerdown={handlePointerdown}
  onpointerup={handlePointerup}
  onpointercancel={handlePointercancel}
  onpointerleave={handlePointerleave}
  onpointermove={handlePointermove}
  onkeydown={handleKeydown}
  onclick={handleClick}
  {...rest}
>
  {@render children()}
</div>
