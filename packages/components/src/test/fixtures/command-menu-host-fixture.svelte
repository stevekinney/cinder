<script lang="ts">
  import CommandItem from '../../components/command-item/command-item.svelte';
  import CommandMenu from '../../components/command-menu/command-menu.svelte';
  import { detectTrigger } from '../../components/command-menu/command-menu-trigger.ts';

  type FieldKind = 'input' | 'textarea';

  type Props = {
    fieldKind?: FieldKind;
    onSelected?: (value: string, query: string) => void;
    onDismissed?: () => void;
  };

  const props: Props = $props();
  const fieldKind = props.fieldKind ?? 'textarea';
  const onSelected = $derived(props.onSelected ?? (() => {}));
  const onDismissed = $derived(props.onDismissed ?? (() => {}));

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
</script>

{#if fieldKind === 'textarea'}
  <textarea
    bind:this={anchor}
    bind:value
    data-testid="host"
    aria-controls={open ? listboxId : undefined}
    aria-activedescendant={open ? activeItemId : undefined}
    aria-autocomplete="list"
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
  {caretIndex}
  onselect={(selection) => selectCommand(selection.value)}
  ondismiss={() => {
    open = false;
    query = '';
    triggerRange = null;
    activeItemId = undefined;
    onDismissed();
  }}
  onstatechange={(state) => {
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
