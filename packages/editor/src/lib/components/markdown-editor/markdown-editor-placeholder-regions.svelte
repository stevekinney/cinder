<script lang="ts">
  import type { PlaceholderDiagnostic } from '@lostgradient/markdown';
  import { Callout, VisuallyHidden } from '@lostgradient/cinder';
  import { PLACEHOLDER_INSTRUCTIONS } from './markdown-editor-placeholders.svelte.ts';

  let {
    id,
    instructionsVisible,
    statusVisible,
    statusMessage,
    diagnostics,
  }: {
    id: string;
    instructionsVisible: boolean;
    statusVisible: boolean;
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
<!--
  The element is always present so its id stays addressable and assistive
  technology can register it early. It is only a live region while completion
  is configured: with no placeholder configuration it is an inert, empty
  element, so a host's own announcer (ReviewEditor's comment navigation) is
  not joined by a second, empty polite status region.
-->
<VisuallyHidden
  as="div"
  id={`${id}-placeholder-status`}
  role={statusVisible ? 'status' : undefined}
  aria-live={statusVisible ? 'polite' : undefined}
  aria-atomic={statusVisible ? 'true' : undefined}>{statusMessage}</VisuallyHidden
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
