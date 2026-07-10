<script lang="ts" module>
  export const title = 'Rewound speculative step';
  export const description =
    'A step that was speculatively executed and then unwound after a conflict. It renders struck-through and de-emphasized but stays inspectable, and announces its rewound state as text.';
</script>

<script lang="ts">
  import { RunStepTimeline } from '@lostgradient/cinder/run-step-timeline';
  import type { RunStepTimelineEntry } from '@lostgradient/cinder/run-step-timeline';

  const steps: RunStepTimelineEntry[] = [
    {
      id: 'read',
      label: 'Read current inventory',
      status: 'succeeded',
      duration: '2s',
    },
    {
      id: 'reserve',
      label: 'Reserve stock (speculative)',
      status: 'succeeded',
      rewound: true,
      duration: '1s',
      details: [
        {
          id: 'reason',
          label: 'Why it was unwound',
          content:
            'A concurrent order won the reservation. This speculative branch was rolled back before commit.',
        },
      ],
    },
    {
      id: 'retry',
      label: 'Re-read inventory and reserve',
      status: 'running',
      progress: 30,
    },
  ];
</script>

<RunStepTimeline {steps} label="Speculative reservation" />
