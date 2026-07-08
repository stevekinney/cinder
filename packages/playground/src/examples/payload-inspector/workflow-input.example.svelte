<script lang="ts" module>
  export const title = 'Workflow input';
  export const description =
    'Inspecting a workflow launch payload with signal input, retry policy, and schedule metadata.';
</script>

<script lang="ts">
  import { PayloadInspector } from '@lostgradient/cinder/payload-inspector';

  const workflowInput = {
    workflowType: 'OrderFulfillment',
    input: {
      orderId: 'ord_9c4e1f',
      customerId: 'cust_221a',
      priority: 'express',
      items: ['sku-100', 'sku-201', 'sku-303'],
      shipTo: {
        name: 'Alex Rivera',
        address: '42 Elm St',
        city: 'Springfield',
        zip: '12345',
      },
    },
    retryPolicy: {
      maximumAttempts: 3,
      initialInterval: '1s',
      maximumInterval: '30s',
      backoffCoefficient: 2,
    },
    searchAttributes: {
      OrderStatus: 'pending',
      CustomerId: 'cust_221a',
    },
  };
</script>

<PayloadInspector value={workflowInput} label="Workflow input" />
