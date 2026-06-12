<script lang="ts" module>
  export const title = 'Oversized payload fallback';
  export const description =
    'When the serialized payload exceeds maxBytes, JsonViewer renders a fallback instead of attempting the tree. Here maxBytes={256} triggers the cap on a ~500-byte object. Use the copy or download action in the host surface to inspect the raw JSON.';
</script>

<script lang="ts">
  import { JsonViewer } from '@lostgradient/cinder/json-viewer';

  const payload = {
    id: 'act_9f2a1b',
    type: 'ActivityCompleted',
    namespace: 'default',
    workflowId: 'wf_3c4fce',
    runId: 'run_7d8e2c',
    activityId: 'act_9f2a1b',
    activityType: 'ProcessBatch',
    result: { rowsProcessed: 84201, rowsSkipped: 3, errors: [] },
    scheduledAt: '2025-05-12T15:30:00Z',
    startedAt: '2025-05-12T15:30:00.312Z',
    completedAt: '2025-05-12T15:30:01.186Z',
    workerIdentity: 'worker@node-42.us-east-1',
  };
</script>

<JsonViewer value={payload} maxBytes={256} />
