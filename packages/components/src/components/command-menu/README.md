# CommandMenu

Inline caret-anchored slash-command list for textareas and single-line text inputs.

## Usage

```svelte
<script lang="ts">
  import CommandItem from '@lostgradient/cinder/command-item';
  import {
    CommandMenu,
    detectTrigger,
    type CommandMenuCompletion,
  } from '@lostgradient/cinder/command-menu';
  import Textarea from '@lostgradient/cinder/textarea';

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

    const replacement = command.value === 'code' ? '[fenced code block]' : `[${command.label}]`;
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

  // Ghost-text acceptance completes the typed query in place — it does not
  // select/insert the command. `remainder` is already cased to match the
  // active item's value, so it's appended as-is rather than replacing the
  // whole token with `detail.value` (which would normalize the user's own
  // typed casing).
  function completeGhostText(detail: CommandMenuCompletion) {
    if (!anchor || !triggerRange) return;

    value = `${value.slice(0, triggerRange.end)}${detail.remainder}${value.slice(triggerRange.end)}`;
    const nextCaretIndex = triggerRange.end + detail.remainder.length;
    query = detail.value;
    triggerRange = { start: triggerRange.start, end: nextCaretIndex };

    queueMicrotask(() => {
      anchor?.setSelectionRange(nextCaretIndex, nextCaretIndex);
      caretIndex = nextCaretIndex;
    });
  }
</script>

<div style="display: grid; gap: var(--cinder-space-3); max-inline-size: 42rem;">
  <Textarea
    id="field"
    label="Notes"
    rows={8}
    bind:value
    aria-controls={open ? listboxId : undefined}
    aria-activedescendant={open ? activeItemId : undefined}
    aria-autocomplete="both"
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
  onSelect={(selection) => selectCommand(selection.value)}
  onComplete={completeGhostText}
  onDismiss={() => {
    open = false;
    query = '';
    triggerRange = null;
  }}
  onStateChange={(state) => {
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
```

## Guidance

### Use When

- Showing a contextual command list at the caret while a user types in a textarea or input.
- Building slash-command insertion flows where the host owns text replacement.

### Avoid When

- Exposing a global app launcher — use command-palette instead.
- Selecting from a static form option list — use combobox instead.

## Props

<!-- generated:props:start -->

| Prop            | Type                                                                                                                 | Required | Default | Description                                                                                                                                                                                                                                                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `caretIndex`    | `number`                                                                                                             | no       | —       | Caret offset within the anchor value. Optional — when omitted, it's derived from the anchor's live `selectionEnd`. Consumers that already track trigger-relative caret state (e.g. from `detectTrigger`) may keep passing it explicitly; the derivation exists for hosts that don't need anything more precise than "where the caret currently is." |
| `class`         | `string`                                                                                                             | no       | —       | Class merged with `.cinder-command-menu`.                                                                                                                                                                                                                                                                                                           |
| `label`         | `string`                                                                                                             | no       | —       | Accessible listbox label. Default `'Commands'`.                                                                                                                                                                                                                                                                                                     |
| `listboxId`     | `string`                                                                                                             | no       | —       | Stable listbox id. Defaults to a generated component id.                                                                                                                                                                                                                                                                                            |
| `offset`        | `number`                                                                                                             | no       | —       | Distance in px between the caret and menu. Default `6`.                                                                                                                                                                                                                                                                                             |
| `open`          | `boolean`                                                                                                            | no       | —       | Open state. Bindable. Default `false`.                                                                                                                                                                                                                                                                                                              |
| `placement`     | `"top"` \| `"bottom"` \| `"left"` \| `"right"` \| `"top-start"` \| `"top-end"` \| `"bottom-start"` \| `"bottom-end"` | no       | —       | Caret-relative placement. Default `'bottom-start'`.                                                                                                                                                                                                                                                                                                 |
| `query`         | `string`                                                                                                             | no       | —       | Query text after the trigger character. Bindable. Default `''`.                                                                                                                                                                                                                                                                                     |
| `anchor`        | `(opaque)`                                                                                                           | yes      | —       | Text field used as the caret-position anchor. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                            |
| `empty`         | `(opaque)`                                                                                                           | no       | —       | Optional empty state rendered after item registration settles. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                           |
| `items`         | `(opaque)`                                                                                                           | yes      | —       | Render command items for the current query. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                              |
| `onComplete`    | `(opaque)`                                                                                                           | no       | —       | Invoked when the user accepts inline ghost-text completion. Passing this prop is what enables the feature — omit it and no ghost text ever renders. See `command-menu.a11y.md` for the full keyboard model. Not expressible in JSON Schema; see the component types for the signature.                                                              |
| `onDismiss`     | `(opaque)`                                                                                                           | no       | —       | Invoked when Escape or outside pointerdown dismisses the menu. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                           |
| `onSelect`      | `(opaque)`                                                                                                           | no       | —       | Invoked when an enabled command is activated. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                            |
| `onStateChange` | `(opaque)`                                                                                                           | no       | —       | One-way state output for host-owned field ARIA. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                          |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
