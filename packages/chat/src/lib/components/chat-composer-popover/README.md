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

## Related

- [`Chat`](../chat/README.md) — full conversation surface and composer.
- [`CommandMenu`](../command-menu/README.md) — generic caret-anchored command list.
- [`CommandItem`](../command-item/README.md) — selectable command row used by the popover.
