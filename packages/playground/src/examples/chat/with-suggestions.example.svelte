<script lang="ts" module>
  export const title = 'With suggested replies';
  export const description =
    'After the final assistant message, suggested follow-up labels appear as clickable chips. Clicking a chip calls onsuggestionselect(label). The chips are derived from message metadata — the underlying transcript is unchanged.';
</script>

<script lang="ts">
  import {
    Chat,
    appendMessages,
    appendUserMessage,
    createConversation,
  } from '@lostgradient/cinder/chat';

  let conversation = $state(
    appendMessages(
      appendUserMessage(
        createConversation({ id: 'suggestions-chat' }),
        'What are some good topics to learn about AI?',
      ),
      {
        role: 'assistant',
        content:
          'Great question! Here are some foundational areas to explore:\n\n- **Prompt engineering** — crafting effective inputs for language models\n- **RAG (Retrieval-Augmented Generation)** — combining search with generation\n- **Fine-tuning** — adapting pre-trained models to specific tasks\n- **AI safety** — understanding alignment, interpretability, and robustness\n\nWhich of these interests you most?',
        metadata: {
          'cinder:suggestions': [
            'Tell me more about prompt engineering',
            'Explain RAG in simple terms',
            'How does fine-tuning work?',
            'What is AI safety?',
          ],
        },
      },
    ),
  );

  function handleSuggestionSelect(label: string): void {
    conversation = appendUserMessage(conversation, label);
  }
</script>

<div style="height: 34rem;">
  <Chat
    id="playground-suggestions-chat"
    {conversation}
    capabilities={{ attachments: false }}
    onsuggestionselect={handleSuggestionSelect}
    onsubmit={(event) => {
      conversation = appendUserMessage(conversation, event.message.content as string);
    }}
  />
</div>
