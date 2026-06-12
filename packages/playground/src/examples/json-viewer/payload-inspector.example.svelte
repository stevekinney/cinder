<script lang="ts" module>
  export const title = 'Payload inspector with copy';
  export const description =
    'Pairing JsonViewer with CopyButton creates an operational payload inspector. A metadata header names the source event; CopyButton copies the raw JSON to the clipboard so engineers can paste into other tools. This pattern suits fault-detail and activity-result surfaces in operator UIs.';
</script>

<script lang="ts">
  import { CopyButton } from '@lostgradient/cinder/copy-button';
  import { JsonViewer } from '@lostgradient/cinder/json-viewer';

  const eventType = 'ActivityFailed';
  const payload = {
    activityType: 'ProcessBatch',
    activityId: 'act_9f2a1b',
    workflowId: 'wf_3c4fce',
    runId: 'run_7d8e2c',
    failure: {
      message: 'connection refused',
      cause: 'redis://cache.internal:6379 unreachable after 3 retries',
      applicationFailureInfo: {
        type: 'NetworkError',
        nonRetryable: false,
      },
    },
    attempt: 2,
    scheduledAt: '2025-05-12T15:30:42Z',
    startedAt: '2025-05-12T15:30:42.811Z',
  };

  const rawJson = $derived(JSON.stringify(payload, null, 2));
</script>

<div
  style="border: 1px solid var(--cinder-border); border-radius: var(--cinder-radius-md); overflow: hidden;"
>
  <div
    style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.75rem; background-color: var(--cinder-surface-raised); border-bottom: 1px solid var(--cinder-border);"
  >
    <span style="font-size: 0.75rem; font-weight: 600; color: var(--cinder-text-subtle);"
      >{eventType}</span
    >
    <CopyButton value={rawJson} label="Copy raw JSON" iconOnly />
  </div>
  <div style="padding: 0.75rem;">
    <JsonViewer value={payload} initialDepth={2} />
  </div>
</div>
