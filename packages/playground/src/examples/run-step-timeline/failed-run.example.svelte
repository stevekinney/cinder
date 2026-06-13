<script lang="ts" module>
  export const title = 'Failed run with error details';
  export const description =
    'A completed run where one step failed after retries, with expandable error output and environment info.';
</script>

<script lang="ts">
  import { RunStepTimeline } from '@lostgradient/cinder/run-step-timeline';
  import type { RunStep } from '@lostgradient/cinder/run-step-timeline';

  const steps: RunStep[] = [
    {
      id: 'lint',
      label: 'Lint source files',
      status: 'succeeded',
      startTime: '2026-06-01T10:00:00Z',
      endTime: '2026-06-01T10:00:22Z',
      duration: '22s',
    },
    {
      id: 'typecheck',
      label: 'Type-check',
      status: 'succeeded',
      startTime: '2026-06-01T10:00:23Z',
      endTime: '2026-06-01T10:00:51Z',
      duration: '28s',
    },
    {
      id: 'test',
      label: 'Run unit tests',
      status: 'failed',
      startTime: '2026-06-01T10:00:52Z',
      endTime: '2026-06-01T10:05:10Z',
      duration: '4m 18s',
      attemptCount: 2,
      details: [
        {
          id: 'test-error',
          label: 'Error output',
          content:
            'AssertionError: expected 1 to equal 2\n  at src/math.test.ts:12:5\n  at test (bun:test/runner.ts:88)',
        },
        {
          id: 'test-env',
          label: 'Environment',
          content: 'NODE_ENV=test\nCI=true\nBUN_VERSION=1.2.0',
        },
      ],
    },
    {
      id: 'publish',
      label: 'Publish artifacts',
      status: 'cancelled',
    },
  ];
</script>

<RunStepTimeline {steps} label="CI run — failed" />
