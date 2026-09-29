<!--
  Test-only harness proving `ref.focusFile` works when called synchronously,
  in the same event handler, as the `activeFileOccurrence` change that first
  reveals the target file's header. A host wiring "select this file, then
  focus it" from one click handler never gets a chance to `await tick()` in
  between. Not a public component; discovery ignores it (no matching
  directory name).
-->
<script lang="ts">
  import SourceDiffViewer from './source-diff-viewer.svelte';
  import type {
    SourceDiffViewerFocusResult,
    SourceDiffViewerRef,
  } from './source-diff-viewer.types.ts';

  let { patch }: { patch: string } = $props();

  let active = $state(0);
  let ref = $state<SourceDiffViewerRef | undefined>();
  let result = $state<SourceDiffViewerFocusResult | null>(null);

  function switchAndFocus(): void {
    active = 1;
    result = ref?.focusFile(1) ?? null;
  }
</script>

<output data-testid="focus-result">{result ? result.status : ''}</output>
<button type="button" data-testid="switch-and-focus" onclick={switchAndFocus}>
  switch and focus
</button>

<SourceDiffViewer {patch} activeFileOccurrence={active} bind:ref />
