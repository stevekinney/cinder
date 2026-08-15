<script lang="ts" module>
  export const title = 'Empty markdown editor';
  export const description = 'An empty document, showing the placeholder prop.';
</script>

<script lang="ts">
  import { MarkdownEditor } from '@lostgradient/editor/markdown-editor';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let editorId = $derived(`${mountIdPrefix ?? uid}-editor`);

  let value = $state('');
</script>

<div style="display: grid; gap: 0.75rem;">
  <MarkdownEditor
    id={editorId}
    bind:value
    showToolbar={false}
    placeholder="Start writing your release notes…"
  />
</div>
