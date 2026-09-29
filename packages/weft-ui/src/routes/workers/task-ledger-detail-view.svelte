<script lang="ts">
  import { Alert, Badge, DescriptionList } from '@lostgradient/cinder';

  import { formatDuration, formatRelativeTime, truncateId } from '../../lib/format/index.ts';
  import type { TaskLedgerDetail } from './worker-catalog-types.ts';

  interface TaskLedgerDetailViewProps {
    readonly task: TaskLedgerDetail;
    readonly now: number;
    readonly refreshing?: boolean;
  }

  let { task, now, refreshing = false }: TaskLedgerDetailViewProps = $props();

  const isDelayed = $derived(task.state === 'queued' && (task.availableAt ?? 0) > now);
  const retryAvailable = $derived(
    task.retryPolicy ? task.attempt < task.retryPolicy.maxAttempts : false,
  );
  const adoptionLabel = $derived(
    task.state === 'terminal'
      ? task.adopted
        ? `Adopted ${formatRelativeTime(task.adoptedAt ?? task.terminalAt ?? now, now)}`
        : 'Awaiting workflow adoption'
      : 'Not applicable before terminal state',
  );
  const stateLabel = $derived(
    isDelayed ? 'Delayed' : task.state === 'deadLettered' ? 'Dead lettered' : task.state,
  );
  const stateVariant = $derived(
    task.state === 'deadLettered' || task.disposition === 'retryExhausted'
      ? 'danger'
      : task.state === 'terminal' && task.disposition === 'resolved'
        ? 'success'
        : 'warning',
  );
  const identityItems = $derived([
    { term: 'Operation', definition: task.operationId },
    { term: 'Attempt', definition: String(task.attempt) },
    { term: 'Workflow', definition: task.workflowId ?? 'No workflow identifier' },
    { term: 'Execution token', definition: task.workflowExecutionToken ?? 'Not supplied' },
    { term: 'Activity', definition: `${task.workflowType}.${task.activityName}` },
  ]);
  const dispatchItems = $derived([
    { term: 'Queue', definition: task.queue },
    {
      term: 'Priority',
      definition: task.priority === undefined ? 'Default' : String(task.priority),
    },
    {
      term: 'Headers',
      definition: task.headerKeys.length > 0 ? task.headerKeys.join(', ') : 'None',
    },
    {
      term: 'Availability',
      definition:
        task.availableAt === undefined
          ? 'Already dispatched'
          : formatRelativeTime(task.availableAt, now),
    },
    { term: 'Visibility timeout', definition: formatDuration(task.visibilityTimeoutMilliseconds) },
    {
      term: 'Schedule-to-close',
      definition: task.scheduleToCloseDeadline
        ? formatRelativeTime(task.scheduleToCloseDeadline, now)
        : 'No deadline',
    },
    { term: 'Fair-share key', definition: task.fairShareKey ?? 'None' },
    { term: 'Sticky workflow', definition: task.stickyWorkflowId ?? 'None' },
    {
      term: 'Capacity reservation',
      definition: task.executionRequirement
        ? Object.entries(task.executionRequirement)
            .filter(([, value]) => value)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ') || 'No constrained capacity'
        : 'No constrained capacity',
    },
  ]);
  const recoveryItems = $derived([
    {
      term: 'Lease',
      definition:
        task.leaseDeadline === undefined
          ? 'Not leased'
          : `Expires ${formatRelativeTime(task.leaseDeadline, now)}`,
    },
    {
      term: 'Last heartbeat',
      definition: task.lastHeartbeatAt
        ? formatRelativeTime(task.lastHeartbeatAt, now)
        : 'No heartbeat recorded',
    },
    {
      term: 'Retry availability',
      definition: task.retryPolicy
        ? `${retryAvailable ? 'Available' : 'Exhausted'} · attempt ${task.attempt} of ${task.retryPolicy.maxAttempts}`
        : 'No retry policy',
    },
    { term: 'Requeues', definition: String(task.requeueCount ?? 0) },
    { term: 'Last requeue reason', definition: task.lastRequeueReason ?? 'None' },
    { term: 'Adoption', definition: adoptionLabel },
    {
      term: 'Retention evidence',
      definition: task.deadLetteredAt
        ? `Dead letter retained since ${formatRelativeTime(task.deadLetteredAt, now)}`
        : task.terminalAt
          ? `Terminal record retained since ${formatRelativeTime(task.terminalAt, now)}`
          : `Ledger record created ${formatRelativeTime(task.createdAt, now)}`,
    },
  ]);
  const outcomeItems = $derived([
    { term: 'Disposition', definition: task.disposition ?? 'Not terminal' },
    { term: 'Pending result', definition: task.pendingStatus ?? 'None' },
    { term: 'Result status', definition: task.resultStatus ?? 'None' },
    { term: 'Result digest', definition: task.resultDigest ?? 'None' },
    { term: 'Error', definition: task.error ?? 'None' },
    { term: 'Cancellation reason', definition: task.cancellationReason ?? 'None' },
    {
      term: 'Cancellation requested',
      definition: task.cancellationRequestedAt
        ? formatRelativeTime(task.cancellationRequestedAt, now)
        : 'Not requested',
    },
    {
      term: 'Dead-letter reason',
      definition: task.persistenceFailureReason ?? 'Not dead-lettered',
    },
  ]);
</script>

<article class="weft-task-ledger-detail" aria-labelledby="task-ledger-title">
  <header class="weft-task-ledger-detail__header">
    <div>
      <h2 id="task-ledger-title">Authoritative task ledger</h2>
      <span class="weft-workers-id" title={task.operationId}>{truncateId(task.operationId)}</span>
    </div>
    <Badge variant={stateVariant}>{stateLabel}</Badge>
  </header>

  {#if task.state === 'deadLettered'}
    <Alert variant="danger">{task.persistenceFailureReason ?? 'Result persistence failed.'}</Alert>
  {:else if task.state === 'terminal' && !task.adopted}
    <Alert variant="warning"
      >The terminal result is durable but has not been adopted by its workflow.</Alert
    >
  {/if}

  {#if refreshing}
    <p role="status">Refreshing authoritative state. Cached ledger evidence remains visible.</p>
  {/if}

  <div class="weft-task-ledger-detail__grid">
    <section class="weft-workers-panel">
      <h3 class="weft-workers-panel__header">Identity</h3>
      <DescriptionList items={identityItems} />
    </section>
    <section class="weft-workers-panel">
      <h3 class="weft-workers-panel__header">Dispatch envelope</h3>
      <DescriptionList items={dispatchItems} />
    </section>
    <section class="weft-workers-panel">
      <h3 class="weft-workers-panel__header">Recovery readiness</h3>
      <DescriptionList items={recoveryItems} />
    </section>
    <section class="weft-workers-panel">
      <h3 class="weft-workers-panel__header">Completion and cancellation</h3>
      <DescriptionList items={outcomeItems} />
    </section>
  </div>
</article>
