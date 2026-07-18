<script lang="ts" module>
  export const title = 'Density and variant';
  export const description =
    'Compare comfortable vs compact density and bubble vs flat visual variant on the same conversationalist-shaped transcript.';
</script>

<script lang="ts">
  import {
    Chat,
    appendAssistantMessage,
    appendUserMessage,
    createConversation,
  } from '@lostgradient/chat';
  import { Select } from '@lostgradient/cinder/select';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let chatId = $derived(`${mountIdPrefix ?? uid}-density-variant`);
  let densitySelectId = $derived(`${mountIdPrefix ?? uid}-density-select`);
  let variantSelectId = $derived(`${mountIdPrefix ?? uid}-variant-select`);

  // Build a shared Conversationalist transcript.
  const baseConversation = appendAssistantMessage(
    appendUserMessage(
      appendAssistantMessage(
        appendUserMessage(
          createConversation({ id: 'density-variant-chat' }),
          'What are the density and variant props for?',
        ),
        'The `density` prop controls spacing — `comfortable` uses standard padding and gap, `compact` tightens them for data-dense contexts like embedded side panels.\n\nThe `variant` prop controls visual treatment — `bubble` uses colored backgrounds to differentiate roles; `flat` removes backgrounds and relies on alignment and the role label instead.',
      ),
      'Does compact affect the action buttons?',
    ),
    'No — action buttons keep `min-height: var(--cinder-touch-target-min)` regardless of density. Only padding and gap change.',
  );

  type Density = 'comfortable' | 'compact';
  type Variant = 'bubble' | 'flat';

  const densityOptions = [
    { value: 'comfortable', label: 'comfortable' },
    { value: 'compact', label: 'compact' },
  ] satisfies { value: Density; label: string }[];

  const variantOptions = [
    { value: 'bubble', label: 'bubble' },
    { value: 'flat', label: 'flat' },
  ] satisfies { value: Variant; label: string }[];

  let density = $state<Density>('comfortable');
  let variant = $state<Variant>('bubble');
</script>

<div style="display: grid; gap: 1rem;">
  <div style="display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap;">
    <Select id={densitySelectId} bind:value={density} options={densityOptions} label="Density" />
    <Select id={variantSelectId} bind:value={variant} options={variantOptions} label="Variant" />
  </div>

  <div style="height: 28rem;">
    <Chat
      id={chatId}
      conversation={baseConversation}
      {density}
      {variant}
      capabilities={{ attachments: false }}
    />
  </div>
</div>
