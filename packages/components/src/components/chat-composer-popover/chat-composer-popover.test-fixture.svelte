<script lang="ts" module>
  export type TestComposerCommand = {
    value: string;
    label: string;
    description?: string;
    keywords?: string[];
    disabled?: boolean;
  };
</script>

<script lang="ts">
  import ChatInput from '../chat/input/chat-input.svelte';
  import type { MessageInput } from '../chat/conversation-model.ts';
  import ChatComposerPopover from './chat-composer-popover.svelte';
  import type { ChatComposerPopoverSelection } from './chat-composer-popover.types.ts';

  type Props = {
    commands?: TestComposerCommand[];
    initialValue?: string;
    onSelected?: (selection: ChatComposerPopoverSelection<TestComposerCommand>) => void;
    onDismissed?: () => void;
    onSubmitted?: (message: MessageInput) => void;
    replaceWithSelectedCommand?: boolean;
  };

  const props: Props = $props();
  const commands = $derived(
    props.commands ?? [
      { value: 'help', label: 'Help', description: 'Show help' },
      { value: 'new', label: 'New conversation', description: 'Start over' },
      { value: 'tools', label: 'Tools', description: 'Manage tools' },
      { value: 'stop', label: 'Stop', description: 'Stop generation' },
    ],
  );
  const onSelected = $derived(props.onSelected ?? (() => {}));
  const onDismissed = $derived(props.onDismissed ?? (() => {}));
  const onSubmitted = $derived(props.onSubmitted ?? (() => {}));

  let value = $state(props.initialValue ?? '');

  function handleSelected(selection: ChatComposerPopoverSelection<TestComposerCommand>): void {
    onSelected(selection);
    if (props.replaceWithSelectedCommand) {
      value = `/${selection.item.value}`;
    }
  }
</script>

<ChatComposerPopover
  id="test-composer-popover"
  bind:value
  items={commands}
  onselect={handleSelected}
  ondismiss={onDismissed}
>
  {#snippet composer(composerProps)}
    <ChatInput
      id="test-chat-input"
      bind:value
      allowAttachments={false}
      placeholder="Message"
      onsubmit={(message) => onSubmitted(message)}
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

  {#snippet item({ item })}
    <span>{item.label}</span>
  {/snippet}

  {#snippet empty()}
    <span>No matches</span>
  {/snippet}
</ChatComposerPopover>

<button type="button" data-testid="outside">Outside</button>
