<script lang="ts" module>
  export const title = 'Large diff';
  export const description = 'A larger document exercises hunk navigation and size gating.';
</script>

<script lang="ts">
  import { DiffViewer } from 'cinder/diff-viewer';
  const original = Array.from(
    { length: 140 },
    (_, index) => `- Item ${index + 1}: keep existing behavior stable.`,
  ).join('\n');

  const current = Array.from({ length: 140 }, (_, index) => {
    if (index % 17 === 0) return `- Item ${index + 1}: add focused regression coverage.`;
    if (index % 29 === 0) return `- Item ${index + 1}: document the public contract.`;
    return `- Item ${index + 1}: keep existing behavior stable.`;
  }).join('\n');
</script>

<DiffViewer {original} {current} readonly />
