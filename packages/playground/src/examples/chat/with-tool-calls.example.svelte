<script lang="ts" module>
  export const title = 'With tool calls';
  export const description = 'Tool call and result messages render as paired expandable groups.';
</script>

<script lang="ts">
  import { Chat } from '../../../../components/src/index.ts';
  import { appendMessages, appendUserMessage, createConversation } from 'conversationalist';

  let conversation = $state(
    appendMessages(
      appendUserMessage(
        createConversation({ id: 'tool-call-chat' }),
        'Check whether the package has drift.',
      ),
      {
        role: 'tool-use',
        content: '',
        toolCall: {
          id: 'call-exports-check',
          name: 'exports_check',
          arguments: { package: 'cinder' },
        },
      },
      {
        role: 'tool-result',
        content: '',
        toolResult: {
          callId: 'call-exports-check',
          outcome: 'success',
          content: { status: 'ok', drift: false },
        },
      },
      {
        role: 'assistant',
        content: 'The exports map is current and the component subpaths are available.',
      },
    ),
  );
</script>

<div style="height: 34rem;">
  <Chat id="playground-tool-call-chat" {conversation} allowAttachments={false} />
</div>
