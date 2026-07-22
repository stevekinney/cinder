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
    replaceWithSelectedCommandImperatively?: boolean;
    throwOnSelected?: boolean;
  };

  let {
    commands: commandItems,
    initialValue = '',
    onSelected = () => {},
    onDismissed = () => {},
    onSubmitted = () => {},
    replaceWithSelectedCommand = false,
    replaceWithSelectedCommandImperatively = false,
    throwOnSelected = false,
  }: Props = $props();
  const commands = $derived(
    commandItems ?? [
      { value: 'help', label: 'Help', description: 'Show help' },
      { value: 'new', label: 'New conversation', description: 'Start over' },
      { value: 'tools', label: 'Tools', description: 'Manage tools' },
      { value: 'stop', label: 'Stop', description: 'Stop generation' },
    ],
  );

  function initialComposerValue(): string {
    return initialValue;
  }

  let value = $state(initialComposerValue());
  let composerApi = $state<
    | {
        insertAtRange: (range: { start: number; end: number }, text: string) => void;
      }
    | undefined
  >(undefined);

  function handleSelected(selection: ChatComposerPopoverSelection<TestComposerCommand>): void {
    onSelected(selection);
    if (throwOnSelected) {
      throw new Error('Selection failed');
    }
    if (replaceWithSelectedCommand) {
      value = `/${selection.item.value}`;
    }
    if (replaceWithSelectedCommandImperatively) {
      composerApi?.insertAtRange(selection.range, `/${selection.item.value}`);
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
      bind:this={composerApi}
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
<button type="button" data-testid="external-clear" onclick={() => (value = '')}
  >External clear</button
>
