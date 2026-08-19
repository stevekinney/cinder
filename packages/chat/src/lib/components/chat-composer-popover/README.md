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

The default placement is `top-start`, which keeps suggestions above a composer
anchored near the bottom of the viewport. Pass `placement` when a different
starting side is appropriate; the underlying floating overlay still flips and
shifts the menu when available space requires it.

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
  onSelect={(selection) => chat?.insertAtRange(selection.range, selection.item.insert)}
>
  {#snippet composer(composerProps)}
    <Chat bind:this={chat} id="assistant-chat" {conversation} {...composerProps} />
  {/snippet}
</ChatComposerPopover>
```

## Serializing entity mentions

Keep the composer as a plain textarea by committing a selected item as a Markdown link. `serializeChatComposerMention()` escapes labels and entity URIs, while `parseChatComposerMentions()` restores the submitted text projection and its UTF-16 mention ranges:

```ts
import {
  parseChatComposerMentions,
  serializeChatComposerMention,
  type ChatComposerPopoverSelection,
} from '@lostgradient/chat/composer-popover';

type MentionItem = {
  value: string;
  label: string;
};

function commitMention(selection: ChatComposerPopoverSelection<MentionItem>): void {
  const mention = serializeChatComposerMention({
    label: selection.item.label,
    uri: selection.item.value,
  });

  chat?.insertAtRange(selection.range, mention);
}

function submitComposer(value: string): void {
  const { text, mentions } = parseChatComposerMentions(value);
  sendMessage({ text, mentions });
}
```

Only absolute non-web URI schemes such as `person:` and `linear:` become mentions. Ordinary `https:`, `mailto:`, relative, image, and malformed links remain literal textarea text. The helpers are also available from the `@lostgradient/chat` package root.

## Related

- [`Chat`](../chat/README.md) — full conversation surface and composer.
- [`CommandMenu`](../command-menu/README.md) — generic caret-anchored command list.
- [`CommandItem`](../command-item/README.md) — selectable command row used by the popover.
