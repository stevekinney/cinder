<script lang="ts" module>
  export const title = 'Full-height layout';
  export const description =
    'Place Chat in a definite-height flex or grid cell with min-height: 0 so the transcript owns the scroll region.';
</script>

<script lang="ts">
  import {
    Chat,
    appendAssistantMessage,
    appendUserMessage,
    createConversation,
  } from '@lostgradient/cinder/chat';

  const conversation = appendAssistantMessage(
    appendUserMessage(
      createConversation({ id: 'full-height-layout-chat' }),
      'Why does the wrapper need min-height: 0?',
    ),
    'Chat fills its parent. In a flex or grid app shell, the cell that contains Chat needs a definite height and min-height: 0 so the transcript can scroll internally instead of forcing the page taller.',
  );
</script>

<div
  style="display: flex; flex-direction: column; height: 100dvh; max-height: 36rem; border: 1px solid var(--cinder-border-muted);"
>
  <header style="padding: 0.75rem; border-block-end: 1px solid var(--cinder-border-muted);">
    Support thread
  </header>
  <div style="flex: 1; min-height: 0;">
    <Chat
      id="playground-full-height-layout-chat"
      {conversation}
      capabilities={{ attachments: false }}
    />
  </div>
</div>
