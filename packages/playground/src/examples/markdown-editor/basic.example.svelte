<script lang="ts" module>
  export const title = 'Basic markdown editor';
  export const description = 'A Milkdown-backed editor with toolbar and source mode toggle.';
</script>

<script lang="ts">
  import { MarkdownEditor } from '../../../../components/src/index.ts';

  let value = $state(`# Release notes

This editor supports **rich markdown editing**, toolbar actions, and a source mode.

- Write in markdown
- Switch between rendered and source modes
- Keep the value bindable`);
</script>

<div style="display: grid; gap: 0.75rem;">
  <MarkdownEditor id="playground-markdown-editor" bind:value showToolbar showModeToggle />
  <p style="margin: 0; color: var(--cinder-text-muted);">
    Characters: {value.length}
  </p>
</div>
