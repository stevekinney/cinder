<script lang="ts" module>
  export const title = 'Settings card prompt editor';
  export const description =
    'MarkdownEditor embedded in a constrained settings card, with the toolbar and Rich/Raw toggle sharing one editor header.';
</script>

<script lang="ts">
  import { Card } from '@lostgradient/cinder/card';
  import { MarkdownEditor, type EditorMode } from '@lostgradient/cinder/markdown-editor';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let editorId = $derived(`${mountIdPrefix ?? uid}-agent-prompt`);

  let mode = $state<EditorMode>('source');
  let prompt = $state(`You are a careful review agent.

## Instructions

- Read the patch before commenting.
- Prefer specific line-level feedback.
- Separate blocking issues from suggestions.`);
</script>

<div data-testid="markdown-editor-settings-card" style="max-width: 46rem; margin-inline: auto;">
  <Card
    title="Agent prompt"
    description="The prompt is stored as Markdown and shown in a constrained settings column."
  >
    <MarkdownEditor
      id={editorId}
      bind:value={prompt}
      bind:mode
      label="Agent prompt"
      showToolbar
      showModeToggle
    />
  </Card>
</div>
