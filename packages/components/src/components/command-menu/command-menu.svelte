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
  import { setCommandListContext } from '../_internal/command-list-context.ts';
  import { createCommandListState } from '../_internal/create-command-list-state.svelte.ts';
  import { createPortalAttachment } from '../portal/index.ts';

  const listboxId = $props.id();

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

  const portalAttachment = createPortalAttachment({
    target: () => document.body,
    inheritAttributes: true,
    source: () => anchor,
  });

  let mounted = $state(false);
  let listElement: HTMLElement | undefined = $state();
  const commandList = createCommandListState(listboxId);

  const showEmpty = $derived(
    mounted && open && commandList.registrationsReady && commandList.registrations.length === 0,
  );
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
    if (!open) {
      commandList.resetActiveItem();
      return;
    }
  });

  $effect(() => {
    void query;
    commandList.refreshRegistrationsReady();
  });

  $effect(() => {
    onstatechange?.({ listboxId, activeItemId: open ? commandList.activeItemId : null });
  });

  $effect(() => {
    commandList.scrollActiveItemIntoView();
  });

  function activateItemById(id: string) {
    const record = commandList.activateItemById(id);
    if (!record) return;
    // The command list activates the item callback first; the menu-level
    // `onselect` prop then receives the committed value and query.
    onselect?.({ value: record.getValue(), query });
  }

  setCommandListContext(commandList.createContext(activateItemById));

  function dismiss() {
    if (!open) return;
    open = false;
    ondismiss?.();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!open) return;
    commandList.handleKeydown({
      event,
      onEnter: activateItemById,
      onEscape: dismiss,
      ignoreModifiedNavigation: true,
    });
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
