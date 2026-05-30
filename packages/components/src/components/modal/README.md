# Modal

A Modal component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import Modal from 'cinder/modal';
</script>

<Modal />
```

## Props

<!-- generated:props:start -->

| Prop                     | Type                          | Required | Default | Description                                                                                                                |
| ------------------------ | ----------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class`                  | `string`                      | no       | —       |                                                                                                                            |
| `describedById`          | `string`                      | no       | —       | When set, applied as aria-describedby on the underlying <dialog>. Pass a short, plain description ID only.                 |
| `dismissOnBackdropClick` | `boolean`                     | no       | —       |                                                                                                                            |
| `dismissOnEscape`        | `boolean`                     | no       | —       |                                                                                                                            |
| `open`                   | `boolean`                     | yes      | —       |                                                                                                                            |
| `role`                   | `"dialog"` \| `"alertdialog"` | no       | —       |                                                                                                                            |
| `showCloseButton`        | `boolean`                     | no       | —       |                                                                                                                            |
| `title`                  | `string`                      | yes      | —       |                                                                                                                            |
| `children`               | `(opaque)`                    | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `footer`                 | `(opaque)`                    | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `ondismiss`              | `(opaque)`                    | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `triggerRef`             | `(opaque)`                    | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                    |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
