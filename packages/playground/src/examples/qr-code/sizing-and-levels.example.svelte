<script lang="ts" module>
  export const title = 'Size and error correction';
  export const description = 'Compare QR size and recovery level for short and long payloads.';
</script>

<script lang="ts">
  import { QrCode } from '@lostgradient/cinder/qr-code';
</script>

<div style="display: flex; flex-wrap: wrap; align-items: flex-start; gap: 1.25rem;">
  <QrCode
    value="otpauth://totp/cinder?secret=ABC123DEF456&issuer=Cinder"
    size={128}
    errorCorrectionLevel="L"
  />
  <QrCode
    value="https://cinder.design/docs/advanced/accessibility?source=playground"
    size={200}
    errorCorrectionLevel="H"
  />
</div>
