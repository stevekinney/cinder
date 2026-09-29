<script lang="ts">
  import type { PlaceholderDiagnostic } from '@lostgradient/markdown';
  import { Callout, VisuallyHidden } from '@lostgradient/cinder';
  import { PLACEHOLDER_INSTRUCTIONS } from './markdown-editor-placeholders.svelte.ts';

  let {
    id,
    instructionsVisible,
    statusMessage,
    diagnostics,
  }: {
    id: string;
    instructionsVisible: boolean;
    statusMessage: string;
    diagnostics: readonly PlaceholderDiagnostic[];
  } = $props();

  function describe(diagnostic: PlaceholderDiagnostic): string {
    return diagnostic.path ? `${diagnostic.path}: ${diagnostic.message}` : diagnostic.message;
  }
</script>

{#if instructionsVisible}
  <VisuallyHidden as="p" id={`${id}-placeholder-instructions`}
    >{PLACEHOLDER_INSTRUCTIONS}</VisuallyHidden
  >
{/if}
<VisuallyHidden
  as="div"
  id={`${id}-placeholder-status`}
  role="status"
  aria-live="polite"
  aria-atomic="true">{statusMessage}</VisuallyHidden
>
{#if diagnostics.length > 0}
  <Callout
    id={`${id}-placeholder-diagnostics`}
    class="markdown-editor-placeholder-diagnostics"
    variant="warning"
    semantic="note"
    title="Placeholder problems"
  >
    <ul class="markdown-editor-placeholder-diagnostic-list">
      {#each diagnostics as diagnostic, index (index)}
        <li>{describe(diagnostic)}</li>
      {/each}
    </ul>
  </Callout>
{/if}

<style>
  :global(.markdown-editor-placeholder-diagnostics) {
    margin: var(--cinder-space-2) var(--cinder-space-3);
  }

  .markdown-editor-placeholder-diagnostic-list {
    margin: 0;
    padding-inline-start: var(--cinder-space-4);
  }
</style>
