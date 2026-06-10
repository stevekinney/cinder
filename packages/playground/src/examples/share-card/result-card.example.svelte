<script lang="ts" module>
  export const title = 'Export result share card';
  export const description = 'A share card for a generated report link with custom actions.';
</script>

<script lang="ts">
  import { ShareCard } from '@lostgradient/cinder/share-card';
</script>

<div style="max-width: 22rem;">
  <ShareCard
    value="https://reports.example.com/r/q4-revenue-2024"
    title="Q4 Revenue Report"
    description="This link expires in 7 days."
    actions={[
      {
        key: 'copy-link',
        label: 'Copy link',
        copyValue: 'https://reports.example.com/r/q4-revenue-2024',
      },
      { key: 'copy-text', label: 'Copy title', copyValue: 'Q4 Revenue Report' },
    ]}
  />
</div>
