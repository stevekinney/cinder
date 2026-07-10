# ConfirmDialog

Pre-wired modal dialog for user-initiated binary decisions: "proceed" or "cancel". Focus defaults to the cancel button — the industry-standard guard against accidental destructive confirms.

## Dialog model

ConfirmDialog is one of three dialog-level components:

- **`Modal`** — generic shell for rich content and forms. Use when the interaction requires more than two actions or rich body content.
- **`ConfirmDialog`** — this component. Preset for user-initiated yes/no decisions. Escape, backdrop click, and the close-X all fire `oncancel`.
- **`AlertDialog`** — preset for urgent blocking acknowledgements. Cannot be dismissed by Escape or backdrop click. No close button. The user _must_ click an action button.

The key distinction between ConfirmDialog and AlertDialog is _who initiates_ the interruption:

- ConfirmDialog is for user-initiated actions that need a safety gate ("You clicked Delete — are you sure?"). Escape is a safe exit; cancel is the default focus.
- AlertDialog is for system-initiated or out-of-band urgency ("Your session expired", "This action affects others"). Escape is blocked; acknowledgement is mandatory.

## Choosing this component

- Asking the user to confirm before deleting, discarding, or publishing something that cannot easily be undone.
- Any two-action flow where the only choices are "proceed" and "cancel" — ConfirmDialog saves you from composing Modal + two Buttons manually.
- Destructive actions: set `destructive` to apply the danger variant to the confirm button.

## Choosing something else

- When the dialog body needs rich content (lists, markup, multiple paragraphs) — compose [`Modal`](../modal/README.md) directly instead, since `aria-describedby` collapses to a single continuous string for screen readers.
- When more than two actions are needed — use [`Modal`](../modal/README.md) with a custom `footer` snippet.
- When the dialog is triggered by a system event or out-of-band condition requiring mandatory acknowledgement — use [`AlertDialog`](../alert-dialog/README.md) instead.
- Non-blocking notifications — use a toast or inline alert that does not interrupt the flow.

## Related components

- [`Modal`](../modal/README.md) — the underlying primitive; use directly when you need more control over content or actions.
- [`AlertDialog`](../alert-dialog/README.md) — sticky blocking acknowledgement; cannot be dismissed by Escape or backdrop click.

## Usage

```svelte
<script lang="ts">
  import ConfirmDialog from '@lostgradient/cinder/confirm-dialog';
</script>

<ConfirmDialog />
```

## Props

<!-- generated:props:start -->

| Prop                 | Type       | Required | Default | Description                                                                                                                                                                                                                                                                                                                             |
| -------------------- | ---------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cancelLabel`        | `string`   | no       | —       | Cancel button label. Defaults to "Cancel".                                                                                                                                                                                                                                                                                              |
| `class`              | `string`   | no       | —       | Optional extra class on the underlying <Modal>. Destructured as `class: className` per repo convention.                                                                                                                                                                                                                                 |
| `confirmLabel`       | `string`   | yes      | —       | Confirm button label. Required — no default. Name the action being confirmed: - Destructive: "Delete", "Discard changes", "Remove from organization". - Non-destructive: "Save", "Continue", "Publish". Never use "OK" or "Confirm" in production — they don't describe the action.                                                     |
| `description`        | `string`   | no       | —       | Optional body description — short, plain text only. Rendered as a single <p> and wired to aria-describedby. For rich content (markup, lists, multiple paragraphs), compose <Modal> + <Button> directly — screen readers announce aria-describedby targets as one continuous run.                                                        |
| `destructive`        | `boolean`  | no       | —       | When true, the confirm button uses variant="danger". The cancel button still receives default focus regardless — color is never the sole destructive signal.                                                                                                                                                                            |
| `open`               | `boolean`  | yes      | —       | Controls visibility. Bindable.                                                                                                                                                                                                                                                                                                          |
| `title`              | `string`   | yes      | —       | Modal title; passed through to <Modal>.                                                                                                                                                                                                                                                                                                 |
| `typeToConfirm`      | `string`   | no       | —       | When set, renders a labelled text input and disables the confirm button until the trimmed input matches this value case-insensitively.                                                                                                                                                                                                  |
| `typeToConfirmLabel` | `string`   | no       | —       | Visible label for the typed-confirmation input. Defaults to `Type "<value>" to confirm`.                                                                                                                                                                                                                                                |
| `oncancel`           | `(opaque)` | no       | —       | Fired when the user cancels via ANY dismissal affordance — cancel button, Escape, backdrop click, or the close-X button. Optional. Parent-driven `open = false` does NOT fire this callback. Callbacks are not awaited; thrown callbacks do not block close. Not expressible in JSON Schema; see the component types for the signature. |
| `onconfirm`          | `(opaque)` | yes      | —       | Fired when the user activates the confirm button. Required. Component closes itself after. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                   |
| `triggerRef`         | `(opaque)` | no       | —       | Forwarded to <Modal>; focus is restored here on close. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                       |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
