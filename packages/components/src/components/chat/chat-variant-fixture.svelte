<script lang="ts">
  import Chat from './chat.svelte';
  import type { ConversationHistory } from './conversation-model.ts';

  const now = new Date().toISOString();
  const conversation: ConversationHistory = {
    schemaVersion: 4,
    id: 'variant-fixture-conversation',
    status: 'active',
    metadata: {},
    ids: ['msg-1'],
    messages: {
      'msg-1': {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        position: 0,
        createdAt: now,
        metadata: {},
        hidden: false,
      },
    },
    createdAt: now,
    updatedAt: now,
  };

  let variant = $state<'bubble' | 'flat'>('bubble');

  function toggle(): void {
    variant = variant === 'bubble' ? 'flat' : 'bubble';
  }
</script>

<div>
  <button data-testid="toggle-variant" onclick={toggle}>Toggle variant</button>
  <div style="height: 20rem;">
    <Chat id="variant-fixture-chat" {conversation} {variant} />
  </div>
</div>
