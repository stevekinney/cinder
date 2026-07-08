<script lang="ts" module>
  export const title = 'Slash commands in ChatInput';
  export const description =
    'Wires ChatComposerPopover to ChatInput with consumer-owned command definitions.';
</script>

<script lang="ts">
  import ChatComposerPopover, {
    type ChatComposerPopoverSelection,
  } from '@lostgradient/cinder/chat-composer-popover';
  import { ChatInput } from '@lostgradient/cinder/chat';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  const popoverId = $derived(`${mountIdPrefix ?? uid}-slash-command`);
  const inputId = $derived(`${mountIdPrefix ?? uid}-chat`);

  type SlashCommand = {
    value: string;
    label: string;
    description: string;
    insert: string;
    keywords?: string[];
  };

  const commands: SlashCommand[] = [
    {
      value: 'help',
      label: 'Help',
      description: 'Show available assistant commands',
      insert: '/help ',
      keywords: ['docs', 'support'],
    },
    {
      value: 'new',
      label: 'New conversation',
      description: 'Start a fresh thread',
      insert: '/new ',
      keywords: ['reset', 'fresh'],
    },
    {
      value: 'tools',
      label: 'Tools',
      description: 'Open tool controls',
      insert: '/tools ',
      keywords: ['integrations', 'actions'],
    },
    {
      value: 'stop',
      label: 'Stop',
      description: 'Stop the current response',
      insert: '/stop',
      keywords: ['cancel', 'halt'],
    },
  ];

  let value = $state('');
  let selectedCommand = $state('None');

  function handleSelect(selection: ChatComposerPopoverSelection<SlashCommand>) {
    value = `${value.slice(0, selection.range.start)}${selection.item.insert}${value.slice(
      selection.range.end,
    )}`;
    selectedCommand = selection.item.label;
  }
</script>

<ChatComposerPopover id={popoverId} bind:value items={commands} onselect={handleSelect}>
  {#snippet composer(composerProps)}
    <ChatInput
      id={inputId}
      bind:value
      allowAttachments={false}
      placeholder="Type / for commands"
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

<p>Selected: {selectedCommand}</p>
