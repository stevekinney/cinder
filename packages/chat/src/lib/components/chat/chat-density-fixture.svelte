<script lang="ts">
  import Chat from './chat.svelte';
  import type { ConversationHistory } from './conversation-model.ts';

  const now = new Date().toISOString();
  const conversation: ConversationHistory = {
    schemaVersion: 4,
    id: 'density-fixture-conversation',
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

  let density = $state<'comfortable' | 'compact'>('comfortable');

  function toggle(): void {
    density = density === 'comfortable' ? 'compact' : 'comfortable';
  }
</script>

<div>
  <button data-testid="toggle-density" onclick={toggle}>Toggle density</button>
  <div style="height: 20rem;">
    <Chat id="density-fixture-chat" {conversation} {density} />
  </div>
</div>
