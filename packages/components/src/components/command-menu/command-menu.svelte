<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status stable
   * @purpose Inline caret-anchored slash-command list for textareas and single-line text inputs.
   * @tag overlay
   * @tag command
   * @useWhen Showing a contextual command list at the caret while a user types in a textarea or input.
   * @useWhen Building slash-command insertion flows where the host owns text replacement.
   * @avoidWhen Exposing a global app launcher — use command-palette instead.
   * @avoidWhen Selecting from a static form option list — use combobox instead.
   * @related command-palette, command-item, popover, combobox
   */
  export type {
    CommandMenuProps,
    CommandMenuSelection,
    CommandMenuState,
    CommandMenuTriggerMatch,
  } from './command-menu.types.ts';
  export { detectTrigger } from './command-menu-trigger.ts';
</script>

<script lang="ts">
  import type { CommandMenuProps } from './command-menu.types.ts';
  import { getCaretRect } from './caret-rect.svelte.ts';
  import type { Placement, VirtualElement } from '@floating-ui/dom';
  import { on } from 'svelte/events';

  import { createAnchoredOverlay } from '../../_internal/anchored-overlay.svelte.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { inDocumentOrder } from '../../utilities/document-order.ts';
  import { useId } from '../../utilities/use-id.ts';
  import {
    setCommandListContext,
    type CommandItemRegistrationInput,
    type CommandListContext,
  } from '../_internal/command-list-context.ts';
  import { createPortalAttachment } from '../portal/index.ts';

  let {
    open = $bindable(false),
    anchor,
    caretIndex,
    query = $bindable(''),
    items,
    empty,
    placement = 'bottom-start',
    offset = 6,
    label = 'Commands',
    onselect,
    ondismiss,
    onstatechange,
    class: className,
  }: CommandMenuProps = $props();

  type RegistrationRecord = CommandItemRegistrationInput & { id: string; node: HTMLElement };

  const listboxId = useId('cinder-command-menu-listbox');
  const portalAttachment = createPortalAttachment({
    target: () => document.body,
    inheritAttributes: true,
    source: () => anchor,
  });

  let mounted = $state(false);
  let listElement: HTMLElement | undefined = $state();
  let registrations = $state<RegistrationRecord[]>([]);
  let activeItemId = $state<string | null>(null);
  let itemCounter = 0;
  let registrationsReady = $state(false);
  let readyCycle = 0;

  const enabledIds = $derived.by(() => {
    return inDocumentOrder(registrations)
      .filter((registration) => !registration.getDisabled())
      .map((registration) => registration.id);
  });

  const showEmpty = $derived(mounted && open && registrationsReady && registrations.length === 0);
  const caretAnchor = $derived.by<VirtualElement | null>(() => {
    const anchorElement = anchor;
    const currentCaretIndex = caretIndex;
    if (!anchorElement) return null;
    return {
      getBoundingClientRect() {
        return (
          getCaretRect(anchorElement, currentCaretIndex) ?? anchorElement.getBoundingClientRect()
        );
      },
    };
  });

  const anchoredOverlay = createAnchoredOverlay({
    open: () => open,
    anchor: () => caretAnchor,
    panel: () => listElement,
    placement: () => placement as Placement,
    offset: () => offset,
    widthMode: () => 'content',
  });

  $effect(() => {
    mounted = true;
  });

  $effect(() => {
    const ids = enabledIds;
    if (!open) {
      activeItemId = null;
      return;
    }
    if (activeItemId !== null && ids.includes(activeItemId)) return;
    activeItemId = ids[0] ?? null;
  });

  $effect(() => {
    void query;
    registrationsReady = false;
    const cycle = ++readyCycle;
    queueMicrotask(() => {
      if (cycle === readyCycle) registrationsReady = true;
    });
  });

  $effect(() => {
    onstatechange?.({ listboxId, activeItemId: open ? activeItemId : null });
  });

  $effect(() => {
    if (activeItemId === null) return;
    document.getElementById(activeItemId)?.scrollIntoView({ block: 'nearest' });
  });

  function activateItemById(id: string) {
    const record = registrations.find((registration) => registration.id === id);
    if (!record || record.getDisabled()) return;
    onselect?.({ value: record.getValue(), query });
  }

  const context: CommandListContext = {
    get listboxId() {
      return listboxId;
    },
    get activeItemId() {
      return activeItemId;
    },
    register(input: CommandItemRegistrationInput, node: HTMLElement) {
      const id = `${listboxId}-item-${++itemCounter}`;
      registrations = [
        ...registrations,
        {
          id,
          node,
          getValue: input.getValue,
          getOnselect: input.getOnselect,
          getDisabled: input.getDisabled,
        },
      ];
      return {
        id,
        unregister: () => {
          registrations = registrations.filter((registration) => registration.id !== id);
        },
      };
    },
    setActiveById(id: string) {
      activeItemId = id;
    },
    activateItemById,
  };

  setCommandListContext(context);

  function dismiss() {
    if (!open) return;
    open = false;
    ondismiss?.();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!open) return;
    if (event.isComposing || event.keyCode === 229) return;
    const ids = enabledIds;

    if (event.key === 'ArrowDown') {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      if (ids.length === 0) return;
      const index = activeItemId === null ? -1 : ids.indexOf(activeItemId);
      activeItemId = ids[(index + 1) % ids.length] ?? null;
    } else if (event.key === 'ArrowUp') {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      if (ids.length === 0) return;
      const index = activeItemId === null ? 0 : ids.indexOf(activeItemId);
      activeItemId = ids[index <= 0 ? ids.length - 1 : index - 1] ?? null;
    } else if (event.key === 'Home') {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      activeItemId = ids[0] ?? null;
    } else if (event.key === 'End') {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      activeItemId = ids[ids.length - 1] ?? null;
    } else if (event.key === 'Enter' && activeItemId !== null) {
      event.preventDefault();
      event.stopPropagation();
      activateItemById(activeItemId);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      dismiss();
    }
  }

  function handleDocumentPointerdown(event: PointerEvent) {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (anchor?.contains(target)) return;
    if (listElement?.contains(target)) return;
    dismiss();
  }

  $effect(() => {
    if (!open || !anchor) return;
    const stopKeydown = on(anchor, 'keydown', handleKeydown);
    const stopPointerdown = on(document, 'pointerdown', handleDocumentPointerdown, {
      capture: true,
    });

    return () => {
      stopKeydown();
      stopPointerdown();
    };
  });
</script>

{#if mounted && open && anchor}
  <div
    bind:this={listElement}
    {@attach portalAttachment}
    aria-hidden={anchoredOverlay.positionReady ? undefined : 'true'}
    class={classNames('cinder-_floating-surface', 'cinder-command-menu', className)}
    data-cinder-position-ready={anchoredOverlay.positionReady}
    style={anchoredOverlay.positionStyle}
  >
    <ul id={listboxId} role="listbox" aria-label={label} class="cinder-command-menu__listbox">
      {@render items({ query })}
    </ul>
    {#if showEmpty && empty}
      <div class="cinder-command-menu__empty" role="status">
        {@render empty()}
      </div>
    {/if}
  </div>
{/if}
