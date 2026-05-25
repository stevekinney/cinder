# ConfirmDialog

A ConfirmDialog component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import ConfirmDialog from 'cinder/confirm-dialog';
</script>

<ConfirmDialog />
```

## Props

<!-- generated:props:start -->

| Prop           | Type       | Required | Default | Description                                                                                                                                                                                                                                                                         |
| -------------- | ---------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cancelLabel`  | `string`   | no       | —       | Cancel button label. Defaults to "Cancel".                                                                                                                                                                                                                                          |
| `class`        | `string`   | no       | —       | Optional extra class on the underlying <Modal>. Destructured as `class: className` per repo convention.                                                                                                                                                                             |
| `confirmLabel` | `string`   | yes      | —       | Confirm button label. Required — no default. Name the action being confirmed: - Destructive: "Delete", "Discard changes", "Remove from organization". - Non-destructive: "Save", "Continue", "Publish". Never use "OK" or "Confirm" in production — they don't describe the action. |
| `description`  | `string`   | no       | —       | Optional body description — short, plain text only. Rendered as a single <p> and wired to aria-describedby. For rich content (markup, lists, multiple paragraphs), compose <Modal> + <Button> directly — screen readers announce aria-describedby targets as one continuous run.    |
| `destructive`  | `boolean`  | no       | —       | When true, the confirm button uses variant="danger". The cancel button still receives default focus regardless — color is never the sole destructive signal.                                                                                                                        |
| `open`         | `boolean`  | yes      | —       | Controls visibility. Bindable.                                                                                                                                                                                                                                                      |
| `title`        | `string`   | yes      | —       | Modal title; passed through to <Modal>.                                                                                                                                                                                                                                             |
| `oncancel`     | `(opaque)` | —        | —       | function-or-snippet                                                                                                                                                                                                                                                                 |
| `onconfirm`    | `(opaque)` | —        | —       | function-or-snippet                                                                                                                                                                                                                                                                 |
| `triggerRef`   | `(opaque)` | —        | —       | unknown-shape                                                                                                                                                                                                                                                                       |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
