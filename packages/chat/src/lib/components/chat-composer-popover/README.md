# ChatComposerPopover

Chat composer-bound slash-command and mention listbox primitive.

## Usage

```svelte
<script lang="ts">
  import ChatComposerPopover from '@lostgradient/chat/composer-popover';
  import { ChatInput } from '@lostgradient/chat';

  const commands = [
    { value: 'help', label: 'Help', description: 'Show available commands' },
    { value: 'new', label: 'New conversation', description: 'Start over' },
  ];

  let value = $state('');
</script>

<ChatComposerPopover id="composer-commands" bind:value items={commands}>
  {#snippet composer(composerProps)}
    <ChatInput
      id="chat"
      bind:value
      composerRole={composerProps.composerRole}
      composerAriaExpanded={composerProps.composerAriaExpanded}
      composerAriaControls={composerProps.composerAriaControls}
      composerAriaActiveDescendant={composerProps.composerAriaActiveDescendant}
      composerAriaAutocomplete={composerProps.composerAriaAutocomplete}
      oncomposerinput={composerProps.oncomposerinput}
      oncomposerkeydown={composerProps.oncomposerkeydown}
      oncomposerselectionchange={composerProps.oncomposerselectionchange}
      oncomposerblur={composerProps.oncomposerblur}
    />
  {/snippet}
</ChatComposerPopover>
```

When the composer is the full `Chat` surface, commit a selection with the
public range API. `insertAtRange()` updates the popover's bound value through
`oncomposerinput`, so no synthetic DOM event is needed:

```svelte
<script lang="ts">
  import { Chat, createConversation } from '@lostgradient/chat';
  import ChatComposerPopover from '@lostgradient/chat/composer-popover';

  const conversation = createConversation({ id: 'assistant' });
  const commands = [
    { value: 'help', label: 'Help', insert: '/help ' },
    { value: 'new', label: 'New conversation', insert: '/new ' },
  ];
  let chat: ReturnType<typeof Chat> | undefined;
  let value = $state('');
</script>

<ChatComposerPopover
  id="composer-commands"
  bind:value
  items={commands}
  onselect={(selection) => chat?.insertAtRange(selection.range, selection.item.insert)}
>
  {#snippet composer(composerProps)}
    <Chat bind:this={chat} id="assistant-chat" {conversation} {...composerProps} />
  {/snippet}
</ChatComposerPopover>
```

## Related

- [`Chat`](../chat/README.md) — full conversation surface and composer.
- [`CommandMenu`](../command-menu/README.md) — generic caret-anchored command list.
- [`CommandItem`](../command-item/README.md) — selectable command row used by the popover.
