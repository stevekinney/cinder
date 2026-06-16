<script lang="ts" module>
  export const title = 'Slash commands in a textarea';
  export const description = 'A caret-anchored command menu controlled by a textarea host.';
</script>

<script lang="ts">
  import { CommandItem } from '@lostgradient/cinder/command-item';
  import { CommandMenu, detectTrigger } from '@lostgradient/cinder/command-menu';
  import { Textarea } from '@lostgradient/cinder/textarea';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let fieldId = $derived(`${mountIdPrefix ?? uid}-field`);

  type Command = {
    value: string;
    label: string;
    description: string;
  };

  const commands: Command[] = [
    { value: 'summary', label: 'Summary', description: 'Insert a summary block.' },
    { value: 'decision', label: 'Decision', description: 'Insert a decision marker.' },
    { value: 'follow-up', label: 'Follow-up', description: 'Insert a follow-up item.' },
    { value: 'code', label: 'Code', description: 'Insert a fenced code block.' },
  ];

  let value = $state('Type / to open commands.\n');
  let open = $state(false);
  let query = $state('');
  let caretIndex = $state(0);
  let triggerRange = $state<{ start: number; end: number } | null>(null);
  let anchor: HTMLTextAreaElement | null = $state(null);
  let listboxId = $state<string | undefined>();
  let activeItemId = $state<string | undefined>();

  const filteredCommands = $derived(
    commands.filter((command) => command.label.toLowerCase().includes(query.toLowerCase())),
  );

  function syncTrigger(field: HTMLTextAreaElement) {
    anchor = field;
    const match = detectTrigger({
      text: field.value,
      selectionStart: field.selectionStart,
      selectionEnd: field.selectionEnd,
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
    const command = commands.find((item) => item.value === commandValue);
    if (!command || !anchor || !triggerRange) return;

    const replacement = command.value === 'code' ? '```ts\n\n```' : `[${command.label}]`;
    value = `${value.slice(0, triggerRange.start)}${replacement}${value.slice(triggerRange.end)}`;
    const nextCaretIndex = triggerRange.start + replacement.length;
    open = false;
    query = '';
    triggerRange = null;

    queueMicrotask(() => {
      anchor?.focus();
      anchor?.setSelectionRange(nextCaretIndex, nextCaretIndex);
      caretIndex = nextCaretIndex;
    });
  }
</script>

<div style="display: grid; gap: var(--cinder-space-3); max-inline-size: 42rem;">
  <Textarea
    id={fieldId}
    label="Notes"
    rows={8}
    bind:value
    aria-controls={open ? listboxId : undefined}
    aria-activedescendant={open ? activeItemId : undefined}
    aria-autocomplete="list"
    onfocus={(event) => syncTrigger(event.currentTarget as HTMLTextAreaElement)}
    oninput={(event) => syncTrigger(event.currentTarget as HTMLTextAreaElement)}
    onclick={(event) => syncTrigger(event.currentTarget as HTMLTextAreaElement)}
    onkeyup={(event) => syncTrigger(event.currentTarget as HTMLTextAreaElement)}
  />

  <p style="margin: 0; color: var(--cinder-text-muted); font-size: var(--cinder-text-sm);">
    Last query: {query || 'none'}
  </p>
</div>

<CommandMenu
  bind:open
  bind:query
  {anchor}
  {caretIndex}
  label="Slash commands"
  onselect={(selection) => selectCommand(selection.value)}
  ondismiss={() => {
    open = false;
    query = '';
    triggerRange = null;
  }}
  onstatechange={(state) => {
    listboxId = state.listboxId;
    activeItemId = state.activeItemId ?? undefined;
  }}
>
  {#snippet items()}
    {#each filteredCommands as command (command.value)}
      <CommandItem value={command.value} description={command.description} selectionMode="parent">
        {command.label}
      </CommandItem>
    {/each}
  {/snippet}

  {#snippet empty()}
    No commands match "{query}".
  {/snippet}
</CommandMenu>
