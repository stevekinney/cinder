# AlertDialog

Sticky blocking acknowledgement dialog that cannot be dismissed by Escape or backdrop click. The user must click an explicit action button to proceed.

## Dialog model

AlertDialog is one of three dialog-level components:

- **`Modal`** — generic shell for rich content and forms.
- **`ConfirmDialog`** — preset for user-initiated binary decisions; Escape is a safe exit; cancel is the default focus.
- **`AlertDialog`** — this component. Preset for system-initiated or out-of-band urgency. No Escape exit. No backdrop dismiss. No close button. Acknowledgement is mandatory.

The key distinction between AlertDialog and ConfirmDialog is _who initiates_ the interruption and _whether dismissal without acting is safe_:

- ConfirmDialog is for user-initiated actions that need a safety gate. Pressing Escape means "never mind" — a safe, expected exit.
- AlertDialog is for conditions the system surfaces that require the user to acknowledge before continuing. Pressing Escape would bypass acknowledgement, which is unsafe for time-sensitive or high-consequence messages.

## When to use

- Session expiry, authentication loss, or network disconnection that requires the user to re-authenticate before continuing.
- System-level errors or process failures where the user must acknowledge the condition before taking any other action.
- High-consequence notifications that affect other users — "Deleting this workspace removes access for N collaborators" — where the breadth of impact means acknowledgement should be mandatory, not skippable.
- Any situation where dismissal by Escape or backdrop click would be incorrect because the user _must_ read and respond.

## When not to use

- User-initiated "are you sure?" prompts — use [`ConfirmDialog`](../confirm-dialog/README.md). Escape is a legitimate exit for user-initiated actions, and ConfirmDialog's cancel-button autofocus is the right affordance.
- Rich body content (markup, lists, multiple paragraphs) — `description` is a plain-text string. For rich body, compose [`Modal`](../modal/README.md) with `role="alertdialog"` directly (see Modal's `role` prop documentation for the required companion props).
- Non-blocking notifications — use a toast or inline alert that does not interrupt the flow.

## Usage

```svelte
<script lang="ts">
  import AlertDialog from 'cinder/alert-dialog';
</script>

<AlertDialog />
```

## Props

<!-- generated:props:start -->

| Prop               | Type       | Required | Default | Description                                                                                                                |
| ------------------ | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `acknowledgeLabel` | `string`   | no       | —       |                                                                                                                            |
| `cancelLabel`      | `string`   | no       | —       |                                                                                                                            |
| `class`            | `string`   | no       | —       |                                                                                                                            |
| `description`      | `string`   | yes      | —       |                                                                                                                            |
| `destructive`      | `boolean`  | no       | —       |                                                                                                                            |
| `open`             | `boolean`  | yes      | —       |                                                                                                                            |
| `title`            | `string`   | yes      | —       |                                                                                                                            |
| `onacknowledge`    | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `oncancel`         | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `triggerRef`       | `(opaque)` | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                    |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
