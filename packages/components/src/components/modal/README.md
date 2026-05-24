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

| Prop            | Type       | Required | Default | Description                                                                                                |
| --------------- | ---------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| `class`         | `string`   | no       | —       |                                                                                                            |
| `describedById` | `string`   | no       | —       | When set, applied as aria-describedby on the underlying <dialog>. Pass a short, plain description ID only. |
| `open`          | `boolean`  | yes      | —       |                                                                                                            |
| `title`         | `string`   | yes      | —       |                                                                                                            |
| `children`      | `(opaque)` | —        | —       | function-or-snippet                                                                                        |
| `footer`        | `(opaque)` | —        | —       | function-or-snippet                                                                                        |
| `ondismiss`     | `(opaque)` | —        | —       | function-or-snippet                                                                                        |
| `triggerRef`    | `(opaque)` | —        | —       | unknown-shape                                                                                              |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
