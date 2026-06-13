<script lang="ts" module>
  export const title = 'Nested object and array';
  export const description =
    'Deeply nested objects and arrays with initialDepth={2} so the second level starts expanded. Toggle nodes to drill into child collections — each branch remembers its collapsed state independently.';
</script>

<script lang="ts">
  import { JsonViewer } from '@lostgradient/cinder/json-viewer';

  const payload = {
    workflow: {
      id: 'wf_3c4fce',
      name: 'Nightly ETL',
      steps: [
        { name: 'extract', status: 'completed', durationMs: 312 },
        { name: 'transform', status: 'completed', durationMs: 874 },
        { name: 'load', status: 'completed', durationMs: 237 },
      ],
    },
    metadata: {
      triggeredBy: 'schedule',
      region: 'us-east-1',
      tags: ['etl', 'nightly', 'production'],
    },
    result: {
      rowsProcessed: 84201,
      rowsSkipped: 3,
      errors: [],
    },
  };
</script>

<JsonViewer value={payload} initialDepth={2} />
