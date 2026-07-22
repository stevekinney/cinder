<script lang="ts" module>
  export const title = 'With tool calls';
  export const description =
    'Tool results fold into the visible row with validated artifact metadata for opening a panel.';
</script>

<script lang="ts">
  import {
    Chat,
    ArtifactViewer,
    ChatArtifactLayout,
    appendMessages,
    appendUserMessage,
    createConversation,
    type ChatArtifact,
    type ChatRowContext,
  } from '@lostgradient/chat';
  import { Button } from '@lostgradient/cinder/button';

  let selectedArtifact = $state<ChatArtifact | undefined>();

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
        metadata: {
          'cinder:artifact': {
            type: 'code',
            content: '{\n  "status": "ok",\n  "drift": false\n}',
            language: 'json',
            title: 'Exports report',
          },
        },
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
  <ChatArtifactLayout
    instanceId="tool-call-artifact"
    open={selectedArtifact !== undefined}
    panelTitle={selectedArtifact?.title}
    onclose={() => (selectedArtifact = undefined)}
  >
    <Chat id="playground-tool-call-chat" {conversation} capabilities={{ attachments: false }}>
      {#snippet messageActions(context: ChatRowContext)}
        {#if context.artifact}
          <Button size="xs" variant="ghost" onclick={() => (selectedArtifact = context.artifact)}>
            Open artifact
          </Button>
        {/if}
      {/snippet}
    </Chat>

    {#snippet panel()}
      {#if selectedArtifact}
        <ArtifactViewer {...selectedArtifact} />
      {/if}
    {/snippet}
  </ChatArtifactLayout>
</div>
