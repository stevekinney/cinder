<script lang="ts" module>
  export const title = 'Basic payload inspector';
  export const description =
    'Inspect a structured object payload as an interactive tree with a copy action and byte size.';
</script>

<script lang="ts">
  import { PayloadInspector } from '@lostgradient/cinder/payload-inspector';

  const payload = {
    userId: 'u_8f2a3b',
    action: 'checkout',
    cart: {
      items: [
        { id: 'p_001', name: 'Widget', qty: 2, price: 19.99 },
        { id: 'p_002', name: 'Gadget', qty: 1, price: 49.95 },
      ],
      total: 89.93,
    },
    timestamp: '2026-06-11T14:22:00Z',
    flags: { guestCheckout: false, promoApplied: true },
  };
</script>

<PayloadInspector value={payload} label="Checkout payload" />
