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
   * @keyboardShortcut Tab | Selects the active suggestion and keeps focus in the composer.
   * @keyboardShortcut Escape | Dismisses the suggestion popover.
   * @a11yNote Passes combobox role and aria-expanded, aria-controls, aria-activedescendant, and aria-autocomplete through to ChatInput's composer overlay API.
   */
  export type {
    ChatComposerPopoverComposerProps,
    ChatComposerPopoverItem,
    ChatComposerPopoverItemSnippetContext,
    ChatComposerPopoverProps,
    ChatComposerPopoverSelection,
    ChatComposerPopoverSource,
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
  import CommandMenu, {
    detectTrigger as detectCommandTrigger,
  } from '@lostgradient/cinder/command-menu';
  import CommandItem from '@lostgradient/cinder/command-item';
  import { onDestroy } from 'svelte';
  import { filterFuzzySubsequence } from './chat-composer-popover-filter.ts';
  import type {
    ChatComposerPopoverComposerProps,
    ChatComposerPopoverItem,
    ChatComposerPopoverProps,
    ChatComposerPopoverSelection,
    ChatComposerPopoverSource,
    ChatComposerPopoverTriggerMatch,
  } from './chat-composer-popover.types.ts';

  let {
    id,
    value = $bindable(''),
    items: itemDefinitions = [],
    sources = [],
    triggers = ['/', '@'],
    label = 'Composer suggestions',
    placement = 'top-start',
    offset = 6,
    composer,
    item,
    empty,
    detectTrigger,
    filter = filterFuzzySubsequence,
    onSelect,
    onDismiss,
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
  let suppressCommittedSelectionSync = false;
  let sourceRequestId = 0;
  let loadingSources = $state(false);
  let sourceGeneration = $state(0);
  let sourceGroups = $state<Array<{ id: string; label: string; items: readonly TItem[] }>>([]);

  const emptyContent = $derived(empty);
  const query = $derived(activeMatch?.query ?? '');
  const trigger = $derived(activeMatch?.trigger ?? triggers[0] ?? '/');
  const filteredItems = $derived.by(() => {
    if (!activeMatch) return [] as TItem[];
    return [
      ...filter(itemDefinitions, activeMatch.query, activeMatch.trigger),
      ...sourceGroups.flatMap((group) => group.items),
    ];
  });

  $effect(() => {
    const match = activeMatch;
    const requestId = ++sourceRequestId;
    if (!match || sources.length === 0) {
      sourceGroups = [];
      loadingSources = false;
      return;
    }

    loadingSources = true;
    void Promise.all(
      sources.map(async (source: ChatComposerPopoverSource<TItem>) => {
        const candidates = await source.load({ query: match.query, trigger: match.trigger });
        const filtered = filter(candidates, match.query, match.trigger);
        const limit = Math.max(0, Math.floor(source.limit ?? filtered.length));
        return { id: source.id, label: source.label, items: filtered.slice(0, limit) };
      }),
    ).then(
      (groups) => {
        if (requestId !== sourceRequestId) return;
        sourceGroups = groups;
        loadingSources = false;
        sourceGeneration += 1;
      },
      () => {
        if (requestId !== sourceRequestId) return;
        sourceGroups = [];
        loadingSources = false;
      },
    );
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
      if (wasOpen) onDismiss?.();
    }
  }

  /** Sync bound composer value/caret only, without reopening/dismissing from trigger analysis. */
  function syncComposerValueAndCaret(
    composerElement: HTMLTextAreaElement | HTMLInputElement | null,
    nextValue: string,
  ): void {
    if (composerElement) anchor = composerElement;
    lastSyncedValue = nextValue;
    value = nextValue;
    caretIndex = composerElement?.selectionEnd ?? caretIndex;
  }

  function dismiss({ restoreFocus = true }: { restoreFocus?: boolean } = {}): void {
    if (!open && !activeMatch && !activeItemId) return;
    clearComposerSyncTimer();
    open = false;
    activeItemId = null;
    activeMatch = null;
    if (restoreFocus) anchor?.focus();
    onDismiss?.();
  }

  function handleComposerInput(nextValue: string, event?: Event): void {
    const composerElement = event ? getComposerElement(event) : anchor;
    const isProgrammaticWriteBack = !event;
    if (isProgrammaticWriteBack && suppressCommittedSelectionSync) {
      // Selection commits written back through ChatInput/Chat.insertAtRange()
      // report the new value without a DOM input event. Only suppress that
      // specific programmatic write-back so the committed item can keep a
      // trigger prefix like `/stop` without immediately reopening the menu.
      syncComposerValueAndCaret(composerElement, nextValue);
      return;
    }
    suppressNextValueSync = false;
    updateFromComposer(composerElement, nextValue);
  }

  function handleComposerSelectionChange(event: Event): void {
    const composerElement = getComposerElement(event);
    if (!composerElement) return;
    if (suppressCommittedSelectionSync) {
      syncComposerValueAndCaret(composerElement, composerElement.value);
      return;
    }
    // Only clear the external-value suppression once we know this selection
    // event came from the composer we track; unrelated/null targets are a no-op.
    suppressNextValueSync = false;
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
    clearComposerSyncTimer();
    composerSyncTimer = setTimeout(() => {
      composerSyncTimer = null;
      updateFromComposer(composerElement, composerElement.value);
    }, 0);
  }

  function clearComposerSyncTimer(): void {
    if (composerSyncTimer === null) return;
    clearTimeout(composerSyncTimer);
    composerSyncTimer = null;
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

    if (
      event.key === 'Tab' &&
      !event.shiftKey &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      const activeOption = activeItemId ? document.getElementById(activeItemId) : null;
      const optionIndex = activeOption
        ? Array.from(activeOption.parentElement?.querySelectorAll('[role="option"]') ?? []).indexOf(
            activeOption,
          )
        : -1;
      const activeItem = filteredItems[optionIndex];
      if (activeItem) {
        event.preventDefault();
        event.stopPropagation();
        handleSelect({ value: activeItem.value, query });
      }
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
    clearComposerSyncTimer();
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
    suppressCommittedSelectionSync = true;
    queueMicrotask(() => {
      suppressNextValueSync = false;
      suppressCommittedSelectionSync = false;
    });
    onSelect?.(detail);
  }
</script>

{@render composer(composerProps)}

{#key sourceGeneration}
  <CommandMenu
    bind:open
    {anchor}
    {caretIndex}
    {query}
    {placement}
    {offset}
    {label}
    {listboxId}
    class="chat-composer-popover"
    onSelect={handleSelect}
    onDismiss={() => dismiss({ restoreFocus: false })}
    onStateChange={handleStateChange}
  >
    {#snippet items()}
      {#each filter(itemDefinitions, query, trigger) as command (command.value)}
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
      {#each sourceGroups as group (group.id)}
        {#if group.items.length > 0}
          {#each group.items as command, commandIndex (command.value)}
            <CommandItem
              value={command.value}
              disabled={command.disabled === true}
              description={item ? '' : (command.description ?? '')}
              accessibleLabel={`${group.label}: ${command.description ? `${command.label}, ${command.description}` : command.label}`}
              selectionMode="parent"
            >
              {#if commandIndex === 0}
                <span class="chat-composer-popover__group-label">{group.label}</span>
              {/if}
              {#if item}
                {@render item({ item: command, query, trigger })}
              {:else}
                {command.label}
              {/if}
            </CommandItem>
          {/each}
        {/if}
      {/each}
    {/snippet}

    {#snippet empty()}
      {#if loadingSources}
        Loading suggestions
      {:else if emptyContent}
        {@render emptyContent()}
      {:else}
        No suggestions
      {/if}
    {/snippet}
  </CommandMenu>
{/key}
