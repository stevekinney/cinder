<script lang="ts" module>
  export const title = 'With tool calls';
  export const description =
    'Tool results fold into the visible tool-call row and remain available to per-row snippets.';
</script>

<script lang="ts">
  import {
    Chat,
    appendMessages,
    appendUserMessage,
    createConversation,
    type ChatRowContext,
    type JSONValue,
  } from '@lostgradient/chat';
  import { Button } from '@lostgradient/cinder/button';

  let inspectedResult = $state<JSONValue | undefined>();

  let conversation = $state(
    appendMessages(
      appendUserMessage(
        createConversation({ id: 'tool-call-chat' }),
        'Check whether the package has drift.',
      ),
      {
        role: 'tool-call',
        content: '',
        toolCall: {
          id: 'call-exports-check',
          name: 'exports_check',
          arguments: { package: '@lostgradient/cinder' },
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

<div style="display: grid; grid-template-rows: minmax(0, 1fr) auto; gap: 0.75rem; height: 34rem;">
  <Chat id="playground-tool-call-chat" {conversation} capabilities={{ attachments: false }}>
    {#snippet messageActions(context: ChatRowContext)}
      {#if context.toolCallPair?.result}
        <Button
          size="xs"
          variant="ghost"
          onclick={() => (inspectedResult = context.toolCallPair?.result?.content)}
        >
          Inspect result
        </Button>
      {/if}
    {/snippet}
  </Chat>

  {#if inspectedResult !== undefined}
    <pre aria-live="polite">{JSON.stringify(inspectedResult, null, 2)}</pre>
  {/if}
</div>
