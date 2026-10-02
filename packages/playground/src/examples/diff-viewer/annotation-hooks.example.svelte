<script lang="ts" module>
  export const title = 'Optional annotation hooks';
  export const description =
    "A controlled annotationSelection lets a host build side-aware line-comment UI, matching SourceDiffViewer's vocabulary.";
</script>

<script lang="ts">
  import { DiffViewer, type DiffViewerAnnotationSelection } from '@lostgradient/editor/diff-viewer';

  const original = '# Title\n\nkeep\nold line\nkeep end';
  const current = '# Title\n\nkeep\nnew line\nkeep end';

  let selection: DiffViewerAnnotationSelection | null = $state(null);
</script>

<DiffViewer
  {original}
  {current}
  annotationSelection={selection}
  onAnnotationSelectionChange={(next) => (selection = next)}
/>
