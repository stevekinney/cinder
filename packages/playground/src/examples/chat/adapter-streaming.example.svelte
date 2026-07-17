<script lang="ts" module>
  export const title = 'Adapter-driven streaming';
  export const description =
    "Use ChatAdapter.sendMessage with the public streaming builders while keeping the conversation snapshot synchronized with Chat's imperative stream.";
</script>

<script lang="ts">
  import {
    Chat,
    appendStreamingMessage,
    appendUserMessage,
    cancelStreamingMessage,
    createConversation,
    finalizeStreamingMessage,
    updateStreamingMessage,
    type ChatAdapter,
    type ConversationHistory,
  } from '@lostgradient/cinder/chat';

  let chat: ReturnType<typeof Chat> | undefined;
  let conversation = $state<ConversationHistory>(createConversation({ id: 'adapter-streaming' }));
  let streaming = $state(false);

  const responseChunks = ['This reply ', 'arrives ', 'through ', 'an adapter.'];

  function wait(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  const adapter: ChatAdapter = {
    async sendMessage(message) {
      conversation = appendUserMessage(conversation, message.content);
      const started = appendStreamingMessage(conversation, 'assistant');
      conversation = started.conversation;
      streaming = true;
      chat?.beginStreaming(started.messageId);

      let content = '';
      try {
        for (const chunk of responseChunks) {
          content += chunk;
          conversation = updateStreamingMessage(conversation, started.messageId, content);
          chat?.pushToken(chunk);
          await wait(240);
        }
        conversation = finalizeStreamingMessage(conversation, started.messageId);
      } catch (error) {
        conversation = cancelStreamingMessage(conversation, started.messageId);
        throw error;
      } finally {
        chat?.endStreaming();
        streaming = false;
      }
    },
  };
</script>

<div style="height: 34rem;">
  <Chat
    bind:this={chat}
    id="adapter-streaming-chat"
    {conversation}
    {adapter}
    {streaming}
    capabilities={{ attachments: false }}
  />
</div>
