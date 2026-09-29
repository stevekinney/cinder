<!--
  Test-only harness proving `annotationSelection` stays usable when a host
  stores it in `$state` (the ordinary Svelte 5 controlled-prop pattern, and
  exactly how DR-6's `DiffReview` will wire this component). Reassigning a
  `$state` variable wraps the new value in a reactive proxy, so the prop the
  component reads back is never the same object reference it just emitted —
  only a same-instance internal origin, tracked without relying on reference
  identity, survives that round trip. Not a public component; discovery
  ignores it (no matching directory name).
-->
<script lang="ts">
  import SourceDiffViewer from './source-diff-viewer.svelte';
  import type { SourceDiffAnnotationSelection } from './source-diff-viewer.types.ts';

  let { patch }: { patch: string } = $props();

  let selection = $state<SourceDiffAnnotationSelection | null>(null);
</script>

<output data-testid="selection-readout">
  {selection ? `${selection.startLine}-${selection.endLine}` : ''}
</output>

<SourceDiffViewer
  {patch}
  annotationSelection={selection}
  onAnnotationSelectionChange={(next) => (selection = next)}
/>
