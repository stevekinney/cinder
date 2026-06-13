<script lang="ts" module>
  export const title = 'Workflow run with retry and signal wait';
  export const description =
    'A workflow run with scheduled start, activity dispatch, retry, signal wait, and terminal completion — showing all major step states.';
</script>

<script lang="ts">
  import { RunStepTimeline } from '@lostgradient/cinder/run-step-timeline';
  import type { RunStep } from '@lostgradient/cinder/run-step-timeline';

  const steps: RunStep[] = [
    {
      id: 'scheduled',
      label: 'Schedule workflow',
      status: 'succeeded',
      startTime: '2026-06-01T09:00:00Z',
      endTime: '2026-06-01T09:00:01Z',
      duration: '1s',
    },
    {
      id: 'dispatch',
      label: 'Dispatch activity',
      status: 'succeeded',
      startTime: '2026-06-01T09:00:01Z',
      endTime: '2026-06-01T09:01:15Z',
      duration: '1m 14s',
    },
    {
      id: 'retry-activity',
      label: 'Retry failed activity',
      status: 'succeeded',
      startTime: '2026-06-01T09:01:30Z',
      endTime: '2026-06-01T09:03:22Z',
      duration: '1m 52s',
      attemptCount: 3,
      details: [
        {
          id: 'retry-error-log',
          label: 'Error from attempt 2',
          content:
            'ActivityError: upstream dependency timed out after 30s\n  at activity/fetch.ts:42',
        },
      ],
    },
    {
      id: 'signal-wait',
      label: 'Wait for approval signal',
      status: 'running',
      startTime: '2026-06-01T09:03:30Z',
    },
    {
      id: 'finalize',
      label: 'Finalize and archive',
      status: 'pending',
    },
  ];
</script>

<RunStepTimeline {steps} label="Workflow run" />
