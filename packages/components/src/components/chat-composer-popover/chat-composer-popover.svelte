<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status beta
   * @purpose Chat composer-bound slash-command and mention listbox primitive.
   * @tag chat
   * @tag command
   * @tag overlay
   * @useWhen Adding slash commands, mentions, or autocomplete to ChatInput without re-implementing combobox ARIA.
   * @useWhen Composer suggestions should stay anchored to the active token and leave command definitions in application code.
   * @avoidWhen Opening a global command launcher detached from the composer — use command-palette instead.
   * @avoidWhen Anchoring a generic command menu to an arbitrary input — use command-menu instead.
   * @related chat, command-menu, command-item, command-palette
   * @a11yPattern WAI-ARIA Combobox with Listbox Popup
   * @keyboardShortcut ArrowUp / ArrowDown | Moves the active suggestion.
   * @keyboardShortcut Enter | Selects the active suggestion.
   * @keyboardShortcut Escape | Dismisses the suggestion popover.
   * @a11yNote Passes combobox role and aria-expanded, aria-controls, aria-activedescendant, and aria-autocomplete through to ChatInput's composer overlay API.
   */
  export type {
    ChatComposerPopoverComposerProps,
    ChatComposerPopoverItem,
    ChatComposerPopoverItemSnippetContext,
    ChatComposerPopoverProps,
    ChatComposerPopoverSelection,
    ChatComposerPopoverTriggerMatch,
  } from './chat-composer-popover.types.ts';
  export {
    filterFuzzySubsequence,
    fuzzySubsequenceScore,
    type FuzzyFilterItem,
    type FuzzyFilterResult,
  } from './chat-composer-popover-filter.ts';
</script>

<script lang="ts" generics="TItem extends ChatComposerPopoverItem">
  import CommandItem from '../command-item/command-item.svelte';
  import CommandMenu from '../command-menu/command-menu.svelte';
  import { onDestroy } from 'svelte';
  import { detectTrigger as detectCommandTrigger } from '../command-menu/command-menu-trigger.ts';
  import { filterFuzzySubsequence } from './chat-composer-popover-filter.ts';
  import type {
    ChatComposerPopoverComposerProps,
    ChatComposerPopoverItem,
    ChatComposerPopoverProps,
    ChatComposerPopoverSelection,
    ChatComposerPopoverTriggerMatch,
  } from './chat-composer-popover.types.ts';

  let {
    id,
    value = $bindable(''),
    items,
    triggers = ['/', '@'],
    label = 'Composer suggestions',
    placement = 'bottom-start',
    offset = 6,
    composer,
    item,
    empty,
    detectTrigger,
    filter = filterFuzzySubsequence,
    onselect,
    ondismiss,
  }: ChatComposerPopoverProps<TItem> = $props();

  let open = $state(false);
  let anchor = $state<HTMLTextAreaElement | HTMLInputElement | null>(null);
  let caretIndex = $state(0);
  const listboxId = $derived(`${id}-listbox`);
  let activeItemId = $state<string | null>(null);
  let activeMatch = $state<ChatComposerPopoverTriggerMatch | null>(null);
  let composerSyncTimer: ReturnType<typeof setTimeout> | null = null;
  let lastSyncedValue = $state(value);
  let suppressNextValueSync = false;

  const emptyContent = $derived(empty);
  const query = $derived(activeMatch?.query ?? '');
  const trigger = $derived(activeMatch?.trigger ?? triggers[0] ?? '/');
  const filteredItems = $derived.by(() => {
    if (!activeMatch) return [] as TItem[];
    return [...filter(items, activeMatch.query, activeMatch.trigger)];
  });

  const composerProps = $derived({
    composerRole: 'combobox',
    composerAriaExpanded: open,
    composerAriaControls: open ? listboxId : undefined,
    composerAriaActiveDescendant: open ? (activeItemId ?? undefined) : undefined,
    composerAriaAutocomplete: 'list',
    oncomposerinput: handleComposerInput,
    oncomposerkeydown: handleComposerKeydown,
    oncomposerselectionchange: handleComposerSelectionChange,
    oncomposerblur: handleComposerBlur,
  } satisfies ChatComposerPopoverComposerProps);

  function getComposerElement(event: Event): HTMLTextAreaElement | HTMLInputElement | null {
    const target = event.currentTarget ?? event.target;
    if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
      return target;
    }
    return null;
  }

  function findTriggerMatch(
    text: string,
    selectionStart: number,
    selectionEnd: number,
  ): ChatComposerPopoverTriggerMatch | null {
    if (detectTrigger) return detectTrigger(text, selectionStart, selectionEnd);

    for (const triggerChar of triggers) {
      const match = detectCommandTrigger({ text, selectionStart, selectionEnd, triggerChar });
      if (match) {
        return { ...match, trigger: triggerChar };
      }
    }

    return null;
  }

  function updateFromComposer(
    composerElement: HTMLTextAreaElement | HTMLInputElement | null,
    nextValue: string,
  ): void {
    if (composerElement) anchor = composerElement;

    const selectionStart = composerElement?.selectionStart ?? nextValue.length;
    const selectionEnd = composerElement?.selectionEnd ?? selectionStart;
    lastSyncedValue = nextValue;
    value = nextValue;
    caretIndex = selectionEnd;
    activeMatch = findTriggerMatch(nextValue, selectionStart, selectionEnd);
    const wasOpen = open;
    open = activeMatch !== null && anchor !== null;
    if (!open) {
      activeItemId = null;
      if (wasOpen) ondismiss?.();
    }
  }

  function dismiss({ restoreFocus = true }: { restoreFocus?: boolean } = {}): void {
    if (!open && !activeMatch && !activeItemId) return;
    open = false;
    activeItemId = null;
    activeMatch = null;
    if (restoreFocus) anchor?.focus();
    ondismiss?.();
  }

  function handleComposerInput(nextValue: string, event?: Event): void {
    suppressNextValueSync = false;
    updateFromComposer(event ? getComposerElement(event) : anchor, nextValue);
  }

  function handleComposerSelectionChange(event: Event): void {
    suppressNextValueSync = false;
    const composerElement = getComposerElement(event);
    if (!composerElement) return;
    syncComposerSelectionAfterNativeNavigation(composerElement);
  }

  function handleComposerBlur(event: FocusEvent): void {
    if (event.currentTarget === anchor) {
      dismiss({ restoreFocus: false });
    }
  }

  function syncComposerSelectionAfterNativeNavigation(
    composerElement: HTMLTextAreaElement | HTMLInputElement,
  ): void {
    if (composerSyncTimer !== null) clearTimeout(composerSyncTimer);
    composerSyncTimer = setTimeout(() => {
      composerSyncTimer = null;
      updateFromComposer(composerElement, composerElement.value);
    }, 0);
  }

  function handleComposerKeydown(event: KeyboardEvent): void {
    const composerElement =
      event.currentTarget instanceof HTMLTextAreaElement ||
      event.currentTarget instanceof HTMLInputElement
        ? event.currentTarget
        : null;

    if (composerElement) {
      anchor = composerElement;
      caretIndex = composerElement.selectionEnd ?? value.length;
    }

    if (!open || event.isComposing || event.keyCode === 229) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      dismiss();
      return;
    }

    const isNavigationKey =
      event.key === 'ArrowDown' ||
      event.key === 'ArrowUp' ||
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowRight' ||
      event.key === 'Home' ||
      event.key === 'End';
    const isMenuNavigationKey =
      event.key === 'ArrowDown' ||
      event.key === 'ArrowUp' ||
      event.key === 'Home' ||
      event.key === 'End';
    const isModifiedNavigation =
      isNavigationKey && (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey);

    if ((isMenuNavigationKey && !isModifiedNavigation) || (event.key === 'Enter' && activeItemId)) {
      event.preventDefault();
    }

    if (composerElement && isNavigationKey && (isModifiedNavigation || !isMenuNavigationKey)) {
      syncComposerSelectionAfterNativeNavigation(composerElement);
    }
  }

  onDestroy(() => {
    if (composerSyncTimer !== null) clearTimeout(composerSyncTimer);
  });

  $effect(() => {
    if (value === lastSyncedValue) return;
    if (suppressNextValueSync) {
      suppressNextValueSync = false;
      lastSyncedValue = value;
      return;
    }
    updateFromComposer(anchor, value);
  });

  function handleStateChange(state: { activeItemId: string | null }): void {
    activeItemId = state.activeItemId;
  }

  function handleSelect(selection: { value: string; query: string }): void {
    const selectedItem = filteredItems.find((candidate) => candidate.value === selection.value);
    if (!selectedItem || !activeMatch) return;

    const detail: ChatComposerPopoverSelection<TItem> = {
      item: selectedItem,
      value: selection.value,
      query: activeMatch.query,
      trigger: activeMatch.trigger,
      range: {
        start: activeMatch.start,
        end: activeMatch.end,
      },
    };

    open = false;
    activeItemId = null;
    activeMatch = null;
    anchor?.focus();
    suppressNextValueSync = true;
    onselect?.(detail);
    queueMicrotask(() => {
      suppressNextValueSync = false;
    });
  }
</script>

{@render composer(composerProps)}

<CommandMenu
  bind:open
  {anchor}
  {caretIndex}
  {query}
  {placement}
  {offset}
  {label}
  {listboxId}
  onselect={handleSelect}
  ondismiss={() => dismiss({ restoreFocus: false })}
  onstatechange={handleStateChange}
>
  {#snippet items()}
    {#each filteredItems as command (command.value)}
      <CommandItem
        value={command.value}
        disabled={command.disabled === true}
        description={item ? '' : (command.description ?? '')}
        accessibleLabel={command.description
          ? `${command.label}, ${command.description}`
          : command.label}
        selectionMode="parent"
      >
        {#if item}
          {@render item({ item: command, query, trigger })}
        {:else}
          {command.label}
        {/if}
      </CommandItem>
    {/each}
  {/snippet}

  {#snippet empty()}
    {#if emptyContent}
      {@render emptyContent()}
    {:else}
      No suggestions
    {/if}
  {/snippet}
</CommandMenu>
