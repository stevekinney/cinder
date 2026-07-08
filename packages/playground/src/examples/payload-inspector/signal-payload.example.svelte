<script lang="ts" module>
  export const title = 'Signal payload';
  export const description =
    'Inspect a workflow signal payload — a common pattern in activity result dashboards.';
</script>

<script lang="ts">
  import { PayloadInspector } from '@lostgradient/cinder/payload-inspector';

  const signalPayload = {
    signalName: 'PaymentConfirmed',
    data: {
      transactionId: 'txn_5e8b2a',
      amount: 89.93,
      currency: 'USD',
      provider: 'stripe',
      confirmedAt: '2026-06-11T14:23:01Z',
      metadata: {
        statementDescriptor: 'ACME STORE',
        riskScore: 0.12,
      },
    },
    sentAt: '2026-06-11T14:23:01.543Z',
    correlationId: 'ord_9c4e1f',
  };
</script>

<PayloadInspector value={signalPayload} label="Signal payload" />
