# QrCode

Encode a string payload as an inline, theme-aware SVG QR image with accessible labeling.

## Usage

```svelte
<script lang="ts">
  import { QrCode } from '@lostgradient/cinder/qr-code';
</script>

<QrCode value="https://cinder.design" label="Scan to open the cinder website" />
```

## Props

<!-- generated:props:start -->

| Prop                   | Type                             | Required | Default     | Description                                   |
| ---------------------- | -------------------------------- | -------- | ----------- | --------------------------------------------- |
| `class`                | `string`                         | no       | —           | Custom class merged with `.cinder-qr-code`.   |
| `errorCorrectionLevel` | `"L"` \| `"M"` \| `"Q"` \| `"H"` | no       | `"M"`       | QR error correction level.                    |
| `label`                | `string`                         | no       | `"QR code"` | Accessible label announced for the QR image.  |
| `margin`               | `number`                         | no       | `1`         | Quiet-zone width in QR modules.               |
| `size`                 | `number`                         | no       | `160`       | Square pixel size of the rendered QR code.    |
| `value`                | `string`                         | yes      | —           | Text payload encoded into the QR code matrix. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
