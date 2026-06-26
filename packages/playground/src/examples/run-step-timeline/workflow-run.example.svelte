<script lang="ts" module>
  export const title = 'Temporal child workflow with approval wait';
  export const description =
    'A Temporal-style workflow lane that moves from model planning to tool execution, waits on approval, then shows a retrying subagent lane.';
</script>

<script lang="ts">
  import { RunStepTimeline } from '@lostgradient/cinder/run-step-timeline';
  import type { RunStep } from '@lostgradient/cinder/run-step-timeline';

  const steps: RunStep[] = [
    {
      id: 'model',
      label: 'Model plans workflow',
      status: 'succeeded',
      startTime: '2026-06-01T09:00:00Z',
      endTime: '2026-06-01T09:00:08Z',
      duration: '8s',
      actionsCount: 3,
    },
    {
      id: 'tool',
      label: 'Run repository tool',
      status: 'succeeded',
      startTime: '2026-06-01T09:00:09Z',
      endTime: '2026-06-01T09:00:27Z',
      duration: '18s',
      link: {
        href: '/runs/wf-83a1c/tools/rg',
        label: 'Open tool trace',
      },
    },
    {
      id: 'approval',
      label: 'Await deployment approval',
      status: 'waiting_approval',
      startTime: '2026-06-01T09:00:28Z',
      actionsCount: 1,
    },
    {
      id: 'subagent',
      label: 'Subagent lane',
      status: 'running',
      startTime: '2026-06-01T09:00:31Z',
      children: [
        {
          id: 'checkout',
          label: 'Inspect generated diff',
          status: 'succeeded',
          startTime: '2026-06-01T09:00:31Z',
          endTime: '2026-06-01T09:00:43Z',
          duration: '12s',
        },
        {
          id: 'retry',
          label: 'Retry flaky verification',
          status: 'retrying',
          startTime: '2026-06-01T09:00:44Z',
          attemptCount: 2,
          progress: 60,
          details: [
            {
              id: 'retry-log',
              label: 'Retry output',
              content:
                'Attempt 1 failed while the browser harness was still starting.\nAttempt 2 is running with the same verification command.',
            },
          ],
        },
      ],
    },
    {
      id: 'finalize',
      label: 'Finalize and archive',
      status: 'pending',
    },
  ];
</script>

<RunStepTimeline {steps} label="Workflow run" />
