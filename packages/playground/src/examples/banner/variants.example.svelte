<script lang="ts" module>
  export const title = 'Banner variants';
  export const description =
    'All four semantic variant styles — info, success, warning, and danger.';
</script>

<script lang="ts">
  import { Banner } from '@lostgradient/cinder/banner';
</script>

<div style="display: flex; flex-direction: column; gap: 0.75rem;">
  <Banner variant="info" dismissible={false}>Your trial expires in 7 days.</Banner>
  <Banner variant="success" dismissible={false}>Your changes have been saved successfully.</Banner>
  <Banner variant="warning" dismissible={false}>Storage is 90% full. Free up space soon.</Banner>
  <Banner variant="danger" dismissible={false}>Your payment method has expired.</Banner>
</div>
