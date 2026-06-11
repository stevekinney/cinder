# CopyButton

Button that copies a given text value to the clipboard with visual feedback.

## Usage

```svelte
<script lang="ts">
  import CopyButton from '@lostgradient/cinder/copy-button';
</script>

<CopyButton />
```

## Props

<!-- generated:props:start -->

| Prop              | Type       | Required | Default | Description                                                                                                                                                                                                                                                                          |
| ----------------- | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `class`           | `string`   | no       | —       | Additional class names merged with `.cinder-copy-button`.                                                                                                                                                                                                                            |
| `confirmDuration` | `number`   | no       | —       | Duration in ms to show the confirmation state. Default 1500.                                                                                                                                                                                                                         |
| `copiedLabel`     | `string`   | no       | —       | Accessible label for the copied state — what `aria-live="polite"` announces when the copy succeeds. Defaults to "Copied". Override this when `label` is customized so the live-region announcement reflects what just happened (e.g. label="Copy code" + copiedLabel="Code copied"). |
| `iconOnly`        | `boolean`  | no       | —       | Render the button with only an icon and a visually hidden label. When true, defaults to a Copy icon (idle) and a Check icon (copied).                                                                                                                                                |
| `label`           | `string`   | no       | —       | Accessible label for the idle state. Defaults to "Copy to clipboard".                                                                                                                                                                                                                |
| `value`           | `string`   | yes      | —       | Text to copy to the clipboard.                                                                                                                                                                                                                                                       |
| `children`        | `(opaque)` | no       | —       | Default content (idle state). Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                             |
| `confirmation`    | `(opaque)` | no       | —       | Content rendered while in the "copied" state. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                             |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
