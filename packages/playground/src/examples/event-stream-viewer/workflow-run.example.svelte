<script lang="ts" module>
  export const title = 'Workflow run with retries and signals';
  export const description =
    'A realistic workflow run event stream with activity completions, retry attempts, inbound signals, and a structured failure trace with expandable JSON details.';
</script>

<script lang="ts">
  import { EventStreamViewer } from '@lostgradient/cinder/event-stream-viewer';
  import type { StreamEvent } from '@lostgradient/cinder/event-stream-viewer';

  const events: StreamEvent[] = [
    {
      id: 'run-start',
      datetime: '2026-05-12T09:00:00Z',
      timestamp: '09:00:00',
      severity: 'info',
      source: 'orchestrator',
      summary: 'Workflow run started: OrderFulfillment/wf-83a1c',
      details: { workflowId: 'wf-83a1c', runId: 'run-7f2b', input: { orderId: 'ord-991' } },
    },
    {
      id: 'activity-1-scheduled',
      datetime: '2026-05-12T09:00:01Z',
      timestamp: '09:00:01',
      severity: 'info',
      source: 'activity-worker',
      summary: 'Scheduled activity: ValidateInventory',
    },
    {
      id: 'activity-1-complete',
      datetime: '2026-05-12T09:00:03Z',
      timestamp: '09:00:03',
      severity: 'success',
      source: 'activity-worker',
      summary: 'Activity completed: ValidateInventory',
      details: { available: true, reservedQty: 2 },
    },
    {
      id: 'activity-2-scheduled',
      datetime: '2026-05-12T09:00:04Z',
      timestamp: '09:00:04',
      severity: 'info',
      source: 'payment-worker',
      summary: 'Scheduled activity: ChargePayment',
    },
    {
      id: 'activity-2-retry-1',
      datetime: '2026-05-12T09:00:07Z',
      timestamp: '09:00:07',
      severity: 'warning',
      source: 'payment-worker',
      summary: 'Activity failed (attempt 1/3): ChargePayment — upstream timeout',
      details: { attempt: 1, maxAttempts: 3, error: 'GatewayTimeoutError', retryIn: '5s' },
    },
    {
      id: 'activity-2-retry-2',
      datetime: '2026-05-12T09:00:13Z',
      timestamp: '09:00:13',
      severity: 'warning',
      source: 'payment-worker',
      summary: 'Activity failed (attempt 2/3): ChargePayment — upstream timeout',
      details: { attempt: 2, maxAttempts: 3, error: 'GatewayTimeoutError', retryIn: '10s' },
    },
    {
      id: 'signal-received',
      datetime: '2026-05-12T09:00:18Z',
      timestamp: '09:00:18',
      severity: 'info',
      source: 'orchestrator',
      summary: 'Signal received: ApproveManualOverride',
      details: { signalName: 'ApproveManualOverride', payload: { approvedBy: 'ops@example.com' } },
    },
    {
      id: 'activity-2-complete',
      datetime: '2026-05-12T09:00:20Z',
      timestamp: '09:00:20',
      severity: 'success',
      source: 'payment-worker',
      summary: 'Activity completed: ChargePayment (manual override)',
      details: { chargeId: 'ch_9f3b', amount: 149.99, currency: 'USD' },
    },
    {
      id: 'activity-3-scheduled',
      datetime: '2026-05-12T09:00:21Z',
      timestamp: '09:00:21',
      severity: 'info',
      source: 'fulfillment-worker',
      summary: 'Scheduled activity: ShipOrder',
    },
    {
      id: 'activity-3-failed',
      datetime: '2026-05-12T09:00:25Z',
      timestamp: '09:00:25',
      severity: 'error',
      source: 'fulfillment-worker',
      summary: 'Activity permanently failed: ShipOrder — warehouse API returned 503',
      details: {
        attempt: 3,
        maxAttempts: 3,
        error: 'WarehouseUnavailableError',
        message: 'Warehouse API returned 503 after 3 retries',
        stack:
          'WarehouseUnavailableError\n  at ShipOrder.execute (ship-order.ts:42)\n  at ActivityWorker.run (worker.ts:120)',
      },
    },
    {
      id: 'run-failed',
      datetime: '2026-05-12T09:00:26Z',
      timestamp: '09:00:26',
      severity: 'error',
      source: 'orchestrator',
      summary: 'Workflow run failed: OrderFulfillment/wf-83a1c',
      details: { failureReason: 'ChildWorkflowFailed', compensating: false },
    },
  ];
</script>

<EventStreamViewer {events} label="Workflow run: OrderFulfillment" connectionState="disconnected" />
