<script lang="ts">
  import { untrack } from 'svelte';
  import CommandItem from '../../components/command-item/command-item.svelte';
  import CommandMenu from '../../components/command-menu/command-menu.svelte';
  import { detectTrigger } from '../../components/command-menu/command-menu-trigger.ts';
  import type { CommandMenuCompletion } from '../../components/command-menu/command-menu.types.ts';

  type FieldKind = 'input' | 'textarea';

  type Props = {
    fieldKind?: FieldKind;
    /**
     * Pass `onComplete` to the underlying `<CommandMenu>` at all — the
     * feature's own opt-in switch. Defaults to `false` so every pre-existing
     * test using this fixture keeps its single-press Escape-closes behavior;
     * ghost-text tests opt in explicitly.
     */
    ghostTextEnabled?: boolean;
    /** Force a caretIndex prop instead of relying on live-selection derivation. */
    explicitCaretIndex?: boolean;
    onSelected?: (value: string, query: string) => void;
    onDismissed?: () => void;
    onCompleted?: (detail: CommandMenuCompletion) => void;
  };

  const props: Props = $props();
  const fieldKind = untrack(() => props.fieldKind) ?? 'textarea';
  const ghostTextEnabled = $derived(props.ghostTextEnabled ?? false);
  const explicitCaretIndex = $derived(props.explicitCaretIndex ?? true);
  const onSelected = $derived(props.onSelected ?? (() => {}));
  const onDismissed = $derived(props.onDismissed ?? (() => {}));
  const onCompleted = $derived(props.onCompleted ?? (() => {}));

  const commands = [
    { value: 'alpha', label: 'Alpha' },
    { value: 'beta', label: 'Beta' },
  ];

  let value = $state('');
  let open = $state(false);
  let query = $state('');
  let caretIndex = $state(0);
  let triggerRange = $state<{ start: number; end: number } | null>(null);
  let anchor: HTMLInputElement | HTMLTextAreaElement | null = $state(null);
  let listboxId = $state<string | undefined>();
  let activeItemId = $state<string | undefined>();

  const filteredCommands = $derived(
    commands.filter((command) => command.label.toLowerCase().includes(query.toLowerCase())),
  );

  function syncTrigger(field: HTMLInputElement | HTMLTextAreaElement) {
    anchor = field;
    const match = detectTrigger({
      text: field.value,
      selectionStart: field.selectionStart ?? field.value.length,
      selectionEnd: field.selectionEnd ?? field.value.length,
    });

    if (!match) {
      open = false;
      query = '';
      triggerRange = null;
      activeItemId = undefined;
      return;
    }

    open = true;
    query = match.query;
    caretIndex = match.end;
    triggerRange = { start: match.start, end: match.end };
  }

  function selectCommand(commandValue: string) {
    onSelected(commandValue, query);
    if (!anchor || !triggerRange) return;
    value = `${value.slice(0, triggerRange.start)}[${commandValue}]${value.slice(triggerRange.end)}`;
    open = false;
    query = '';
    triggerRange = null;
  }

  function completeGhostText(detail: CommandMenuCompletion) {
    onCompleted(detail);
    if (!anchor || !triggerRange) return;
    value = `${value.slice(0, triggerRange.end)}${detail.remainder}${value.slice(triggerRange.end)}`;
    const nextCaretIndex = triggerRange.end + detail.remainder.length;
    query = detail.value;
    triggerRange = { start: triggerRange.start, end: nextCaretIndex };
    caretIndex = nextCaretIndex;

    const currentAnchor = anchor;
    queueMicrotask(() => {
      currentAnchor.setSelectionRange(nextCaretIndex, nextCaretIndex);
    });
  }
</script>

{#if fieldKind === 'textarea'}
  <textarea
    bind:this={anchor}
    bind:value
    data-testid="host"
    aria-controls={open ? listboxId : undefined}
    aria-activedescendant={open ? activeItemId : undefined}
    aria-autocomplete="list"
    onfocus={(event) => syncTrigger(event.currentTarget)}
    oninput={(event) => syncTrigger(event.currentTarget)}
    onclick={(event) => syncTrigger(event.currentTarget)}
    onkeyup={(event) => syncTrigger(event.currentTarget)}
  ></textarea>
{:else}
  <input
    bind:this={anchor}
    bind:value
    data-testid="host"
    aria-controls={open ? listboxId : undefined}
    aria-activedescendant={open ? activeItemId : undefined}
    aria-autocomplete="list"
    onfocus={(event) => syncTrigger(event.currentTarget)}
    oninput={(event) => syncTrigger(event.currentTarget)}
    onclick={(event) => syncTrigger(event.currentTarget)}
    onkeyup={(event) => syncTrigger(event.currentTarget)}
  />
{/if}

<button type="button" data-testid="outside">Outside</button>

<CommandMenu
  bind:open
  bind:query
  {anchor}
  {...explicitCaretIndex ? { caretIndex } : {}}
  onSelect={(selection) => selectCommand(selection.value)}
  {...ghostTextEnabled ? { onComplete: completeGhostText } : {}}
  onDismiss={() => {
    open = false;
    query = '';
    triggerRange = null;
    activeItemId = undefined;
    onDismissed();
  }}
  onStateChange={(state) => {
    listboxId = state.listboxId;
    activeItemId = state.activeItemId ?? undefined;
  }}
>
  {#snippet items()}
    {#each filteredCommands as command (command.value)}
      <CommandItem value={command.value} selectionMode="parent">{command.label}</CommandItem>
    {/each}
  {/snippet}
</CommandMenu>
