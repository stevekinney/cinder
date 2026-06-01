# ConfirmDialog

Pre-wired modal dialog with confirm and cancel actions for destructive or irreversible operations.

## When to use

- Asking the user to confirm before deleting, discarding, or publishing something that cannot easily be undone.
- Any two-action flow where the only choices are "proceed" and "cancel" — ConfirmDialog saves you from composing Modal + two Buttons manually.
- Destructive actions: set `destructive` to apply the danger variant to the confirm button.

## When not to use

- When the dialog body needs rich content (lists, markup, multiple paragraphs) — compose [`Modal`](../modal/README.md) directly instead, since `aria-describedby` collapses to a single continuous string for screen readers.
- When more than two actions are needed — use [`Modal`](../modal/README.md) with a custom `footer` snippet.
- Non-blocking notifications — use a toast or inline alert that does not interrupt the flow.

## Related components

- [`Modal`](../modal/README.md) — the underlying primitive; use directly when you need more control over content or actions.

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
| `oncancel`     | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                          |
| `onconfirm`    | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                          |
| `triggerRef`   | `(opaque)` | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                             |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
