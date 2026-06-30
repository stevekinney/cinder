<script lang="ts" module>
  export const title = 'Share link QR code';
  export const description = 'Render a scannable URL with an explicit accessible label.';
</script>

<script lang="ts">
  import { QrCode } from '@lostgradient/cinder/qr-code';
</script>

<QrCode value="https://cinder.design/components" label="Scan to open the cinder components page" />
