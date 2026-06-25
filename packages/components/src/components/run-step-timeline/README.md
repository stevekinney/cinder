# RunStepTimeline

Ordered step-by-step execution rail for async operations. Shows pending, running, waiting approval, succeeded, failed, cancelled, skipped, and retrying states with per-step durations, attempt counts, action counts, optional progress indicators, nested child-workflow lanes, links, and expandable inline detail panels for logs, payloads, and errors.

Use `RunStepTimeline` for CI jobs, workflow engine runs, import pipelines, deployment flows, and queue workers. Use `Timeline` for timestamp-first event logs. Use `Steps` for interactive wizard navigation.

## Overview

`RunStepTimeline` takes a `steps` array and renders an ordered list. Each step shows:

- A status dot on the rail (color-coded by state, decorative and hidden from assistive technology)
- A status badge (text label so state is not communicated by color alone)
- Start time, end time, and duration when available
- An attempt count badge when the step has been retried
- An action count badge when actions are available
- An optional link rendered with `Link`
- A progress bar for `running`, `retrying`, or `waiting_approval` steps with a known `progress` value
- Indented child-workflow lanes from recursive `children`
- Expandable Collapsible panels for logs, payloads, and errors via the `details` array

The component marks the currently active step with `aria-current="step"`. `running`, `retrying`, and `waiting_approval` are current, non-terminal states.

## Usage

```svelte
<script lang="ts">
  import RunStepTimeline from '@lostgradient/cinder/run-step-timeline';
  import type { RunStep } from '@lostgradient/cinder/run-step-timeline';

  const steps: RunStep[] = [
    {
      id: 'validate',
      label: 'Validate configuration',
      status: 'succeeded',
      startTime: '2026-06-01T11:00:00Z',
      endTime: '2026-06-01T11:01:30Z',
      duration: '1m 30s',
    },
    {
      id: 'build',
      label: 'Build Docker image',
      status: 'running',
      startTime: '2026-06-01T11:02:00Z',
      progress: 40,
      link: {
        href: '/runs/run-123/build',
        label: 'Open logs',
      },
    },
    {
      id: 'deploy',
      label: 'Deploy to staging',
      status: 'pending',
    },
  ];
</script>

<RunStepTimeline {steps} label="Deployment run" />
```

### With expandable details

```svelte
<RunStepTimeline {steps} label="CI run">
  {#snippet children(step)}
    {#if step.status === 'failed'}
      <p>Contact the platform team if this persists.</p>
    {/if}
  {/snippet}
</RunStepTimeline>
```

### With inline detail panels

```svelte
<script lang="ts">
  import type { RunStep } from '@lostgradient/cinder/run-step-timeline';

  const steps: RunStep[] = [
    {
      id: 'test',
      label: 'Run unit tests',
      status: 'failed',
      duration: '5m 0s',
      attemptCount: 2,
      details: [
        {
          id: 'test-error-log',
          label: 'Error output',
          content: 'AssertionError: expected 1 to equal 2\n  at src/math.test.ts:12',
        },
        {
          id: 'test-env',
          label: 'Environment',
          content: 'NODE_ENV=test\nCI=true',
        },
      ],
    },
  ];
</script>
```

### With nested child-workflow lanes

```svelte
<script lang="ts">
  import type { RunStep } from '@lostgradient/cinder/run-step-timeline';

  const steps: RunStep[] = [
    {
      id: 'workflow',
      label: 'Workflow',
      status: 'running',
      children: [
        {
          id: 'tool',
          label: 'Run repository tool',
          status: 'succeeded',
          actionsCount: 2,
        },
        {
          id: 'approval',
          label: 'Await approval',
          status: 'waiting_approval',
        },
      ],
    },
  ];
</script>
```

## Step states

`RunStepStatus` is intentionally domain-agnostic. Map your domain state onto one of these:

- `pending` — not yet started
- `running` — currently executing (only one step should be running)
- `waiting_approval` — paused on required approval and expected to continue
- `succeeded` — completed successfully
- `failed` — completed with a terminal error
- `cancelled` — stopped before it could complete
- `skipped` — bypassed intentionally
- `retrying` — a prior attempt failed; a new attempt is in progress

## Props

### RunStepTimeline props

```
steps      RunStep[]          required  Ordered list of steps to render.
label      string             optional  Accessible label for the list (aria-label).
class      string             optional  Additional CSS classes on the root ol element.
children   Snippet<[RunStep]> optional  Per-step body content rendered after step metadata.
```

### RunStep shape

```
id           string           required  Stable identity for keyed reconciliation.
label        string           required  Display label shown in the step header.
status       RunStepStatus    required  Generic execution state.
startTime    string           optional  ISO datetime when the step started.
endTime      string           optional  ISO datetime when the step ended.
duration     string           optional  Human-readable duration string, e.g. "1m 23s".
attemptCount number           optional  Total attempts made; badge shown when greater than 1.
actionsCount number           optional  Total associated actions; badge shown when greater than 0.
progress     number           optional  Determinate progress value (0 to progressMax).
progressMax  number           optional  Upper bound for progress. Defaults to 100.
details      RunStepDetail[]  optional  Expandable inline panels for logs, payloads, errors.
link         RunStepLink      optional  Link rendered in the step header.
children     RunStep[]        optional  Nested child-workflow steps rendered as indented lanes.
```

### RunStepDetail shape

```
id       string  required  Stable identity for this detail panel.
label    string  required  Trigger label on the Collapsible header.
content  string  required  Pre-formatted content shown inside the panel.
```

### RunStepLink shape

```
href   string  required  Destination URL for the step link.
label  string  required  Visible link text.
```

## Accessibility

`RunStepTimeline` renders an `ol` (ordered list) because steps are numbered and sequential. The list takes an accessible name via `label` (used as `aria-label` when neither `aria-label` nor `aria-labelledby` is provided directly).

The active step (`running`, `retrying`, or `waiting_approval`) receives `aria-current="step"` on its `li` element, matching the same pattern used by the `Steps` component. This allows assistive technology to identify which step is current without requiring a live region announcement.

Status dots on the rail are decorative: the marker element is marked `aria-hidden="true"` and `inert`. The status badge rendered as text includes an accessible label such as "Status: Waiting approval", so the step state is communicated to assistive technology through text, not color alone (WCAG 1.4.1).

Progress bars include an `aria-label` derived from the step label (e.g. "Build Docker image progress"), satisfying the ARIA progressbar accessible name requirement.

Expandable detail panels use `Collapsible` which implements the disclosure button pattern with `aria-expanded` and `aria-controls` wiring.
