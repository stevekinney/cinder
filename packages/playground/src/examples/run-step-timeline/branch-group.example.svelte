<script lang="ts" module>
  export const title = 'Branch group with a winning lane';
  export const description =
    'A speculative race across three parallel deploy candidates. The winning lane is emphasized and the losers are muted, with the group outcome summarized as text.';
</script>

<script lang="ts">
  import { RunStepTimeline } from '@lostgradient/cinder/run-step-timeline';
  import type { RunStepTimelineEntry } from '@lostgradient/cinder/run-step-timeline';

  const steps: RunStepTimelineEntry[] = [
    {
      id: 'plan',
      label: 'Plan rollout',
      status: 'succeeded',
      startTime: '2026-06-01T09:00:00Z',
      endTime: '2026-06-01T09:00:04Z',
      duration: '4s',
    },
    {
      kind: 'branch',
      id: 'race',
      label: 'Race deploy candidates',
      lanes: [
        {
          id: 'us-east',
          label: 'us-east-1',
          outcome: 'won',
          steps: [
            {
              id: 'ue-deploy',
              label: 'Deploy to us-east-1',
              status: 'succeeded',
              duration: '38s',
            },
            { id: 'ue-health', label: 'Health check', status: 'succeeded', duration: '3s' },
          ],
        },
        {
          id: 'eu-west',
          label: 'eu-west-1',
          outcome: 'lost',
          steps: [
            {
              id: 'ew-deploy',
              label: 'Deploy to eu-west-1',
              status: 'succeeded',
              duration: '52s',
            },
            { id: 'ew-cancel', label: 'Cancelled after us-east-1 won', status: 'cancelled' },
          ],
        },
        {
          id: 'ap-south',
          label: 'ap-south-1',
          outcome: 'lost',
          steps: [{ id: 'as-deploy', label: 'Deploy to ap-south-1', status: 'cancelled' }],
        },
      ],
    },
    {
      id: 'promote',
      label: 'Promote winning region',
      status: 'running',
      startTime: '2026-06-01T09:01:10Z',
      progress: 45,
    },
  ];
</script>

<RunStepTimeline {steps} label="Speculative deploy run" />
