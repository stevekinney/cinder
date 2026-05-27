<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status beta
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
  import { getContext, hasContext, onDestroy } from 'svelte';
  import { classNames } from '../../utilities/class-names.ts';
  import { DROPDOWN_REGISTER_TRIGGER } from '../dropdown/dropdown.context.ts';
  import {
    CONTEXT_MENU_CONTEXT,
    type ContextMenuContext,
  } from '../context-menu/context-menu.context.ts';

  if (!hasContext(DROPDOWN_REGISTER_TRIGGER) || !hasContext(CONTEXT_MENU_CONTEXT)) {
    throw new Error('ContextMenu.Trigger must be used within a ContextMenu.');
  }

  let { class: className, children, ...rest }: ContextMenuTriggerProps = $props();

  const registerTrigger =
    getContext<(element: HTMLElement | null) => void>(DROPDOWN_REGISTER_TRIGGER);
  const context = getContext<ContextMenuContext>(CONTEXT_MENU_CONTEXT);

  let triggerElement = $state<HTMLDivElement | null>(null);
  let longPressTimer: ReturnType<typeof setTimeout> | undefined;
  let startX = 0;
  let startY = 0;
  let suppressClick = false;
  let suppressNextContextmenuUntil = 0;

  $effect(() => {
    registerTrigger(triggerElement);
    return () => registerTrigger(null);
  });

  onDestroy(clearLongPress);

  function clearLongPress() {
    clearTimeout(longPressTimer);
    longPressTimer = undefined;
  }

  function handleContextmenu(event: MouseEvent) {
    if (context.disabled) return;
    if (Date.now() < suppressNextContextmenuUntil) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    context.openAt(event.clientX, event.clientY);
  }

  function handlePointerdown(event: PointerEvent) {
    if (context.disabled) return;
    if (event.pointerType !== 'touch') return;
    startX = event.clientX;
    startY = event.clientY;
    clearLongPress();
    longPressTimer = setTimeout(() => {
      suppressNextContextmenuUntil = Date.now() + 700;
      suppressClick = true;
      context.openAt(startX, startY);
    }, context.longPressDelay);
  }

  function handlePointermove(event: PointerEvent) {
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > 10) {
      clearLongPress();
    }
  }

  function handleClick(event: MouseEvent) {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClick = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (context.disabled) return;
    if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
    event.preventDefault();
    const target = event.target instanceof HTMLElement ? event.target : triggerElement;
    const rect = target?.getBoundingClientRect() ?? triggerElement?.getBoundingClientRect();
    context.openAt(rect?.left ?? 0, rect?.bottom ?? 0);
  }
</script>

<div
  bind:this={triggerElement}
  class={classNames('cinder-context-menu-trigger', className)}
  oncontextmenu={handleContextmenu}
  onpointerdown={handlePointerdown}
  onpointerup={clearLongPress}
  onpointercancel={clearLongPress}
  onpointerleave={clearLongPress}
  onpointermove={handlePointermove}
  onkeydown={handleKeydown}
  onclick={handleClick}
  {...rest}
>
  {@render children()}
</div>
