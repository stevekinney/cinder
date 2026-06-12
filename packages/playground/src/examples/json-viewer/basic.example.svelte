<script lang="ts" module>
  export const title = 'Shallow object';
  export const description =
    'A flat JSON object with mixed scalar values. The default initialDepth of 1 keeps the top-level keys expanded while deeper nodes start collapsed — useful for at-a-glance inspection.';
</script>

<script lang="ts">
  import { JsonViewer } from '@lostgradient/cinder/json-viewer';

  const payload = {
    id: 'wf_3c4fce',
    status: 'completed',
    exitCode: 0,
    durationMs: 1423,
    startedAt: '2025-05-12T15:30:00Z',
    finishedAt: '2025-05-12T15:30:01.423Z',
    retryCount: 0,
    triggeredBy: 'schedule',
  };
</script>

<JsonViewer value={payload} />
